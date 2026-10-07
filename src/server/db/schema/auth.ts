import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

import { app, createdAt, id, passwordScheme, timestamps, userRole } from "./_shared";

/** A store/branch (old: one copy of every table per branch + the `names` table). */
export const stores = app
  .table("stores", {
    id: id(),
    name: text().notNull(),
    sortOrder: integer().notNull().default(0),
    isArchived: boolean().notNull().default(false),
    // Per-store document counters (deliveries keep their old numbers after import).
    nextDeliveryNumber: integer().notNull().default(1),
    nextOrderNumber: integer().notNull().default(1),
    nextReceiptNumber: integer().notNull().default(1),
    /** Which legacy table set this store was imported from, e.g. "set1". */
    legacyKey: varchar({ length: 32 }).unique(),
    ...timestamps(),
  })
  .enableRLS();

export const users = app
  .table("users", {
    id: id(),
    /** Always stored lower-cased. */
    email: varchar({ length: 254 }).notNull().unique(),
    name: text().notNull().default(""),
    passwordHash: text().notNull(),
    passwordScheme: passwordScheme().notNull().default("bcrypt"),
    role: userRole().notNull().default("user"),
    isActive: boolean().notNull().default(true),
    lastLoginAt: timestamp({ withTimezone: true, mode: "date" }),
    passwordChangedAt: timestamp({ withTimezone: true, mode: "date" }),
    ...timestamps(),
  })
  .enableRLS();

/** Which stores a regular user may open. Super admins can open every store. */
export const userStores = app
  .table(
    "user_stores",
    {
      userId: integer()
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
      storeId: integer()
        .notNull()
        .references(() => stores.id, { onDelete: "cascade" }),
      createdAt: createdAt(),
    },
    (t) => [primaryKey({ columns: [t.userId, t.storeId] }), index().on(t.storeId)],
  )
  .enableRLS();

/** Server-side sessions. The cookie holds a random token; only its SHA-256 is stored. */
export const sessions = app
  .table(
    "sessions",
    {
      id: varchar({ length: 64 }).primaryKey(),
      userId: integer()
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
      expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
      lastSeenAt: timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow(),
      ipAddress: varchar({ length: 64 }),
      userAgent: varchar({ length: 400 }),
      createdAt: createdAt(),
    },
    (t) => [index().on(t.userId), index().on(t.expiresAt)],
  )
  .enableRLS();

/** Who changed what. Written by every mutation that touches money, stock or access. */
export const auditLog = app
  .table(
    "audit_log",
    {
      id: bigint({ mode: "number" }).primaryKey().generatedByDefaultAsIdentity(),
      storeId: integer().references(() => stores.id, { onDelete: "set null" }),
      userId: integer().references(() => users.id, { onDelete: "set null" }),
      /** e.g. "delivery.create", "user.reset_password" */
      action: varchar({ length: 64 }).notNull(),
      entityType: varchar({ length: 64 }).notNull(),
      entityId: integer(),
      summary: text().notNull().default(""),
      details: jsonb(),
      createdAt: createdAt(),
    },
    (t) => [index().on(t.storeId, t.createdAt), index().on(t.entityType, t.entityId)],
  )
  .enableRLS();
