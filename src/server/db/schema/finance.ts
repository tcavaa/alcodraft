import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { app, createdAt, financeEntryKind, id, money, timestamps } from "./_shared";
import { stores, users } from "./auth";
import { suppliers } from "./catalog";
import { deliveries } from "./sales";

/**
 * A store's cash book. Every store has exactly one default account, which
 * receives the automatic entries (customer payments, supplier and wage
 * payments). Stores 1 and 2 also have the old "ფინანსები 2" book.
 */
export const financeAccounts = app
  .table(
    "finance_accounts",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      name: text().notNull(),
      isDefault: boolean().notNull().default(false),
      isArchived: boolean().notNull().default(false),
      sortOrder: integer().notNull().default(0),
      /** Old table this book was imported from, e.g. "finance3". */
      legacyTable: varchar({ length: 32 }),
      ...timestamps(),
    },
    (t) => [
      index().on(t.storeId),
      uniqueIndex("finance_accounts_one_default_per_store")
        .on(t.storeId)
        .where(sql`${t.isDefault}`),
    ],
  )
  .enableRLS();

/**
 * Old: `finance` (and its per-store copies). The balance is NOT stored: after
 * any entry it is SUM(amount_in - amount_out + adjustment_amount) over the
 * account ordered by id — the old `balance = previous - money + darchenili`.
 */
export const financeEntries = app
  .table(
    "finance_entries",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      accountId: integer()
        .notNull()
        .references(() => financeAccounts.id),
      entryDate: date({ mode: "string" }).notNull(),
      kind: financeEntryKind().notNull().default("manual"),
      /** Income (შემოსავალი, old `darchenili`). */
      amountIn: money().notNull().default("0"),
      /** Expense (ხარჯი, old `money`). */
      amountOut: money().notNull().default("0"),
      adjustmentAmount: money().notNull().default("0"),
      /** Old `comment` (e.g. customer name + payment method). */
      description: text().notNull().default(""),
      /** Old `comment2`. */
      note: text().notNull().default(""),
      deliveryId: integer().references(() => deliveries.id, { onDelete: "set null" }),
      supplierId: integer().references(() => suppliers.id, { onDelete: "set null" }),
      employeeId: integer().references(() => employees.id, { onDelete: "set null" }),
      legacyId: integer(),
      legacy: jsonb(),
      createdById: integer().references(() => users.id, { onDelete: "set null" }),
      createdAt: createdAt(),
    },
    (t) => [
      index().on(t.accountId, t.id),
      index().on(t.storeId, t.entryDate),
      index().on(t.supplierId),
      index().on(t.employeeId),
      index().on(t.deliveryId),
    ],
  )
  .enableRLS();

/** Old: `employees`. `wageBalance` = wages owed and not yet paid (old `wage`). */
export const employees = app
  .table(
    "employees",
    {
      id: id(),
      storeId: integer()
        .notNull()
        .references(() => stores.id),
      name: text().notNull(),
      wageBalance: money().notNull().default("0"),
      isArchived: boolean().notNull().default(false),
      legacyId: integer(),
      ...timestamps(),
    },
    (t) => [index().on(t.storeId, t.isArchived)],
  )
  .enableRLS();

/** Old: `wages_history` — wages added to an employee's balance. */
export const wageAccruals = app
  .table(
    "wage_accruals",
    {
      id: id(),
      employeeId: integer()
        .notNull()
        .references(() => employees.id, { onDelete: "cascade" }),
      accrualDate: date({ mode: "string" }).notNull(),
      amount: money().notNull(),
      comment: text().notNull().default(""),
      createdById: integer().references(() => users.id, { onDelete: "set null" }),
      createdAt: createdAt(),
    },
    (t) => [index().on(t.employeeId)],
  )
  .enableRLS();
