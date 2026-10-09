import "server-only";

import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { db } from "@/server/db";
import { cashSumOrZero, debtSum } from "@/server/db/expressions";
import { customers, deliveries, deliveryItems, financeAccounts, financeEntries, orders, products } from "@/server/db/schema";

import { type TopPeriod, topPeriodStart } from "./top-periods";

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

export async function getOutOfStock(storeId: number, limit = 8) {
  return db
    .select({ id: products.id, name: products.name, stock: products.stockQty })
    .from(products)
    .where(
      and(eq(products.storeId, storeId), eq(products.isArchived, false), eq(products.isActive, true), lte(products.stockQty, 0)),
    )
    .orderBy(asc(products.stockQty), asc(products.name))
    .limit(limit);
}

/**
 * Best sellers by units delivered („შეტანილი“) in the period, most first; gifts are shown but not
 * ranked. No `limit` = every product sold in the period.
 */
export async function getTopProducts(storeId: number, today: string, period: TopPeriod, limit?: number) {
  const quantity = sql<number>`sum(${deliveryItems.quantity})::int`;
  const query = db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stockQty,
      quantity,
      gifts: sql<number>`sum(${deliveryItems.giftQty})::int`,
      total: sql<string>`sum(${deliveryItems.lineTotal})`,
    })
    .from(deliveryItems)
    .innerJoin(deliveries, eq(deliveries.id, deliveryItems.deliveryId))
    .innerJoin(products, eq(products.id, deliveryItems.productId))
    .where(
      and(
        eq(deliveries.storeId, storeId),
        gte(deliveries.deliveryDate, topPeriodStart(today, period)),
        // Statistics leave out inactive and trashed products.
        eq(products.isActive, true),
        eq(products.isArchived, false),
      ),
    )
    .groupBy(products.id)
    .having(sql`sum(${deliveryItems.quantity}) > 0`)
    .orderBy(desc(quantity), asc(products.name))
    .$dynamic();
  return limit ? query.limit(limit) : query;
}

/**
 * Customers by money received in the period („აღებული თანხა“, cash and card — „დაბრუნება“
 * (`back`) is settled with returned goods, not money). Also their sales in the period and current
 * debt. No `limit` = every customer who paid something.
 */
export async function getTopCustomers(storeId: number, today: string, period: TopPeriod, limit?: number) {
  const debts = db
    .select({ customerId: deliveries.customerId, debt: debtSum.as("debt") })
    .from(deliveries)
    .where(eq(deliveries.storeId, storeId))
    .groupBy(deliveries.customerId)
    .as("debts");
  const received = sql<string>`coalesce(sum(${deliveries.paidAmount}) filter (where ${deliveries.paymentMethod} is distinct from 'back'), 0)`;
  const query = db
    .select({
      id: customers.id,
      name: customers.name,
      address: customers.address,
      isArchived: customers.isArchived,
      received,
      sales: sql<string>`coalesce(sum(${deliveries.totalAmount}), 0)`,
      operations: sql<number>`(count(*) filter (where ${deliveries.kind} = 'delivery' and ${deliveries.totalAmount} <> 0))::int`,
      debt: sql<string>`coalesce(max(${debts.debt}), 0)`,
    })
    .from(deliveries)
    .innerJoin(customers, eq(customers.id, deliveries.customerId))
    .leftJoin(debts, eq(debts.customerId, customers.id))
    .where(and(eq(deliveries.storeId, storeId), gte(deliveries.deliveryDate, topPeriodStart(today, period))))
    .groupBy(customers.id)
    .having(sql`${received} > 0`)
    .orderBy(desc(received), asc(customers.name))
    .$dynamic();
  return limit ? query.limit(limit) : query;
}
