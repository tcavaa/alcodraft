import { boolean, date, index, integer, text, uniqueIndex } from "drizzle-orm/pg-core";

import { app, createdAt, customerColor, id, money, timestamps } from "./_shared";
import { stores, users } from "./auth";

/** Old: `momwodebeli`. */
export const suppliers = app
  .table(
    "suppliers",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      name: text().notNull(),
      /**
       * The "returned goods" supplier (old: id 4 "დაბრუნებული (არ წაშალოთ)").
       * Its stock-receipt form lists every product instead of only this supplier's.
       */
      isReturns: boolean().notNull().default(false),
      isArchived: boolean().notNull().default(false),
      legacyId: integer(),
      ...timestamps(),
    },
    (t) => [index().on(t.storeId, t.isArchived), uniqueIndex().on(t.storeId, t.legacyId)],
  )
  .enableRLS();

/** Old: `drinks`. `stockQty` is the live warehouse count (old `count`). */
export const products = app
  .table(
    "products",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      supplierId: integer().references(() => suppliers.id, { onDelete: "set null" }),
      name: text().notNull(),
      /** Default selling price (old `base_price`). */
      salePrice: money().notNull().default("0"),
      /** Default purchase price (old `shemotan_price`). */
      purchasePrice: money().notNull().default("0"),
      stockQty: integer().notNull().default(0),
      comment: text().notNull().default(""),
      isArchived: boolean().notNull().default(false),
      legacyId: integer(),
      ...timestamps(),
    },
    (t) => [
      index().on(t.storeId, t.isArchived),
      index().on(t.supplierId),
      uniqueIndex().on(t.storeId, t.legacyId),
    ],
  )
  .enableRLS();

/** Old: `drinks_edited` — the prices a product had before each edit. */
export const productPriceChanges = app
  .table(
    "product_price_changes",
    {
      id: id(),
      productId: integer()
        .notNull()
        .references(() => products.id, { onDelete: "cascade" }),
      oldSalePrice: money().notNull(),
      oldPurchasePrice: money().notNull(),
      /** Not recorded by the old system; filled for changes made in the new one. */
      newSalePrice: money(),
      newPurchasePrice: money(),
      changedOn: date({ mode: "string" }).notNull(),
      changedById: integer().references(() => users.id, { onDelete: "set null" }),
      createdAt: createdAt(),
    },
    (t) => [index().on(t.productId)],
  )
  .enableRLS();

/** Old: `company` (shops and restaurants the store sells to). */
export const customers = app
  .table(
    "customers",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      name: text().notNull(),
      address: text().notNull().default(""),
      /** Old `ident` (საიდენტიფიკაციო ნომერი). */
      taxId: text().notNull().default(""),
      /** Old `number`. */
      phone: text().notNull().default(""),
      /** Old `contact` (საკონტაქტო პირი). */
      contactPerson: text().notNull().default(""),
      comment: text().notNull().default(""),
      color: customerColor(),
      isArchived: boolean().notNull().default(false),
      legacyId: integer(),
      ...timestamps(),
    },
    (t) => [index().on(t.storeId, t.isArchived), uniqueIndex().on(t.storeId, t.legacyId)],
  )
  .enableRLS();
