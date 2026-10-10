import "server-only";

import { and, asc, count, desc, eq, ilike, max, ne, or, sql, type SQL } from "drizzle-orm";

import type { SortState } from "@/lib/sort";
import { db } from "@/server/db";
import { countByArchived } from "@/server/db/archived";
import { debtDelta, debtSum, debtSumOrZero, likePattern } from "@/server/db/expressions";
import { by } from "@/server/db/order";
import {
  customers,
  deliveries,
  deliveryItems,
  orders,
  products,
  stockReceiptItems,
  stockReceipts,
  users,
} from "@/server/db/schema";

import { CUSTOMER_COLORS, type CustomerColor } from "./colors";

/**
 * Goods taken back from the customer („პროდუქციის გამოტანა“) per product: they live on the
 * return's stock receipt, and come off what the customer was delivered.
 */
const returnedByProduct = (customerId: number) =>
  db
    .select({
      productId: stockReceiptItems.productId,
      quantity: sql<number>`sum(${stockReceiptItems.quantity})::int`.as("returned_qty"),
      value: sql<string>`sum(${stockReceiptItems.quantity} * ${stockReceiptItems.unitCost})`.as("returned_value"),
    })
    .from(stockReceiptItems)
    .innerJoin(stockReceipts, eq(stockReceipts.id, stockReceiptItems.receiptId))
    .where(eq(stockReceipts.customerId, customerId))
    .groupBy(stockReceiptItems.productId)
    .as("returned");


export const CUSTOMER_SORTS = ["color", "id", "name", "comment", "debt", "last"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export interface CustomerListParams {
  q?: string;
  archived: boolean;
  /** null = by colour, then name (default). */
  sort: SortState<CustomerSort> | null;
  color?: CustomerColor;
}


/** Customers with their current debt (old company/index, without the N+1 queries) — all on one page. */
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
      .orderBy(...order),
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
    // Counts („განაშთვა“) have their own tab; they never change the debt, so the running total is unaffected.
    .where(and(eq(deliveries.customerId, customerId), ne(deliveries.kind, "count")))
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
              kind: sql`case when ${running.kind} = 'adjustment' then 2 when ${running.kind} = 'count' then 3 when ${running.kind} = 'return' then 4 when ${running.total} = 0 and ${running.paid} <> 0 then 1 else 0 end`,
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
    db
      .select({ total: count() })
      .from(deliveries)
      .where(and(eq(deliveries.customerId, customerId), ne(deliveries.kind, "count"))),
  ]);
  return { rows, total };
}

/**
 * Old "ყველა დღე ერთად" (distribution/viewsum): totals per product over every
 * operation of the customer; average price = Σ line totals ÷ Σ delivered.
 * New: goods taken back („გამოტანა“) come off delivered and the line totals; the average price
 * stays the one of the deliveries (`deliveredQty`, `deliveredTotal`).
 */
export async function getCustomerProductSummary(customerId: number) {
  const returned = returnedByProduct(customerId);
  const deliveredQty = sql<number>`sum(${deliveryItems.quantity})::int`;
  const deliveredTotal = sql<string>`sum(${deliveryItems.lineTotal})`;
  // One `returned` row per product, repeated on each of its lines — hence max(), not sum().
  const total = sql<string>`sum(${deliveryItems.lineTotal}) - coalesce(max(${returned.value}), 0)`;
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      quantity: sql<number>`(sum(${deliveryItems.quantity}) - coalesce(max(${returned.quantity}), 0))::int`,
      leftover: sql<number>`sum(${deliveryItems.leftoverQty})::int`,
      gift: sql<number>`sum(${deliveryItems.giftQty})::int`,
      total,
      deliveredQty,
      deliveredTotal,
    })
    .from(deliveryItems)
    .innerJoin(deliveries, eq(deliveries.id, deliveryItems.deliveryId))
    .innerJoin(products, eq(products.id, deliveryItems.productId))
    .leftJoin(returned, eq(returned.productId, products.id))
    .where(eq(deliveries.customerId, customerId))
    .groupBy(products.id)
    .having(sql`sum(${deliveryItems.quantity}) > 0`)
    .orderBy(desc(total));
  return rows;
}

/** Active customers for pickers (operation / order forms). */

/** The customer's latest „განაშთვა“: a `count` operation, or an older operation that recorded leftovers. */
export async function getLatestCount(customerId: number) {
  const [row] = await db
    .select({ id: deliveries.id, number: deliveries.number, date: deliveries.deliveryDate })
    .from(deliveries)
    .where(
      and(
        eq(deliveries.customerId, customerId),
        or(
          eq(deliveries.kind, "count"),
          sql`exists (select 1 from ${deliveryItems} where ${deliveryItems.deliveryId} = ${deliveries.id} and ${deliveryItems.leftoverQty} <> 0)`,
        ),
      ),
    )
    .orderBy(desc(deliveries.id))
    .limit(1);
  return row ?? null;
}

/**
 * Every product the customer has been delivered (plus anything in the latest count), for the
 * „ნაშთი“ tab and the count / return forms: Σ delivered less what was taken back, the deliveries'
 * own totals for the average price (Σ line totals ÷ Σ delivered, as „ყველა დღე ერთად“), the last
 * price charged and the leftover of the latest count.
 */
export async function getCustomerShelf(customerId: number) {
  const latest = await getLatestCount(customerId);
  const returned = returnedByProduct(customerId);
  const isDelivery = sql`${deliveries.kind} = 'delivery'`;
  const deliveredQty = sql<number>`coalesce(sum(${deliveryItems.quantity}) filter (where ${isDelivery}), 0)::int`;
  // One `returned` row per product, repeated on each of its lines — hence max(), not sum().
  const returnedQty = sql<number>`coalesce(max(${returned.quantity}), 0)::int`;
  const leftover = latest
    ? sql<number>`coalesce(sum(${deliveryItems.leftoverQty}) filter (where ${deliveries.id} = ${latest.id}), 0)::int`
    : sql<number>`0`;
  const products_ = await db
    .select({
      productId: products.id,
      name: products.name,
      isActive: products.isActive,
      isArchived: products.isArchived,
      /** Σ delivered less what was taken back. */
      delivered: sql<number>`(${deliveredQty} - ${returnedQty})::int`,
      returned: returnedQty,
      /** Of the deliveries only: the average price ignores returns. */
      deliveredQty,
      deliveredTotal: sql<string>`coalesce(sum(${deliveryItems.lineTotal}) filter (where ${isDelivery}), 0)`,
      lastPrice: sql<string | null>`(array_agg(${deliveryItems.unitPrice} order by ${deliveries.id} desc) filter (where ${isDelivery} and ${deliveryItems.quantity} > 0))[1]`,
      leftover,
    })
    .from(deliveryItems)
    .innerJoin(deliveries, eq(deliveries.id, deliveryItems.deliveryId))
    .innerJoin(products, eq(products.id, deliveryItems.productId))
    .leftJoin(returned, eq(returned.productId, products.id))
    .where(eq(deliveries.customerId, customerId))
    .groupBy(products.id)
    .having(sql`${deliveredQty} > 0 or ${leftover} > 0`)
    .orderBy(asc(products.name));
  return {
    latestCount: latest,
    products: products_.map((p) => ({ ...p, lastPrice: p.lastPrice ?? "0" })),
  };
}

export type ShelfProduct = Awaited<ReturnType<typeof getCustomerShelf>>["products"][number];

/**
 * „განაშთვის ისტორია“ (new): every count of the customer, newest first — `count` operations and
 * older operations that recorded leftovers (the same rule as `getLatestCount`).
 */
export async function listCustomerCounts(customerId: number) {
  return db
    .select({
      id: deliveries.id,
      number: deliveries.number,
      date: deliveries.deliveryDate,
      kind: deliveries.kind,
      comment: deliveries.comment,
      createdBy: users.name,
      products: sql<number>`(count(${deliveryItems.id}) filter (where ${deliveryItems.leftoverQty} <> 0))::int`,
      leftover: sql<number>`coalesce(sum(${deliveryItems.leftoverQty}), 0)::int`,
      value: sql<string>`coalesce(sum(${deliveryItems.unitPrice} * ${deliveryItems.leftoverQty}), 0)`,
    })
    .from(deliveries)
    .leftJoin(deliveryItems, eq(deliveryItems.deliveryId, deliveries.id))
    .leftJoin(users, eq(users.id, deliveries.createdById))
    .where(eq(deliveries.customerId, customerId))
    .groupBy(deliveries.id, users.name)
    .having(sql`${deliveries.kind} = 'count' or sum(${deliveryItems.leftoverQty}) filter (where ${deliveryItems.leftoverQty} <> 0) is not null`)
    .orderBy(desc(deliveries.id));
}
