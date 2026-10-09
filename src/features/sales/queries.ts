import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import type { SortState } from "@/lib/sort";
import { db } from "@/server/db";
import { debtDelta, debtSum, debtSumOrZero, likePattern } from "@/server/db/expressions";
import { by } from "@/server/db/order";
import {
  customers,
  deliveries,
  deliveryItems,
  financeEntries,
  orderItems,
  orders,
  products,
  stockReceiptItems,
  stockReceipts,
  stores,
  suppliers,
  users,
} from "@/server/db/schema";

/** Running debt after each operation, per customer, over the store's whole history. */
function runningDeliveries(storeId: number) {
  return db
    .select({
      id: deliveries.id,
      customerId: deliveries.customerId,
      number: deliveries.number,
      kind: deliveries.kind,
      date: deliveries.deliveryDate,
      total: deliveries.totalAmount,
      paid: deliveries.paidAmount,
      adjustment: deliveries.adjustmentAmount,
      method: deliveries.paymentMethod,
      hasWaybill: deliveries.hasWaybill,
      comment: deliveries.comment,
      debtAfter:
        sql<string>`sum(${debtDelta}) over (partition by ${deliveries.customerId} order by ${deliveries.id})`.as(
          "debt_after",
        ),
    })
    .from(deliveries)
    .where(eq(deliveries.storeId, storeId))
    .as("running");
}

export const OPERATION_SORTS = ["date", "customer", "paid", "method", "debt", "total"] as const;
export type OperationSort = (typeof OPERATION_SORTS)[number];

export interface OperationListParams {
  q?: string;
  customerId?: number;
  from?: string;
  to?: string;
  method?: "cash" | "card" | "back";
  kind?: "delivery" | "payment" | "adjustment" | "count" | "return";
  sort: SortState<OperationSort> | null;
  page: number;
  pageSize: number;
}

/** Old distribution/all — every operation of the store, newest first, paginated. */
export async function listOperations(storeId: number, p: OperationListParams) {
  const running = runningDeliveries(storeId);
  const conditions: (SQL | undefined)[] = [];
  if (p.q) {
    const like = likePattern(p.q);
    conditions.push(
      or(ilike(customers.name, like), ilike(running.comment, like), sql`${running.number}::text = ${p.q}`),
    );
  }
  if (p.customerId) conditions.push(eq(running.customerId, p.customerId));
  if (p.from) conditions.push(gte(running.date, p.from));
  if (p.to) conditions.push(lte(running.date, p.to));
  if (p.method) conditions.push(eq(running.method, p.method));
  if (p.kind === "adjustment" || p.kind === "count" || p.kind === "return") conditions.push(eq(running.kind, p.kind));
  if (p.kind === "payment") conditions.push(and(eq(running.kind, "delivery"), sql`${running.total} = 0`, sql`${running.paid} <> 0`));
  if (p.kind === "delivery") conditions.push(and(eq(running.kind, "delivery"), sql`not (${running.total} = 0 and ${running.paid} <> 0)`));
  const where = conditions.length ? and(...conditions) : undefined;
  const s = p.sort;
  // Every order ends with the id, so pages never overlap or skip rows.
  const order = !s
    ? [desc(running.id)]
    : s.column === "date"
      ? [by(running.date, s.dir), by(running.id, s.dir)]
      : [
          by(
            { customer: customers.name, paid: running.paid, method: running.method, debt: running.debtAfter, total: running.total }[
              s.column
            ],
            s.dir,
          ),
          desc(running.id),
        ];

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: running.id,
        number: running.number,
        kind: running.kind,
        date: running.date,
        total: running.total,
        paid: running.paid,
        adjustment: running.adjustment,
        method: running.method,
        hasWaybill: running.hasWaybill,
        comment: running.comment,
        debtAfter: running.debtAfter,
        customerId: customers.id,
        customerName: customers.name,
      })
      .from(running)
      .innerJoin(customers, eq(customers.id, running.customerId))
      .where(where)
      .orderBy(...order)
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    db
      .select({
        count: count(),
        total: sql<string>`coalesce(sum(${running.total}), 0)`,
        paid: sql<string>`coalesce(sum(${running.paid}), 0)`,
      })
      .from(running)
      .innerJoin(customers, eq(customers.id, running.customerId))
      .where(where),
  ]);
  return { rows, ...totals };
}

/** One operation with its lines, the customer's debt before/after and linked records. */
export async function getOperation(storeId: number, deliveryId: number) {
  const [delivery] = await db
    .select({
      delivery: deliveries,
      customer: customers,
      createdBy: users.name,
      createdByEmail: users.email,
    })
    .from(deliveries)
    .innerJoin(customers, eq(customers.id, deliveries.customerId))
    .leftJoin(users, eq(users.id, deliveries.createdById))
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.storeId, storeId)));
  if (!delivery) return null;

  const [items, [debt], cash, [order]] = await Promise.all([
    db
      .select({
        id: deliveryItems.id,
        productId: products.id,
        name: products.name,
        currentPrice: products.salePrice,
        productArchived: products.isArchived,
        unitPrice: deliveryItems.unitPrice,
        quantity: deliveryItems.quantity,
        giftQty: deliveryItems.giftQty,
        leftoverQty: deliveryItems.leftoverQty,
        lineTotal: deliveryItems.lineTotal,
      })
      .from(deliveryItems)
      .innerJoin(products, eq(products.id, deliveryItems.productId))
      .where(eq(deliveryItems.deliveryId, deliveryId))
      .orderBy(asc(deliveryItems.id)),
    db
      .select({
        after: debtSumOrZero,
      })
      .from(deliveries)
      .where(and(eq(deliveries.customerId, delivery.customer.id), lte(deliveries.id, deliveryId))),
    db
      .select({ id: financeEntries.id, amountIn: financeEntries.amountIn, amountOut: financeEntries.amountOut, date: financeEntries.entryDate })
      .from(financeEntries)
      .where(eq(financeEntries.deliveryId, deliveryId)),
    db.select({ id: orders.id, number: orders.number }).from(orders).where(eq(orders.deliveryId, deliveryId)),
  ]);
  // A return's goods are on its linked stock receipt.
  const [receipt] =
    delivery.delivery.kind === "return"
      ? await db
          .select({ id: stockReceipts.id, number: stockReceipts.number })
          .from(stockReceipts)
          .where(eq(stockReceipts.deliveryId, deliveryId))
      : [];
  const returned = receipt
    ? await db
        .select({
          id: stockReceiptItems.id,
          name: products.name,
          unitPrice: stockReceiptItems.unitCost,
          quantity: stockReceiptItems.quantity,
        })
        .from(stockReceiptItems)
        .innerJoin(products, eq(products.id, stockReceiptItems.productId))
        .where(eq(stockReceiptItems.receiptId, receipt.id))
        .orderBy(asc(stockReceiptItems.id))
    : [];
  return {
    ...delivery,
    items,
    debtAfter: debt.after,
    cash,
    order: order ?? null,
    returnReceipt: receipt ? { ...receipt, items: returned } : null,
  };
}

export interface ProductOption {
  id: number;
  name: string;
  salePrice: string;
  stockQty: number;
  supplierName: string | null;
  isArchived: boolean;
  isActive: boolean;
}

/** Products for the line editors (active ones, plus any extra ids already on the document — kept even if inactive or in the trash). */
export async function listProductOptions(storeId: number, includeIds: number[] = []): Promise<ProductOption[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      salePrice: products.salePrice,
      stockQty: products.stockQty,
      supplierName: suppliers.name,
      isArchived: products.isArchived,
      isActive: products.isActive,
    })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(
      and(
        eq(products.storeId, storeId),
        or(and(eq(products.isArchived, false), eq(products.isActive, true)), includeIds.length ? inArray(products.id, includeIds) : undefined),
      ),
    )
    .orderBy(asc(products.id));
  return rows;
}

export interface CustomerOption {
  id: number;
  name: string;
  address: string;
  phone: string;
  debt: string;
}

/** Active customers with their current debt (for the operation/order customer picker). */
export async function listCustomerOptionsWithDebt(storeId: number): Promise<CustomerOption[]> {
  const stats = db
    .select({
      customerId: deliveries.customerId,
      debt: debtSum.as("debt"),
    })
    .from(deliveries)
    .where(eq(deliveries.storeId, storeId))
    .groupBy(deliveries.customerId)
    .as("stats");
  return db
    .select({
      id: customers.id,
      name: customers.name,
      address: customers.address,
      phone: customers.phone,
      debt: sql<string>`coalesce(${stats.debt}, 0)`,
    })
    .from(customers)
    .leftJoin(stats, eq(stats.customerId, customers.id))
    .where(and(eq(customers.storeId, storeId), eq(customers.isArchived, false)))
    .orderBy(asc(customers.name));
}

// ── Orders ──────────────────────────────────────────────────────────────────

export const ORDER_SORTS = ["date", "customer", "paid", "debt", "total", "comment", "status", "waybill"] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export interface OrderListParams {
  /** history = completed and cancelled together. */
  status: "open" | "history" | "completed" | "cancelled";
  q?: string;
  customerId?: number;
  sort: SortState<OrderSort> | null;
  page: number;
  pageSize: number;
}

/** Old orders/index (open) and orders/ordershistory (completed + cancelled). */
export async function listOrders(storeIds: number[], p: OrderListParams) {
  const ids = storeIds.length ? storeIds : [0];
  // Every customer's current debt in one grouped pass (a per-row subquery took seconds when sorting).
  const debts = db
    .select({
      customerId: deliveries.customerId,
      debt: debtSum.as("debt"),
    })
    .from(deliveries)
    .where(inArray(deliveries.storeId, ids))
    .groupBy(deliveries.customerId)
    .as("debts");
  const currentDebt = sql<string>`coalesce(${debts.debt}, 0)`;
  const conditions: (SQL | undefined)[] = [
    inArray(orders.storeId, ids),
    p.status === "history" ? sql`${orders.status} <> 'open'` : eq(orders.status, p.status),
  ];
  if (p.customerId) conditions.push(eq(orders.customerId, p.customerId));
  if (p.q) {
    const like = likePattern(p.q);
    conditions.push(
      or(ilike(customers.name, like), ilike(customers.address, like), ilike(orders.comment, like), sql`${orders.number}::text = ${p.q}`),
    );
  }
  const where = and(...conditions);
  const s = p.sort;
  const order = !s
    ? [desc(orders.orderDate), desc(orders.id)]
    : s.column === "date"
      ? [by(orders.orderDate, s.dir), by(orders.id, s.dir)]
      : [
          by(
            {
              customer: customers.name,
              paid: orders.paidAmount,
              debt: currentDebt,
              total: orders.totalAmount,
              comment: sql`nullif(${orders.comment}, '')`,
              status: orders.uploadStatus,
              waybill: orders.hasWaybill,
            }[s.column],
            s.dir,
          ),
          desc(orders.orderDate),
          desc(orders.id),
        ];
  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        storeName: stores.name,
        number: orders.number,
        date: orders.orderDate,
        status: orders.status,
        total: orders.totalAmount,
        paid: orders.paidAmount,
        debtSnapshot: orders.debtSnapshot,
        method: orders.paymentMethod,
        hasWaybill: orders.hasWaybill,
        uploadStatus: orders.uploadStatus,
        comment: orders.comment,
        deliveryId: orders.deliveryId,
        customerId: customers.id,
        customerName: customers.name,
        customerAddress: customers.address,
        currentDebt,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .leftJoin(debts, eq(debts.customerId, orders.customerId))
      .where(where)
      .orderBy(...order)
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    db
      .select({
        count: count(),
        total: sql<string>`coalesce(sum(${orders.totalAmount}), 0)`,
        paid: sql<string>`coalesce(sum(${orders.paidAmount}), 0)`,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(where),
  ]);
  return { rows, ...totals };
}

export interface CustomerFilterOption {
  id: number;
  name: string;
  address: string;
  isArchived: boolean;
  storeName: string;
}

/**
 * Customers for the "ობიექტი" filter: only those that have operations (or orders / open orders)
 * in the given stores, active ones first.
 */
export async function listCustomerFilterOptions(
  storeIds: number[],
  source: "deliveries" | "orders" | "open-orders",
): Promise<CustomerFilterOption[]> {
  if (storeIds.length === 0) return [];
  const has =
    source === "deliveries"
      ? sql`exists (select 1 from ${deliveries} where ${deliveries.customerId} = ${customers.id})`
      : source === "orders"
        ? sql`exists (select 1 from ${orders} where ${orders.customerId} = ${customers.id})`
        : sql`exists (select 1 from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.status} = 'open')`;
  return db
    .select({
      id: customers.id,
      name: customers.name,
      address: customers.address,
      isArchived: customers.isArchived,
      storeName: stores.name,
    })
    .from(customers)
    .innerJoin(stores, eq(stores.id, customers.storeId))
    .where(and(inArray(customers.storeId, storeIds), has))
    .orderBy(asc(customers.isArchived), asc(customers.name), asc(customers.id));
}

export async function getOrder(storeId: number, orderId: number) {
  const [row] = await db
    .select({ order: orders, customer: customers, createdBy: users.name, createdByEmail: users.email })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .leftJoin(users, eq(users.id, orders.createdById))
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)));
  if (!row) return null;
  const [items, [debt], delivery] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        productId: products.id,
        name: products.name,
        currentPrice: products.salePrice,
        stockQty: products.stockQty,
        unitPrice: orderItems.unitPrice,
        quantity: orderItems.quantity,
        giftQty: orderItems.giftQty,
        leftoverQty: orderItems.leftoverQty,
        lineTotal: orderItems.lineTotal,
      })
      .from(orderItems)
      .innerJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, orderId))
      .orderBy(desc(orderItems.quantity), desc(orderItems.giftQty), asc(orderItems.id)),
    db.select({ debt: debtSumOrZero }).from(deliveries).where(eq(deliveries.customerId, row.customer.id)),
    row.order.deliveryId
      ? db
          .select({ id: deliveries.id, number: deliveries.number })
          .from(deliveries)
          .where(eq(deliveries.id, row.order.deliveryId))
      : Promise.resolve([]),
  ]);
  return { ...row, items, currentDebt: debt?.debt ?? "0", delivery: delivery[0] ?? null };
}
