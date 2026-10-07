"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { email, formObject, password, requiredText } from "@/lib/validation";
import { ActionError, type ActionResult, fieldErrorsFrom, runAction } from "@/server/action";
import { audit } from "@/server/audit";
import { authorizeSuperAdmin, requireUser } from "@/server/auth/dal";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { revokeUserSessions } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

import {
  createStore,
  createUser,
  deleteStore,
  deleteUser,
  resetUserPassword,
  updateStore,
  updateUser,
} from "./service";

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ActionError("შეასწორეთ მონიშნული ველები.", fieldErrorsFrom(parsed.error));
  return parsed.data;
}

// ── Stores ──────────────────────────────────────────────────────────────────

const storeSchema = z.object({
  name: requiredText("დასახელება", 120),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  isArchived: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function createStoreAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const { name } = parse(storeSchema.pick({ name: true }), formObject(formData));
    const store = await db.transaction((tx) => createStore(tx, actor.id, { name }));
    redirect(`/admin/stores/${store.id}`);
  });
}

export async function updateStoreAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const data = parse(storeSchema, formObject(formData));
    await db.transaction((tx) => updateStore(tx, actor.id, storeId, data));
    redirect("/admin/settings/stores");
  });
}

export async function deleteStoreAction(storeId: number) {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    await db.transaction((tx) => deleteStore(tx, actor.id, storeId));
    redirect("/admin/settings/stores");
  });
}

// ── Users ───────────────────────────────────────────────────────────────────

const userSchema = z.object({
  email,
  name: z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(120)),
  role: z.enum(["super_admin", "user"]),
  isActive: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  storeIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map(Number).filter((n) => Number.isInteger(n) && n > 0)),
});

export async function createUserAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const raw = formObject(formData);
    const data = parse(userSchema.extend({ password }), raw);
    const user = await db.transaction((tx) => createUser(tx, actor.id, data));
    redirect(`/admin/settings/users/${user.id}?created=1`);
  });
}

export async function updateUserAction(userId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const data = parse(userSchema, formObject(formData));
    if (userId === actor.id && (!data.isActive || data.role !== "super_admin")) {
      throw new ActionError("საკუთარი თავის გათიშვა ან სუპერ ადმინის როლის მოხსნა შეუძლებელია.");
    }
    await db.transaction((tx) => updateUser(tx, actor.id, userId, data));
    refresh();
  }, "მომხმარებელი შენახულია");
}

export async function resetPasswordAction(userId: number, newPassword: string) {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const value = parse(password, newPassword);
    await db.transaction((tx) => resetUserPassword(tx, actor.id, userId, value));
    refresh();
  }, "პაროლი შეიცვალა — მომხმარებელი გამოვიდა ყველა მოწყობილობიდან");
}

export async function deleteUserAction(userId: number) {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    await db.transaction((tx) => deleteUser(tx, actor.id, userId));
    redirect("/admin/settings/users");
  });
}

// ── My account ──────────────────────────────────────────────────────────────

const changePasswordSchema = z
  .object({
    current: z.string().min(1, "შეიყვანეთ მიმდინარე პაროლი"),
    next: password,
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "პაროლები არ ემთხვევა" });

export async function changeOwnPasswordAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const me = await requireUser();
    const data = parse(changePasswordSchema, formObject(formData));
    const [row] = await db.select().from(users).where(eq(users.id, me.id));
    const check = await verifyPassword(row, data.current);
    if (!check.ok) throw new ActionError("მიმდინარე პაროლი არასწორია.", { current: "მიმდინარე პაროლი არასწორია." });
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(data.next), passwordScheme: "bcrypt", passwordChangedAt: new Date() })
      .where(eq(users.id, me.id));
    await revokeUserSessions(me.id, true);
    await audit(db, { userId: me.id, action: "user.change_password", entityType: "user", entityId: me.id, summary: "საკუთარი პაროლის შეცვლა" });
  }, "პაროლი შეიცვალა. სხვა მოწყობილობებიდან გამოხვედით.");
}

export async function updateOwnNameAction(name: string) {
  return runAction(async () => {
    const me = await requireUser();
    const value = parse(z.string().trim().max(120), name);
    await db.update(users).set({ name: value }).where(eq(users.id, me.id));
    refresh();
  }, "სახელი შენახულია");
}
