import "server-only";

import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { cashSumOrZero, debtSum } from "@/server/db/expressions";
import { customers, deliveries, deliveryItems, financeAccounts, financeEntries, orders, products } from "@/server/db/schema";

/** Σ(total − paid + correction) — a customer's debt, the old `darchenili`. */

export interface StoreKpis {
  todayCount: number;
  todayTotal: string;
  todayPaid: string;
  monthTotal: string;
  monthPaid: string;
  receivable: string;
  credit: string;
  cashBalance: string;
  openOrders: number;
}

const emptyKpis = (): StoreKpis => ({
  todayCount: 0,
  todayTotal: "0",
  todayPaid: "0",
  monthTotal: "0",
  monthPaid: "0",
  receivable: "0",
  credit: "0",
  cashBalance: "0",
  openOrders: 0,
});

/** Headline numbers for several stores at once (a handful of grouped queries). */
export async function getStoreKpis(storeIds: number[], today: string): Promise<Map<number, StoreKpis>> {
  const result = new Map(storeIds.map((id) => [id, emptyKpis()]));
  if (storeIds.length === 0) return result;
  const monthStart = `${today.slice(0, 7)}-01`;

  const perCustomer = db
    .select({ storeId: deliveries.storeId, debt: debtSum.as("debt") })
    .from(deliveries)
    .innerJoin(customers, eq(customers.id, deliveries.customerId))
    .where(and(inArray(deliveries.storeId, storeIds), eq(customers.isArchived, false)))
    .groupBy(deliveries.storeId, deliveries.customerId)
    .as("per_customer");

  const [sales, debts, cash, open] = await Promise.all([
    db
      .select({
        storeId: deliveries.storeId,
        todayCount: sql<number>`(count(*) filter (where ${deliveries.deliveryDate} = ${today} and ${deliveries.kind} = 'delivery'))::int`,
        todayTotal: sql<string>`coalesce(sum(${deliveries.totalAmount}) filter (where ${deliveries.deliveryDate} = ${today}), 0)`,
        todayPaid: sql<string>`coalesce(sum(${deliveries.paidAmount}) filter (where ${deliveries.deliveryDate} = ${today}), 0)`,
        monthTotal: sql<string>`coalesce(sum(${deliveries.totalAmount}), 0)`,
        monthPaid: sql<string>`coalesce(sum(${deliveries.paidAmount}), 0)`,
      })
      .from(deliveries)
      .where(and(inArray(deliveries.storeId, storeIds), gte(deliveries.deliveryDate, monthStart)))
      .groupBy(deliveries.storeId),
    db
      .select({
        storeId: perCustomer.storeId,
        receivable: sql<string>`coalesce(sum(${perCustomer.debt}) filter (where ${perCustomer.debt} > 0), 0)`,
        credit: sql<string>`coalesce(sum(${perCustomer.debt}) filter (where ${perCustomer.debt} < 0), 0)`,
      })
      .from(perCustomer)
      .groupBy(perCustomer.storeId),
    db
      .select({
        storeId: financeAccounts.storeId,
        balance: cashSumOrZero,
      })
      .from(financeAccounts)
      .leftJoin(financeEntries, eq(financeEntries.accountId, financeAccounts.id))
      .where(and(inArray(financeAccounts.storeId, storeIds), eq(financeAccounts.isDefault, true)))
      .groupBy(financeAccounts.storeId),
    db
      .select({ storeId: orders.storeId, n: count() })
      .from(orders)
      .where(and(inArray(orders.storeId, storeIds), eq(orders.status, "open")))
      .groupBy(orders.storeId),
  ]);

  for (const r of sales) Object.assign(result.get(r.storeId)!, r);
  for (const r of debts) Object.assign(result.get(r.storeId)!, { receivable: r.receivable, credit: r.credit });
  for (const r of cash) result.get(r.storeId)!.cashBalance = r.balance;
  for (const r of open) result.get(r.storeId)!.openOrders = r.n;
  return result;
}

/** Sales per month for the chart (last `months` months including the current one). */
export async function getMonthlySales(storeId: number, today: string, months = 12) {
  const [y, m] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1 - (months - 1), 1)).toISOString().slice(0, 10);
  const rows = await db
    .select({
      month: sql<string>`to_char(${deliveries.deliveryDate}, 'YYYY-MM')`,
      total: sql<string>`coalesce(sum(${deliveries.totalAmount}), 0)`,
      paid: sql<string>`coalesce(sum(${deliveries.paidAmount}), 0)`,
    })
    .from(deliveries)
    .where(and(eq(deliveries.storeId, storeId), gte(deliveries.deliveryDate, start)))
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  return Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (months - 1) + i, 1));
    const key = d.toISOString().slice(0, 7);
    return { month: key, total: byMonth.get(key)?.total ?? "0", paid: byMonth.get(key)?.paid ?? "0" };
  });
}

export async function getRecentDeliveries(storeId: number, limit = 8) {
  return db
    .select({
      id: deliveries.id,
      number: deliveries.number,
      kind: deliveries.kind,
      date: deliveries.deliveryDate,
      total: deliveries.totalAmount,
      paid: deliveries.paidAmount,
      adjustment: deliveries.adjustmentAmount,
      method: deliveries.paymentMethod,
      customerId: customers.id,
      customerName: customers.name,
    })
    .from(deliveries)
    .innerJoin(customers, eq(customers.id, deliveries.customerId))
    .where(eq(deliveries.storeId, storeId))
    .orderBy(desc(deliveries.id))
    .limit(limit);
}

export async function getTopDebtors(storeId: number, limit = 6) {
  const debt = debtSum;
  return db
    .select({ id: customers.id, name: customers.name, color: customers.color, debt })
    .from(deliveries)
    .innerJoin(customers, eq(customers.id, deliveries.customerId))
    .where(and(eq(deliveries.storeId, storeId), eq(customers.isArchived, false)))
    .groupBy(customers.id)
    .having(sql`${debt} > 0`)
    .orderBy(desc(debt))
    .limit(limit);
}

export async function getOutOfStock(storeId: number, limit = 8) {
  return db
    .select({ id: products.id, name: products.name, stock: products.stockQty })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isArchived, false), lte(products.stockQty, 0)))
    .orderBy(asc(products.stockQty), asc(products.name))
    .limit(limit);
}

/** Best sellers by units delivered over the last `days` days (today included); gifts not counted. */
export async function getTopProducts(storeId: number, today: string, days = 30, limit = 8) {
  const [y, m, d] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d - (days - 1))).toISOString().slice(0, 10);
  const quantity = sql<number>`sum(${deliveryItems.quantity})::int`;
  return db
    .select({
      id: products.id,
      name: products.name,
      quantity,
      total: sql<string>`sum(${deliveryItems.lineTotal})`,
    })
    .from(deliveryItems)
    .innerJoin(deliveries, eq(deliveries.id, deliveryItems.deliveryId))
    .innerJoin(products, eq(products.id, deliveryItems.productId))
    .where(and(eq(deliveries.storeId, storeId), gte(deliveries.deliveryDate, start)))
    .groupBy(products.id)
    .having(sql`sum(${deliveryItems.quantity}) > 0`)
    .orderBy(desc(quantity), asc(products.name))
    .limit(limit);
}
