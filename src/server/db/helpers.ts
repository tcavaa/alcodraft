import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { dec, type Decimal } from "@/lib/money";
import { ActionError } from "@/server/action";

import type { DbOrTx, Tx } from "./index";
import { customers, deliveries, financeAccounts, products, stores } from "./schema";

type Counter = "delivery" | "order" | "receipt";

/** Next per-store document number (atomic: the store row is locked by the UPDATE). */
export async function nextNumber(tx: Tx, storeId: number, counter: Counter): Promise<number> {
  const column = {
    delivery: stores.nextDeliveryNumber,
    order: stores.nextOrderNumber,
    receipt: stores.nextReceiptNumber,
  }[counter];
  const key = { delivery: "nextDeliveryNumber", order: "nextOrderNumber", receipt: "nextReceiptNumber" }[counter];
  const [row] = await tx
    .update(stores)
    .set({ [key]: sql`${column} + 1` })
    .where(eq(stores.id, storeId))
    .returning({ next: column });
  if (!row) throw new ActionError("მაღაზია ვერ მოიძებნა.");
  return row.next - 1;
}

/** The store's default cash book (receives automatic entries). */
export async function defaultAccountId(dbx: DbOrTx, storeId: number): Promise<number> {
  const [row] = await dbx
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(and(eq(financeAccounts.storeId, storeId), eq(financeAccounts.isDefault, true)))
    .limit(1);
  if (row) return row.id;
  const [fallback] = await dbx
    .select({ id: financeAccounts.id })
    .from(financeAccounts)
    .where(eq(financeAccounts.storeId, storeId))
    .orderBy(asc(financeAccounts.sortOrder), asc(financeAccounts.id))
    .limit(1);
  if (!fallback) throw new ActionError("მაღაზიას სალარო არ აქვს.");
  return fallback.id;
}

/** Current debt of a customer = Σ(total − paid + correction) over all operations. */
export async function customerDebt(dbx: DbOrTx, customerId: number): Promise<Decimal> {
  const [row] = await dbx
    .select({
      debt: sql<string>`coalesce(sum(${deliveries.totalAmount} - ${deliveries.paidAmount} + ${deliveries.adjustmentAmount}), 0)`,
    })
    .from(deliveries)
    .where(eq(deliveries.customerId, customerId));
  return dec(row?.debt);
}

export async function requireCustomerInStore(dbx: DbOrTx, storeId: number, customerId: number) {
  const [row] = await dbx
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)))
    .limit(1);
  if (!row) throw new ActionError("კლიენტი ვერ მოიძებნა.");
  return row;
}

/**
 * Locks the given products of the store (FOR UPDATE) for the rest of the
 * transaction and returns them by id. Throws if any id is not in the store.
 */
export async function lockProducts(tx: Tx, storeId: number, productIds: number[]) {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return new Map<number, typeof products.$inferSelect>();
  const rows = await tx
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), inArray(products.id, ids)))
    .orderBy(asc(products.id))
    .for("update");
  if (rows.length !== ids.length) throw new ActionError("ზოგიერთი პროდუქტი ვერ მოიძებნა ამ მაღაზიაში.");
  return new Map(rows.map((r) => [r.id, r]));
}

/** Applies stock changes (delta per product id; negative = out of the warehouse). */
export async function applyStockDeltas(tx: Tx, deltas: Map<number, number>): Promise<void> {
  for (const [productId, delta] of deltas) {
    if (delta === 0) continue;
    await tx
      .update(products)
      .set({ stockQty: sql`${products.stockQty} + ${delta}` })
      .where(eq(products.id, productId));
  }
}
