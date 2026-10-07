"use server";

import { and, eq, gt, sql } from "drizzle-orm";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { EMAIL_MAX, PASSWORD_MAX } from "@/lib/policy";
import { HOME_PATH, LOGIN_PATH } from "@/server/auth/constants";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/server/auth/password";
import { clientIp, createSession, deleteExpiredSessions, destroySession } from "@/server/auth/session";
import { db } from "@/server/db";
import { deleteOldRequestKeys } from "@/server/db/once";
import { auditLog, users } from "@/server/db/schema";

export type LoginState = { error?: string; email?: string } | undefined;

/**
 * Throttling counts failed attempts in the last 15 minutes from the same IP — per account and in
 * total. Keyed by IP, so nobody can lock a colleague out by typing wrong passwords for their
 * e-mail from somewhere else.
 */
const MAX_FAILURES_PER_ACCOUNT = 10;
const MAX_FAILURES_PER_IP = 30;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

const WRONG_CREDENTIALS = "ელფოსტა ან პაროლი არასწორია.";

// Length limits only: imported accounts keep whatever address the old app had.
const credentials = z.object({
  email: z.string().trim().toLowerCase().min(1).max(EMAIL_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const typedEmail = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, EMAIL_MAX);
  if (!typedEmail || !formData.get("password")) return { error: "შეიყვანეთ ელფოსტა და პაროლი.", email: typedEmail };
  // Junk (megabyte-long fields) is answered without touching the database.
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: WRONG_CREDENTIALS, email: typedEmail };
  const { email, password } = parsed.data;
  const next = String(formData.get("next") ?? "").slice(0, 2000);

  try {
    const ip = (await clientIp()) ?? "unknown";
    // Written as a failure before the password is checked (a success rewrites it), so parallel
    // guesses count each other and can't slip past the limit.
    const [attempt] = await db
      .insert(auditLog)
      .values({
        action: "auth.login_failed",
        entityType: "user",
        summary: `წარუმატებელი შესვლა: ${email}`,
        details: { email, ip },
      })
      .returning({ id: auditLog.id });
    const [recent] = await db
      .select({
        fromIp: sql<number>`count(*)::int`,
        forAccount: sql<number>`(count(*) filter (where ${auditLog.details} ->> 'email' = ${email}))::int`,
      })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.action, "auth.login_failed"),
          gt(auditLog.createdAt, new Date(Date.now() - FAILURE_WINDOW_MS)),
          sql`${auditLog.details} ->> 'ip' = ${ip}`,
        ),
      );
    if (recent.fromIp > MAX_FAILURES_PER_IP || recent.forAccount > MAX_FAILURES_PER_ACCOUNT) {
      // Refused without checking the password: not a failure of its own, so retrying while
      // locked (or colleagues behind the same office IP) doesn't extend the lock.
      await db
        .update(auditLog)
        .set({ action: "auth.login_throttled", summary: `შესვლა შეჩერდა (ბევრი მცდელობა): ${email}` })
        .where(eq(auditLog.id, attempt.id));
      return { error: "ძალიან ბევრი წარუმატებელი მცდელობა. სცადეთ 15 წუთში.", email };
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const check = user?.isActive ? await verifyPassword(user, password) : null;
    if (!user || !check?.ok) {
      if (!check) await burnPasswordCheck(password);
      if (user) await db.update(auditLog).set({ userId: user.id, entityId: user.id }).where(eq(auditLog.id, attempt.id));
      return { error: WRONG_CREDENTIALS, email };
    }

    await db
      .update(users)
      .set({
        lastLoginAt: new Date(),
        // First login after the import: replace bcrypt(md5) with a proper bcrypt hash.
        ...(check.needsUpgrade ? { passwordHash: await hashPassword(password), passwordScheme: "bcrypt" as const } : {}),
      })
      .where(eq(users.id, user.id));
    await createSession(user.id);
    await db
      .update(auditLog)
      .set({ action: "auth.login", userId: user.id, entityId: user.id, summary: "სისტემაში შესვლა", details: { ip } })
      .where(eq(auditLog.id, attempt.id));
    // Housekeeping never blocks a login that already succeeded.
    await Promise.all([deleteExpiredSessions(), deleteOldRequestKeys(db)]).catch((error) =>
      console.error("[login] housekeeping", error),
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("[login]", error);
    return { error: "სისტემა დროებით მიუწვდომელია. სცადეთ ცოტა ხანში.", email };
  }
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
