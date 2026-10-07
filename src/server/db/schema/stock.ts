import { bigint, date, index, integer, text, uniqueIndex } from "drizzle-orm/pg-core";

import { app, createdAt, id, money } from "./_shared";
import { stores, users } from "./auth";
import { products, suppliers } from "./catalog";

/** Old: `drinks_history` (one receipt = one batch id of that table). */
export const stockReceipts = app
  .table(
    "stock_receipts",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      supplierId: integer().references(() => suppliers.id, { onDelete: "set null" }),
      number: integer().notNull(),
      receiptDate: date({ mode: "string" }).notNull(),
      comment: text().notNull().default(""),
      /** Batch id in the old `drinks_history` table. */
      legacyBatchId: bigint({ mode: "number" }),
      createdById: integer().references(() => users.id, { onDelete: "set null" }),
      createdAt: createdAt(),
    },
    (t) => [
      uniqueIndex().on(t.storeId, t.number),
      index().on(t.supplierId),
      index().on(t.storeId, t.receiptDate),
    ],
  )
  .enableRLS();

export const stockReceiptItems = app
  .table(
    "stock_receipt_items",
    {
      id: id(),
      receiptId: integer()
        .notNull()
        .references(() => stockReceipts.id, { onDelete: "cascade" }),
      productId: integer()
        .notNull()
        .references(() => products.id),
      /** Old `drink_in`. */
      quantity: integer().notNull(),
      /** Purchase price paid in this receipt (old `shemotan_price`). */
      unitCost: money().notNull().default("0"),
      /** Warehouse count right before this receipt (old `drink_count`). */
      stockBefore: integer(),
    },
    (t) => [index().on(t.receiptId), index().on(t.productId)],
  )
  .enableRLS();

/** Manual stock corrections (inventory counts). New — the old system edited the DB directly. */
export const stockAdjustments = app
  .table(
    "stock_adjustments",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      productId: integer()
        .notNull()
        .references(() => products.id),
      quantityDelta: integer().notNull(),
      stockBefore: integer().notNull(),
      reason: text().notNull().default(""),
      createdById: integer().references(() => users.id, { onDelete: "set null" }),
      createdAt: createdAt(),
    },
    (t) => [index().on(t.productId), index().on(t.storeId, t.createdAt)],
  )
  .enableRLS();
