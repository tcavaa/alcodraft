import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import {
  customers,
  deliveries,
  deliveryItems,
  financeEntries,
  orderItems,
  orders,
  products,
  stores,
  suppliers,
  users,
} from "@/server/db/schema";

const likeEscape = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

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
        sql<string>`sum(${deliveries.totalAmount} - ${deliveries.paidAmount} + ${deliveries.adjustmentAmount}) over (partition by ${deliveries.customerId} order by ${deliveries.id})`.as(
          "debt_after",
        ),
    })
    .from(deliveries)
    .where(eq(deliveries.storeId, storeId))
    .as("running");
}

export interface OperationListParams {
  q?: string;
  from?: string;
  to?: string;
  method?: "cash" | "card" | "back";
  kind?: "delivery" | "payment" | "adjustment";
  page: number;
  pageSize: number;
}

/** Old distribution/all — every operation of the store, newest first, paginated. */
export async function listOperations(storeId: number, p: OperationListParams) {
  const running = runningDeliveries(storeId);
  const conditions: (SQL | undefined)[] = [];
  if (p.q) {
    const like = likeEscape(p.q);
    conditions.push(
      or(ilike(customers.name, like), ilike(running.comment, like), sql`${running.number}::text = ${p.q}`),
    );
  }
  if (p.from) conditions.push(gte(running.date, p.from));
  if (p.to) conditions.push(lte(running.date, p.to));
  if (p.method) conditions.push(eq(running.method, p.method));
  if (p.kind === "adjustment") conditions.push(eq(running.kind, "adjustment"));
  if (p.kind === "payment") conditions.push(and(eq(running.kind, "delivery"), sql`${running.total} = 0`, sql`${running.paid} <> 0`));
  if (p.kind === "delivery") conditions.push(and(eq(running.kind, "delivery"), sql`not (${running.total} = 0 and ${running.paid} <> 0)`));
  const where = conditions.length ? and(...conditions) : undefined;

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
      .orderBy(desc(running.id))
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
        after: sql<string>`coalesce(sum(${deliveries.totalAmount} - ${deliveries.paidAmount} + ${deliveries.adjustmentAmount}), 0)`,
      })
      .from(deliveries)
      .where(and(eq(deliveries.customerId, delivery.customer.id), lte(deliveries.id, deliveryId))),
    db
      .select({ id: financeEntries.id, amountIn: financeEntries.amountIn, amountOut: financeEntries.amountOut, date: financeEntries.entryDate })
      .from(financeEntries)
      .where(eq(financeEntries.deliveryId, deliveryId)),
    db.select({ id: orders.id, number: orders.number }).from(orders).where(eq(orders.deliveryId, deliveryId)),
  ]);
  return { ...delivery, items, debtAfter: debt.after, cash, order: order ?? null };
}

export interface ProductOption {
  id: number;
  name: string;
  salePrice: string;
  stockQty: number;
  supplierName: string | null;
  isArchived: boolean;
}

/** Products for the line editors (active ones, plus any extra ids already on the document). */
export async function listProductOptions(storeId: number, includeIds: number[] = []): Promise<ProductOption[]> {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      salePrice: products.salePrice,
      stockQty: products.stockQty,
      supplierName: suppliers.name,
      isArchived: products.isArchived,
    })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(
      and(
        eq(products.storeId, storeId),
        includeIds.length ? or(eq(products.isArchived, false), inArray(products.id, includeIds)) : eq(products.isArchived, false),
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
      debt: sql<string>`sum(${deliveries.totalAmount} - ${deliveries.paidAmount} + ${deliveries.adjustmentAmount})`.as("debt"),
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

export interface OrderListParams {
  status: "open" | "history";
  q?: string;
  page: number;
  pageSize: number;
}

const customerDebtSql = sql<string>`(select coalesce(sum(d.total_amount - d.paid_amount + d.adjustment_amount), 0) from app.deliveries d where d.customer_id = ${customers.id})`;

/** Old orders/index (open) and orders/ordershistory (completed + cancelled). */
export async function listOrders(storeIds: number[], p: OrderListParams) {
  const conditions: (SQL | undefined)[] = [
    inArray(orders.storeId, storeIds.length ? storeIds : [0]),
    p.status === "open" ? eq(orders.status, "open") : sql`${orders.status} <> 'open'`,
  ];
  if (p.q) {
    const like = likeEscape(p.q);
    conditions.push(
      or(ilike(customers.name, like), ilike(customers.address, like), ilike(orders.comment, like), sql`${orders.number}::text = ${p.q}`),
    );
  }
  const where = and(...conditions);
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
        currentDebt: customerDebtSql,
      })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(stores, eq(stores.id, orders.storeId))
      .where(where)
      .orderBy(desc(orders.orderDate), desc(orders.id))
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
    db.select({ debt: customerDebtSql }).from(customers).where(eq(customers.id, row.customer.id)),
    row.order.deliveryId
      ? db
          .select({ id: deliveries.id, number: deliveries.number })
          .from(deliveries)
          .where(eq(deliveries.id, row.order.deliveryId))
      : Promise.resolve([]),
  ]);
  return { ...row, items, currentDebt: debt?.debt ?? "0", delivery: delivery[0] ?? null };
}

export async function countOpenOrders(storeId: number) {
  const [{ n }] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.status, "open")));
  return n;
}

