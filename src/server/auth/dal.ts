import "server-only";

import { and, asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { ActionError } from "@/server/action";
import { db } from "@/server/db";
import { stores, userStores } from "@/server/db/schema";

import { LOGIN_PATH } from "./constants";
import { getCurrentUser, type SessionUser } from "./session";

/**
 * Data Access Layer: every page and action resolves the user (and store)
 * through these helpers, so authorization lives in one place.
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "super_admin") notFound();
  return user;
}

export interface StoreSummary {
  id: number;
  name: string;
  isArchived: boolean;
}

/** Stores the current user may open. Super admins see every store (archived last). */
export const getMyStores = cache(async (): Promise<StoreSummary[]> => {
  const user = await requireUser();
  const columns = { id: stores.id, name: stores.name, isArchived: stores.isArchived };
  if (user.role === "super_admin") {
    return db
      .select(columns)
      .from(stores)
      .orderBy(asc(stores.isArchived), asc(stores.sortOrder), asc(stores.id));
  }
  return db
    .select(columns)
    .from(userStores)
    .innerJoin(stores, eq(stores.id, userStores.storeId))
    .where(and(eq(userStores.userId, user.id), eq(stores.isArchived, false)))
    .orderBy(asc(stores.sortOrder), asc(stores.id));
});

/**
 * For Server Actions: the caller must be signed in and allowed in the store.
 * Returns the `actor` the domain services expect.
 */
export async function authorizeStore(storeId: number, opts: { superAdminOnly?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (opts.superAdminOnly && user.role !== "super_admin") {
    throw new ActionError("ამ მოქმედებას მხოლოდ სუპერ ადმინი ასრულებს.");
  }
  const store = (await getMyStores()).find((s) => s.id === storeId);
  if (!store) throw new ActionError("ამ მაღაზიაზე წვდომა არ გაქვთ.");
  return { user, store, actor: { userId: user.id, storeId: store.id } };
}

/** For Server Actions that only a super admin may run. */
export async function authorizeSuperAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  if (user.role !== "super_admin") throw new ActionError("ამ მოქმედებას მხოლოდ სუპერ ადმინი ასრულებს.");
  return user;
}

/** Resolves a store route segment; renders 404 when it doesn't exist or isn't allowed. */
export const requireStore = cache(
  async (storeIdParam: string | number): Promise<{ user: SessionUser; store: StoreSummary }> => {
    const user = await requireUser();
    const storeId = Number(storeIdParam);
    if (!Number.isInteger(storeId) || storeId <= 0) notFound();
    const store = (await getMyStores()).find((s) => s.id === storeId);
    if (!store) notFound();
    return { user, store };
  },
);
