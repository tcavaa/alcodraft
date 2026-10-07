import "server-only";

import { and, asc, count, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import { financeEntries, products, stockReceiptItems, stockReceipts, suppliers, users } from "@/server/db/schema";

const likeEscape = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const receiptTotalsQuery = () =>
  db
  .select({
    receiptId: stockReceiptItems.receiptId,
    lines: sql<number>`count(*)::int`.as("lines"),
    quantity: sql<number>`sum(${stockReceiptItems.quantity})::int`.as("quantity"),
    cost: sql<string>`sum(${stockReceiptItems.quantity} * ${stockReceiptItems.unitCost})`.as("cost"),
  })
  .from(stockReceiptItems)
  .groupBy(stockReceiptItems.receiptId)
  .as("receipt_totals");

/** Old drinks/historylist — every stock receipt, newest first. */
export async function listReceipts(
  storeId: number,
  p: { supplierId?: number; from?: string; to?: string; q?: string; page: number; pageSize: number },
) {
  const receiptTotals = receiptTotalsQuery();
  const conditions: (SQL | undefined)[] = [eq(stockReceipts.storeId, storeId)];
  if (p.supplierId) conditions.push(eq(stockReceipts.supplierId, p.supplierId));
  if (p.from) conditions.push(gte(stockReceipts.receiptDate, p.from));
  if (p.to) conditions.push(lte(stockReceipts.receiptDate, p.to));
  if (p.q) {
    const like = likeEscape(p.q);
    conditions.push(or(ilike(stockReceipts.comment, like), ilike(suppliers.name, like), sql`${stockReceipts.number}::text = ${p.q}`));
  }
  const where = and(...conditions);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: stockReceipts.id,
        number: stockReceipts.number,
        date: stockReceipts.receiptDate,
        comment: stockReceipts.comment,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
        lines: receiptTotals.lines,
        quantity: receiptTotals.quantity,
        cost: sql<string>`coalesce(${receiptTotals.cost}, 0)`,
      })
      .from(stockReceipts)
      .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
      .leftJoin(receiptTotals, eq(receiptTotals.receiptId, stockReceipts.id))
      .where(where)
      .orderBy(desc(stockReceipts.number))
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    db
      .select({ total: count() })
      .from(stockReceipts)
      .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
      .where(where),
  ]);
  return { rows, total };
}

/** Old drinks/history/{id}. */
export async function getReceipt(storeId: number, receiptId: number) {
  const [row] = await db
    .select({ receipt: stockReceipts, supplierName: suppliers.name, createdBy: users.name })
    .from(stockReceipts)
    .leftJoin(suppliers, eq(suppliers.id, stockReceipts.supplierId))
    .leftJoin(users, eq(users.id, stockReceipts.createdById))
    .where(and(eq(stockReceipts.id, receiptId), eq(stockReceipts.storeId, storeId)));
  if (!row) return null;
  const items = await db
    .select({
      id: stockReceiptItems.id,
      productId: products.id,
      name: products.name,
      currentPurchasePrice: products.purchasePrice,
      quantity: stockReceiptItems.quantity,
      unitCost: stockReceiptItems.unitCost,
      stockBefore: stockReceiptItems.stockBefore,
    })
    .from(stockReceiptItems)
    .innerJoin(products, eq(products.id, stockReceiptItems.productId))
    .where(eq(stockReceiptItems.receiptId, receiptId))
    .orderBy(asc(stockReceiptItems.id));
  return { ...row, items };
}

export interface ReceiveProduct {
  id: number;
  name: string;
  stockQty: number;
  purchasePrice: string;
  supplierId: number | null;
}

/** Products offered on the receipt form (old drinks/stock/{supplier}; "returns" shows all). */
export async function listReceiveProducts(storeId: number): Promise<ReceiveProduct[]> {
  return db
    .select({
      id: products.id,
      name: products.name,
      stockQty: products.stockQty,
      purchasePrice: products.purchasePrice,
      supplierId: products.supplierId,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.isArchived, false)))
    .orderBy(asc(products.id));
}

// ── Suppliers ───────────────────────────────────────────────────────────────

const supplierPayableQuery = () =>
  db
  .select({
    supplierId: stockReceipts.supplierId,
    payable: sql<string>`sum(${stockReceiptItems.quantity} * ${stockReceiptItems.unitCost})`.as("payable"),
    receipts: sql<number>`count(distinct ${stockReceipts.id})::int`.as("receipts"),
    lastDate: sql<string>`max(${stockReceipts.receiptDate})`.as("last_date"),
  })
  .from(stockReceipts)
  .innerJoin(stockReceiptItems, eq(stockReceiptItems.receiptId, stockReceipts.id))
  .groupBy(stockReceipts.supplierId)
  .as("supplier_payable");

const supplierPaidQuery = () =>
  db
  .select({
    supplierId: financeEntries.supplierId,
    paid: sql<string>`sum(${financeEntries.amountOut})`.as("paid"),
  })
  .from(financeEntries)
  .groupBy(financeEntries.supplierId)
  .as("supplier_paid");

/** Old momwodebeli/index, now with what is owed to each supplier. */
export async function listSuppliers(storeId: number, archived: boolean) {
  const supplierPayable = supplierPayableQuery();
  const supplierPaid = supplierPaidQuery();
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      isReturns: suppliers.isReturns,
      payable: sql<string>`coalesce(${supplierPayable.payable}, 0)`,
      paid: sql<string>`coalesce(${supplierPaid.paid}, 0)`,
      receipts: sql<number>`coalesce(${supplierPayable.receipts}, 0)`,
      lastDate: supplierPayable.lastDate,
    })
    .from(suppliers)
    .leftJoin(supplierPayable, eq(supplierPayable.supplierId, suppliers.id))
    .leftJoin(supplierPaid, eq(supplierPaid.supplierId, suppliers.id))
    .where(and(eq(suppliers.storeId, storeId), eq(suppliers.isArchived, archived)))
    .orderBy(asc(suppliers.name));
}

export async function countSuppliers(storeId: number) {
  const rows = await db
    .select({ archived: suppliers.isArchived, n: count() })
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId))
    .groupBy(suppliers.isArchived);
  return { active: rows.find((r) => !r.archived)?.n ?? 0, archived: rows.find((r) => r.archived)?.n ?? 0 };
}

/** Old drinks/historylistmomw: receipts to pay for, payments made, what is left. */
export async function getSupplier(storeId: number, supplierId: number) {
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)));
  if (!supplier) return null;
  const receiptTotals = receiptTotalsQuery();
  const [receipts, payments] = await Promise.all([
    db
      .select({
        id: stockReceipts.id,
        number: stockReceipts.number,
        date: stockReceipts.receiptDate,
        comment: stockReceipts.comment,
        lines: receiptTotals.lines,
        cost: sql<string>`coalesce(${receiptTotals.cost}, 0)`,
      })
      .from(stockReceipts)
      .leftJoin(receiptTotals, eq(receiptTotals.receiptId, stockReceipts.id))
      .where(eq(stockReceipts.supplierId, supplierId))
      .orderBy(desc(stockReceipts.number)),
    db
      .select({
        id: financeEntries.id,
        date: financeEntries.entryDate,
        amountOut: financeEntries.amountOut,
        amountIn: financeEntries.amountIn,
        note: financeEntries.note,
      })
      .from(financeEntries)
      .where(eq(financeEntries.supplierId, supplierId))
      .orderBy(desc(financeEntries.id)),
  ]);
  return { supplier, receipts, payments };
}
