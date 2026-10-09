import "server-only";

import { and, asc, count, desc, eq, ilike, max, or, sql, type SQL } from "drizzle-orm";

import type { SortState } from "@/lib/sort";
import { db } from "@/server/db";
import { countByArchived } from "@/server/db/archived";
import { debtDelta, debtSum, debtSumOrZero, likePattern } from "@/server/db/expressions";
import { by } from "@/server/db/order";
import { CUSTOMER_COLORS, type CustomerColor } from "./colors";
import { customers, deliveries, deliveryItems, orders, products } from "@/server/db/schema";


export const CUSTOMER_SORTS = ["color", "id", "name", "comment", "debt", "last"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export interface CustomerListParams {
  q?: string;
  archived: boolean;
  /** null = by colour, then name (default). */
  sort: SortState<CustomerSort> | null;
  color?: CustomerColor;
  page: number;
  pageSize: number;
}


/** Customers with their current debt (old company/index, without the N+1 queries). */
export async function listCustomers(storeId: number, p: CustomerListParams) {
  const stats = db
    .select({
      customerId: deliveries.customerId,
      debt: debtSum.as("debt"),
      lastDate: max(deliveries.deliveryDate).as("last_date"),
    })
    .from(deliveries)
    .where(eq(deliveries.storeId, storeId))
    .groupBy(deliveries.customerId)
    .as("stats");

  const conditions: (SQL | undefined)[] = [eq(customers.storeId, storeId), eq(customers.isArchived, p.archived)];
  if (p.q) {
    const like = likePattern(p.q);
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

  // In CUSTOMER_COLORS order (red → … → white); customers without a colour last.
  const colorRank = sql`case ${customers.color} ${sql.raw(CUSTOMER_COLORS.map((c, i) => `when '${c}' then ${i}`).join(" "))} end`;
  const s = p.sort;
  const order = !s
    ? [by(colorRank, "asc"), asc(customers.name), asc(customers.id)]
    : [
        by(
          {
            color: colorRank,
            id: customers.id,
            name: customers.name,
            comment: sql`nullif(${customers.comment}, '')`,
            debt,
            last: stats.lastDate,
          }[s.column],
          s.dir,
        ),
        asc(customers.name),
        asc(customers.id),
      ];

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

export const countCustomers = (storeId: number) => countByArchived(customers, storeId);

export async function getCustomer(storeId: number, customerId: number) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)));
  if (!customer) return null;
  const [stats] = await db
    .select({
      debt: debtSumOrZero,
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
export const CUSTOMER_OPERATION_SORTS = ["date", "number", "kind", "total", "paid", "method", "debt", "comment"] as const;
export type CustomerOperationSort = (typeof CUSTOMER_OPERATION_SORTS)[number];

export async function listCustomerDeliveries(
  customerId: number,
  page: number,
  pageSize: number,
  sort: SortState<CustomerOperationSort> | null = null,
) {
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
        sql<string>`sum(${debtDelta}) over (order by ${deliveries.id})`.as(
          "debt_after",
        ),
    })
    .from(deliveries)
    .where(eq(deliveries.customerId, customerId))
    .as("running");
  const order = !sort
    ? [desc(running.id)]
    : sort.column === "date"
      ? [by(running.date, sort.dir), by(running.id, sort.dir)]
      : [
          by(
            {
              number: running.number,
              // the same three kinds the table shows: delivery, payment only, correction
              kind: sql`case when ${running.kind} = 'adjustment' then 2 when ${running.total} = 0 and ${running.paid} <> 0 then 1 else 0 end`,
              total: running.total,
              paid: running.paid,
              method: running.method,
              debt: running.debtAfter,
              comment: sql`nullif(${running.comment}, '')`,
            }[sort.column],
            sort.dir,
          ),
          desc(running.id),
        ];
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(running)
      .orderBy(...order)
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
