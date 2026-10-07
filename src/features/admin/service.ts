import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import type { Tx } from "@/server/db";
import {
  customers,
  deliveries,
  employees,
  financeAccounts,
  financeEntries,
  orders,
  products,
  sessions,
  stockReceipts,
  stores,
  suppliers,
  userStores,
  users,
} from "@/server/db/schema";

// ── Stores ──────────────────────────────────────────────────────────────────

/** A new store gets everything the old copy-pasted table sets had, plus a cash book. */
export async function createStore(tx: Tx, actorId: number, input: { name: string }) {
  const [{ maxOrder }] = await tx
    .select({ maxOrder: sql<number>`coalesce(max(${stores.sortOrder}), 0)::int` })
    .from(stores);
  const [store] = await tx
    .insert(stores)
    .values({ name: input.name, sortOrder: maxOrder + 1 })
    .returning({ id: stores.id });
  await tx.insert(financeAccounts).values({ storeId: store.id, name: "ფინანსები", isDefault: true });
  await audit(tx, {
    storeId: store.id,
    userId: actorId,
    action: "store.create",
    entityType: "store",
    entityId: store.id,
    summary: `ახალი მაღაზია: ${input.name}`,
  });
  return store;
}

export async function updateStore(
  tx: Tx,
  actorId: number,
  storeId: number,
  input: { name: string; sortOrder: number; isArchived: boolean },
) {
  const [store] = await tx.select().from(stores).where(eq(stores.id, storeId)).for("update");
  if (!store) throw new ActionError("მაღაზია ვერ მოიძებნა.");
  await tx.update(stores).set(input).where(eq(stores.id, storeId));
  await audit(tx, {
    storeId,
    userId: actorId,
    action: "store.update",
    entityType: "store",
    entityId: storeId,
    summary:
      store.name !== input.name
        ? `${store.name} → ${input.name}`
        : store.isArchived !== input.isArchived
          ? `${input.name} ${input.isArchived ? "დაარქივდა" : "აღდგა"}`
          : `${input.name}: განახლდა`,
  });
}

/** Only an empty store can be deleted; anything with history must be archived. */
export async function deleteStore(tx: Tx, actorId: number, storeId: number) {
  const [store] = await tx.select().from(stores).where(eq(stores.id, storeId)).for("update");
  if (!store) throw new ActionError("მაღაზია ვერ მოიძებნა.");
  const checks = [
    { table: deliveries, column: deliveries.storeId, label: "ოპერაციები" },
    { table: orders, column: orders.storeId, label: "შეკვეთები" },
    { table: customers, column: customers.storeId, label: "კლიენტები" },
    { table: products, column: products.storeId, label: "პროდუქცია" },
    { table: suppliers, column: suppliers.storeId, label: "მომწოდებლები" },
    { table: stockReceipts, column: stockReceipts.storeId, label: "მიღებები" },
    { table: financeEntries, column: financeEntries.storeId, label: "სალაროს ჩანაწერები" },
    { table: employees, column: employees.storeId, label: "თანამშრომლები" },
  ] as const;
  const used: string[] = [];
  for (const c of checks) {
    const [row] = await tx.select({ one: sql`1` }).from(c.table).where(eq(c.column, storeId)).limit(1);
    if (row) used.push(c.label);
  }
  if (used.length) throw new ActionError(`მაღაზიას აქვს მონაცემები (${used.join(", ")}) — დაარქივეთ წაშლის ნაცვლად.`);
  await tx.delete(financeAccounts).where(eq(financeAccounts.storeId, storeId));
  await tx.delete(stores).where(eq(stores.id, storeId));
  await audit(tx, {
    userId: actorId,
    action: "store.delete",
    entityType: "store",
    entityId: storeId,
    summary: `წაიშალა მაღაზია: ${store.name}`,
  });
}

// ── Users ───────────────────────────────────────────────────────────────────

export interface UserInput {
  email: string;
  name: string;
  role: "super_admin" | "user";
  isActive: boolean;
  storeIds: number[];
}

async function setUserStores(tx: Tx, userId: number, storeIds: number[]) {
  await tx.delete(userStores).where(eq(userStores.userId, userId));
  const ids = [...new Set(storeIds)];
  if (ids.length === 0) return;
  const existing = await tx.select({ id: stores.id }).from(stores).where(inArray(stores.id, ids));
  if (existing.length !== ids.length) throw new ActionError("ზოგიერთი მაღაზია ვერ მოიძებნა.");
  await tx.insert(userStores).values(ids.map((storeId) => ({ userId, storeId })));
}

async function assertEmailFree(tx: Tx, email: string, exceptId?: number) {
  const [row] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), exceptId ? ne(users.id, exceptId) : undefined));
  if (row) throw new ActionError("ეს ელფოსტა უკვე გამოყენებულია.", { email: "ეს ელფოსტა უკვე გამოყენებულია." });
}

export async function createUser(tx: Tx, actorId: number, input: UserInput & { password: string }) {
  await assertEmailFree(tx, input.email);
  const [user] = await tx
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      role: input.role,
      isActive: input.isActive,
      passwordHash: await hashPassword(input.password),
      passwordScheme: "bcrypt",
      passwordChangedAt: new Date(),
    })
    .returning({ id: users.id });
  await setUserStores(tx, user.id, input.role === "super_admin" ? [] : input.storeIds);
  await audit(tx, {
    userId: actorId,
    action: "user.create",
    entityType: "user",
    entityId: user.id,
    summary: `ახალი მომხმარებელი: ${input.email}`,
    details: { role: input.role, storeIds: input.storeIds },
  });
  return user;
}

async function lockUser(tx: Tx, userId: number) {
  const [row] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  if (!row) throw new ActionError("მომხმარებელი ვერ მოიძებნა.");
  return row;
}

/** Keeps at least one active super admin, so nobody can lock everyone out. */
async function assertAnotherSuperAdmin(tx: Tx, userId: number) {
  const [row] = await tx
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "super_admin"), eq(users.isActive, true), ne(users.id, userId)))
    .limit(1);
  if (!row) throw new ActionError("სისტემაში უნდა დარჩეს მინიმუმ ერთი აქტიური სუპერ ადმინი.");
}

export async function updateUser(tx: Tx, actorId: number, userId: number, input: UserInput) {
  const user = await lockUser(tx, userId);
  await assertEmailFree(tx, input.email, userId);
  const losesSuper = user.role === "super_admin" && (input.role !== "super_admin" || !input.isActive);
  if (losesSuper) await assertAnotherSuperAdmin(tx, userId);
  await tx
    .update(users)
    .set({ email: input.email, name: input.name, role: input.role, isActive: input.isActive })
    .where(eq(users.id, userId));
  await setUserStores(tx, userId, input.role === "super_admin" ? [] : input.storeIds);
  if (!input.isActive) await tx.delete(sessions).where(eq(sessions.userId, userId));
  await audit(tx, {
    userId: actorId,
    action: "user.update",
    entityType: "user",
    entityId: userId,
    summary: `${input.email}: ${input.isActive ? "განახლდა" : "გაითიშა"}`,
    details: { role: input.role, storeIds: input.storeIds, isActive: input.isActive },
  });
}

export async function resetUserPassword(tx: Tx, actorId: number, userId: number, password: string) {
  const user = await lockUser(tx, userId);
  await tx
    .update(users)
    .set({ passwordHash: await hashPassword(password), passwordScheme: "bcrypt", passwordChangedAt: new Date() })
    .where(eq(users.id, userId));
  // Everyone using the old password is signed out.
  await tx.delete(sessions).where(eq(sessions.userId, userId));
  await audit(tx, {
    userId: actorId,
    action: "user.reset_password",
    entityType: "user",
    entityId: userId,
    summary: `${user.email}: პაროლი შეიცვალა`,
  });
}

export async function deleteUser(tx: Tx, actorId: number, userId: number) {
  if (userId === actorId) throw new ActionError("საკუთარი თავის წაშლა შეუძლებელია.");
  const user = await lockUser(tx, userId);
  if (user.role === "super_admin") await assertAnotherSuperAdmin(tx, userId);
  await tx.delete(users).where(eq(users.id, userId));
  await audit(tx, {
    userId: actorId,
    action: "user.delete",
    entityType: "user",
    entityId: userId,
    summary: `წაიშალა მომხმარებელი: ${user.email}`,
  });
}
