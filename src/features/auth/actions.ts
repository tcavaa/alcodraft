"use server";

import { and, count, eq, gt, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { audit } from "@/server/audit";
import { HOME_PATH, LOGIN_PATH } from "@/server/auth/constants";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { createSession, deleteExpiredSessions, destroySession } from "@/server/auth/session";
import { db } from "@/server/db";
import { auditLog, users } from "@/server/db/schema";

export type LoginState = { error?: string; email?: string } | undefined;

const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!email || !password) return { error: "შეიყვანეთ ელფოსტა და პაროლი.", email };

  const [{ failures }] = await db
    .select({ failures: count() })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "auth.login_failed"),
        gt(auditLog.createdAt, new Date(Date.now() - FAILURE_WINDOW_MS)),
        sql`${auditLog.details} ->> 'email' = ${email}`,
      ),
    );
  if (failures >= MAX_FAILURES) {
    return { error: "ძალიან ბევრი წარუმატებელი მცდელობა. სცადეთ 15 წუთში.", email };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const check = user?.isActive ? await verifyPassword(user, password) : null;
  if (!user || !check?.ok) {
    if (!check) await burnPasswordCheck(password);
    await audit(db, {
      userId: user?.id ?? null,
      action: "auth.login_failed",
      entityType: "user",
      entityId: user?.id ?? null,
      summary: `წარუმატებელი შესვლა: ${email}`,
      details: { email },
    });
    return { error: "ელფოსტა ან პაროლი არასწორია.", email };
  }

  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      // First login after the import: replace bcrypt(md5) with a proper bcrypt hash.
      ...(check.needsUpgrade
        ? { passwordHash: await hashPassword(password), passwordScheme: "bcrypt" as const }
        : {}),
    })
    .where(eq(users.id, user.id));
  await createSession(user.id);
  await audit(db, {
    userId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    summary: "სისტემაში შესვლა",
  });
  await deleteExpiredSessions();
  redirect(safeNext(next));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect(LOGIN_PATH);
}

function safeNext(next: string): string {
  return next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith(LOGIN_PATH)
    ? next
    : HOME_PATH;
}
