import "server-only";

import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import type { SortState } from "@/lib/sort";
import { db } from "@/server/db";
import { likePattern } from "@/server/db/expressions";
import { by } from "@/server/db/order";
import { auditLog, customers, deliveries, products, stores, userStores, users } from "@/server/db/schema";

export async function listStoresAdmin() {
  const [rows, userCounts, customerCounts, productCounts, deliveryStats] = await Promise.all([
    db.select().from(stores).orderBy(asc(stores.isArchived), asc(stores.sortOrder), asc(stores.id)),
    db.select({ storeId: userStores.storeId, n: count() }).from(userStores).groupBy(userStores.storeId),
    db.select({ storeId: customers.storeId, n: count() }).from(customers).groupBy(customers.storeId),
    db.select({ storeId: products.storeId, n: count() }).from(products).groupBy(products.storeId),
    db
      .select({ storeId: deliveries.storeId, n: count(), last: sql<string | null>`max(${deliveries.deliveryDate})` })
      .from(deliveries)
      .groupBy(deliveries.storeId),
  ]);
  const by = <T extends { storeId: number }>(list: T[]) => new Map(list.map((r) => [r.storeId, r]));
  const u = by(userCounts);
  const c = by(customerCounts);
  const p = by(productCounts);
  const d = by(deliveryStats);
  return rows.map((s) => ({
    ...s,
    users: u.get(s.id)?.n ?? 0,
    customers: c.get(s.id)?.n ?? 0,
    products: p.get(s.id)?.n ?? 0,
    operations: d.get(s.id)?.n ?? 0,
    lastOperation: d.get(s.id)?.last ?? null,
  }));
}

export async function getStoreAdmin(storeId: number) {
  const [store] = await db.select().from(stores).where(eq(stores.id, storeId));
  return store ?? null;
}

/** Active users first, then by e-mail. */
export async function listUsersAdmin() {
  return db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      passwordScheme: users.passwordScheme,
      storeNames: sql<string[]>`coalesce(array_agg(${stores.name} order by ${stores.sortOrder}) filter (where ${stores.id} is not null), '{}')`,
    })
    .from(users)
    .leftJoin(userStores, eq(userStores.userId, users.id))
    .leftJoin(stores, eq(stores.id, userStores.storeId))
    .groupBy(users.id)
    .orderBy(desc(users.isActive), asc(users.email));
}

export async function getUserAdmin(userId: number) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      passwordChangedAt: users.passwordChangedAt,
      passwordScheme: users.passwordScheme,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;
  const storeRows = await db.select({ storeId: userStores.storeId }).from(userStores).where(eq(userStores.userId, userId));
  return { ...user, storeIds: storeRows.map((r) => r.storeId) };
}

export async function listStoreOptions() {
  return db
    .select({ id: stores.id, name: stores.name, isArchived: stores.isArchived })
    .from(stores)
    .orderBy(asc(stores.isArchived), asc(stores.sortOrder), asc(stores.id));
}

export const AUDIT_SORTS = ["time", "user", "store", "action"] as const;
export type AuditSort = (typeof AUDIT_SORTS)[number];

export async function listAudit(p: {
  storeId?: number;
  userId?: number;
  q?: string;
  sort: SortState<AuditSort> | null;
  page: number;
  pageSize: number;
}) {
  const conditions: (SQL | undefined)[] = [];
  if (p.storeId) conditions.push(eq(auditLog.storeId, p.storeId));
  if (p.userId) conditions.push(eq(auditLog.userId, p.userId));
  if (p.q) {
    const like = likePattern(p.q);
    conditions.push(or(ilike(auditLog.summary, like), ilike(auditLog.action, like)));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const s = p.sort;
  const order = !s
    ? [desc(auditLog.id)]
    : s.column === "time"
      ? [by(auditLog.createdAt, s.dir), by(auditLog.id, s.dir)]
      : [
          by(
            {
              user: sql`coalesce(nullif(${users.name}, ''), ${users.email})`,
              store: stores.name,
              action: auditLog.summary,
            }[s.column],
            s.dir,
          ),
          desc(auditLog.id),
        ];
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        summary: auditLog.summary,
        storeId: auditLog.storeId,
        storeName: stores.name,
        userName: users.name,
        userEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(stores, eq(stores.id, auditLog.storeId))
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(where)
      .orderBy(...order)
      .limit(p.pageSize)
      .offset((p.page - 1) * p.pageSize),
    db.select({ total: count() }).from(auditLog).where(where),
  ]);
  return { rows, total };
}

export async function listUserOptions() {
  return db.select({ id: users.id, email: users.email, name: users.name }).from(users).orderBy(asc(users.email));
}

/** Stores the user hid from their overview page. */
export async function getHiddenStoreIds(userId: number): Promise<number[]> {
  const [row] = await db.select({ ids: users.hiddenStoreIds }).from(users).where(eq(users.id, userId));
  return row?.ids ?? [];
}
