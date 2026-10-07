import "server-only";

import { and, eq } from "drizzle-orm";

import { todayIso } from "@/lib/dates";
import { type Decimal, formatAmount, sum, toDb } from "@/lib/money";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import type { Tx } from "@/server/db";
import { applyStockDeltas, lockProducts, nextNumber } from "@/server/db/helpers";
import { stockReceiptItems, stockReceipts, suppliers } from "@/server/db/schema";

import type { Actor } from "../sales/service";

export interface ReceiptLine {
  productId: number;
  quantity: number;
  unitCost: Decimal;
}

/**
 * Old drinks/stock: each product's count grows by the received quantity; the
 * receipt remembers the count before and the purchase price paid. The product's
 * default purchase price is NOT changed (the old app highlighted differences instead).
 */
export async function createReceipt(
  tx: Tx,
  actor: Actor,
  input: { supplierId: number | null; lines: ReceiptLine[]; comment: string },
) {
  const lines = input.lines.filter((l) => l.quantity !== 0);
  if (lines.length === 0) throw new ActionError("შეიყვანეთ მიღებული რაოდენობა მინიმუმ ერთ პროდუქტზე.");
  if (input.supplierId !== null) {
    const [supplier] = await tx
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.id, input.supplierId), eq(suppliers.storeId, actor.storeId)));
    if (!supplier) throw new ActionError("მომწოდებელი ვერ მოიძებნა.");
  }
  const productsById = await lockProducts(
    tx,
    actor.storeId,
    lines.map((l) => l.productId),
  );
  const number = await nextNumber(tx, actor.storeId, "receipt");
  const [receipt] = await tx
    .insert(stockReceipts)
    .values({
      storeId: actor.storeId,
      supplierId: input.supplierId,
      number,
      receiptDate: todayIso(),
      comment: input.comment,
      createdById: actor.userId,
    })
    .returning({ id: stockReceipts.id });

  const running = new Map<number, number>();
  await tx.insert(stockReceiptItems).values(
    lines.map((l) => {
      const before = running.get(l.productId) ?? productsById.get(l.productId)!.stockQty;
      running.set(l.productId, before + l.quantity);
      return {
        receiptId: receipt.id,
        productId: l.productId,
        quantity: l.quantity,
        unitCost: toDb(l.unitCost),
        stockBefore: before,
      };
    }),
  );
  const deltas = new Map<number, number>();
  for (const l of lines) deltas.set(l.productId, (deltas.get(l.productId) ?? 0) + l.quantity);
  await applyStockDeltas(tx, deltas);

  const total = sum(lines.map((l) => l.unitCost.times(l.quantity)));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "receipt.create",
    entityType: "receipt",
    entityId: receipt.id,
    summary: `მიღება #${number}: ${lines.length} პროდუქტი, ${formatAmount(total)} ₾`,
  });
  return { id: receipt.id, number };
}

/** Removes a receipt and takes its quantities back out of stock. */
export async function deleteReceipt(tx: Tx, actor: Actor, receiptId: number) {
  const [receipt] = await tx
    .select()
    .from(stockReceipts)
    .where(and(eq(stockReceipts.id, receiptId), eq(stockReceipts.storeId, actor.storeId)))
    .for("update");
  if (!receipt) throw new ActionError("მიღება ვერ მოიძებნა.");
  const items = await tx.select().from(stockReceiptItems).where(eq(stockReceiptItems.receiptId, receiptId));
  const deltas = new Map<number, number>();
  for (const i of items) deltas.set(i.productId, (deltas.get(i.productId) ?? 0) - i.quantity);
  await lockProducts(tx, actor.storeId, [...deltas.keys()]);
  await applyStockDeltas(tx, deltas);
  await tx.delete(stockReceipts).where(eq(stockReceipts.id, receiptId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "receipt.delete",
    entityType: "receipt",
    entityId: receiptId,
    summary: `წაიშალა მიღება #${receipt.number} (${items.length} პროდუქტი)`,
    details: { receipt, items },
  });
}
