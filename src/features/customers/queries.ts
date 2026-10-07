import "server-only";

import { and, asc, count, desc, eq, ilike, max, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import { customers, deliveries, deliveryItems, orders, products } from "@/server/db/schema";

import { debtExpr } from "../dashboard/queries";

export type CustomerSort = "name" | "debt" | "recent" | "color";

export interface CustomerListParams {
  q?: string;
  archived: boolean;
  sort: CustomerSort;
  color?: "green" | "yellow" | "red";
  page: number;
  pageSize: number;
}

const likeEscape = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Customers with their current debt (old company/index, without the N+1 queries). */
export async function listCustomers(storeId: number, p: CustomerListParams) {
  const stats = db
    .select({
      customerId: deliveries.customerId,
      debt: debtExpr.as("debt"),
      lastDate: max(deliveries.deliveryDate).as("last_date"),
    })
    .from(deliveries)
    .where(eq(deliveries.storeId, storeId))
    .groupBy(deliveries.customerId)
    .as("stats");

  const conditions: (SQL | undefined)[] = [eq(customers.storeId, storeId), eq(customers.isArchived, p.archived)];
  if (p.q) {
    const like = likeEscape(p.q);
    conditions.push(
      or(
        ilike(customers.name, like),
        ilike(customers.address, like),
        ilike(customers.phone, like),
        ilike(customers.taxId, like),
        ilike(customers.contactPerson, like),
        ilike(customers.comment, like),
      ),
    );
  }
  if (p.color) conditions.push(eq(customers.color, p.color));
  const where = and(...conditions);
  const debt = sql<string>`coalesce(${stats.debt}, 0)`;

  const order = {
    name: [asc(customers.name)],
    debt: [desc(debt), asc(customers.name)],
    recent: [sql`${stats.lastDate} desc nulls last`, asc(customers.name)],
    color: [
      sql`case ${customers.color} when 'red' then 0 when 'yellow' then 1 when 'green' then 2 else 3 end`,
      asc(customers.name),
    ],
  }[p.sort];

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        address: customers.address,
        phone: customers.phone,
        contactPerson: customers.contactPerson,
        taxId: customers.taxId,
        comment: customers.comment,
        color: customers.color,
        debt,
        lastDate: stats.lastDate,
      })
      .from(customers)
      .leftJoin(stats, eq(stats.customerId, customers.id))
      .where(where)
      .orderBy(...order)
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    db
      .select({
        total: count(),
        receivable: sql<string>`coalesce(sum(${stats.debt}) filter (where ${stats.debt} > 0), 0)`,
        credit: sql<string>`coalesce(sum(${stats.debt}) filter (where ${stats.debt} < 0), 0)`,
      })
      .from(customers)
      .leftJoin(stats, eq(stats.customerId, customers.id))
      .where(where),
  ]);
  return { rows, ...totals };
}

export async function countCustomers(storeId: number) {
  const rows = await db
    .select({ archived: customers.isArchived, n: count() })
    .from(customers)
    .where(eq(customers.storeId, storeId))
    .groupBy(customers.isArchived);
  return {
    active: rows.find((r) => !r.archived)?.n ?? 0,
    archived: rows.find((r) => r.archived)?.n ?? 0,
  };
}

export async function getCustomer(storeId: number, customerId: number) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)));
  if (!customer) return null;
  const [stats] = await db
    .select({
      debt: sql<string>`coalesce(${debtExpr}, 0)`,
      total: sql<string>`coalesce(sum(${deliveries.totalAmount}), 0)`,
      paid: sql<string>`coalesce(sum(${deliveries.paidAmount}), 0)`,
      operations: sql<number>`(count(*) filter (where ${deliveries.kind} = 'delivery'))::int`,
      firstDate: sql<string | null>`min(${deliveries.deliveryDate})`,
      lastDate: sql<string | null>`max(${deliveries.deliveryDate})`,
    })
    .from(deliveries)
    .where(eq(deliveries.customerId, customerId));
  const [{ openOrders }] = await db
    .select({ openOrders: count() })
    .from(orders)
    .where(and(eq(orders.customerId, customerId), eq(orders.status, "open")));
  return { customer, stats, openOrders };
}

/** Old distribution/index: every operation with the debt right after it. */
export async function listCustomerDeliveries(customerId: number, page: number, pageSize: number) {
  const running = db
    .select({
      id: deliveries.id,
      number: deliveries.number,
      kind: deliveries.kind,
      date: deliveries.deliveryDate,
      total: deliveries.totalAmount,
      paid: deliveries.paidAmount,
      adjustment: deliveries.adjustmentAmount,
      method: deliveries.paymentMethod,
      comment: deliveries.comment,
      debtAfter:
        sql<string>`sum(${deliveries.totalAmount} - ${deliveries.paidAmount} + ${deliveries.adjustmentAmount}) over (order by ${deliveries.id})`.as(
          "debt_after",
        ),
    })
    .from(deliveries)
    .where(eq(deliveries.customerId, customerId))
    .as("running");
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(running)
      .orderBy(desc(running.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(deliveries).where(eq(deliveries.customerId, customerId)),
  ]);
  return { rows, total };
}

/**
 * Old "ყველა დღე ერთად" (distribution/viewsum): totals per product over every
 * operation of the customer; average price = Σ line totals ÷ Σ delivered.
 */
export async function getCustomerProductSummary(customerId: number) {
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      quantity: sql<number>`sum(${deliveryItems.quantity})::int`,
      leftover: sql<number>`sum(${deliveryItems.leftoverQty})::int`,
      gift: sql<number>`sum(${deliveryItems.giftQty})::int`,
      total: sql<string>`sum(${deliveryItems.lineTotal})`,
    })
    .from(deliveryItems)
    .innerJoin(deliveries, eq(deliveries.id, deliveryItems.deliveryId))
    .innerJoin(products, eq(products.id, deliveryItems.productId))
    .where(eq(deliveries.customerId, customerId))
    .groupBy(products.id)
    .having(sql`sum(${deliveryItems.quantity}) > 0`)
    .orderBy(desc(sql`sum(${deliveryItems.lineTotal})`));
  return rows;
}

/** Active customers for pickers (operation / order forms). */
export async function listCustomerOptions(storeId: number) {
  return db
    .select({ id: customers.id, name: customers.name, address: customers.address, phone: customers.phone })
    .from(customers)
    .where(and(eq(customers.storeId, storeId), eq(customers.isArchived, false)))
    .orderBy(asc(customers.name));
}
