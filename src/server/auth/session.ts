import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, lt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";

import { SESSION_COOKIE, SESSION_TOUCH_INTERVAL_MS, SESSION_TTL_MS } from "./constants";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: "super_admin" | "user";
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Creates a session and sets the cookie. Call from Server Actions only. */
export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ipAddress: (h.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null,
    userAgent: h.get("user-agent")?.slice(0, 400) ?? null,
  });
  await setSessionCookie(token, expiresAt);
}

/** Deletes the current session and its cookie. Call from Server Actions only. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  store.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (password change, deactivation, deletion). */
export async function revokeUserSessions(userId: number, exceptCurrent = false): Promise<void> {
  if (!exceptCurrent) {
    await db.delete(sessions).where(eq(sessions.userId, userId));
    return;
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const keep = token ? hashToken(token) : "";
  const rows = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  for (const row of rows) if (row.id !== keep) await db.delete(sessions).where(eq(sessions.id, row.id));
}

/**
 * The signed-in user for this request, or null. Deduplicated per request.
 * Reads cookies → must be rendered inside <Suspense>.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  const now = Date.now();
  if (!row || !row.isActive || row.expiresAt.getTime() <= now) return null;

  // Sliding expiry, written at most once an hour.
  if (now - row.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date(now), expiresAt: new Date(now + SESSION_TTL_MS) })
      .where(eq(sessions.id, id));
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
});

/** Housekeeping, run opportunistically on login. */
export async function deleteExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(and(lt(sessions.expiresAt, new Date())));
}
