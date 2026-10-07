"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { MAX_ID } from "@/lib/policy";
import { checkbox, email, formObject, id, password, requiredText } from "@/lib/validation";
import { ActionError, type ActionResult, parseInput, runAction } from "@/server/action";
import { authorizeSuperAdmin, requireUser } from "@/server/auth/dal";
import { verifyPassword } from "@/server/auth/password";
import { currentSessionId } from "@/server/auth/session";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";

import {
  changeOwnPassword,
  createStore,
  createUser,
  deleteStore,
  deleteUser,
  resetUserPassword,
  updateOwnName,
  updateStore,
  updateUser,
} from "./service";

// ── Stores ──────────────────────────────────────────────────────────────────

const storeSchema = z.object({
  name: requiredText("დასახელება", 120),
  sortOrder: z.coerce.number({ error: "მთელი რიცხვი" }).int("მთელი რიცხვი").min(0).max(10_000).default(0),
  isArchived: checkbox(),
});

export async function createStoreAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const { name } = parseInput(storeSchema.pick({ name: true }), formObject(formData));
    const store = await db.transaction((tx) => createStore(tx, actor.id, { name }));
    redirect(`/admin/stores/${store.id}`);
  });
}

export async function updateStoreAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const data = parseInput(storeSchema, formObject(formData));
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
  isActive: checkbox(),
  storeIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]))
    .pipe(z.array(z.string().regex(/^\d{1,10}$/, "არასწორი მაღაზია").transform(Number).pipe(z.number().int().positive().max(MAX_ID))).max(500)),
});

export async function createUserAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const raw = formObject(formData);
    const data = parseInput(userSchema.extend({ password }), raw);
    const user = await db.transaction((tx) => createUser(tx, actor.id, data));
    redirect(`/admin/settings/users/${user.id}?created=1`);
  });
}

export async function updateUserAction(userId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const target = parseInput(id, userId);
    const data = parseInput(userSchema, formObject(formData));
    if (target === actor.id && (!data.isActive || data.role !== "super_admin")) {
      throw new ActionError("საკუთარი თავის გათიშვა ან სუპერ ადმინის როლის მოხსნა შეუძლებელია.");
    }
    await db.transaction((tx) => updateUser(tx, actor.id, target, data));
    refresh();
  }, "მომხმარებელი შენახულია");
}

export async function resetPasswordAction(userId: number, newPassword: string) {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const value = parseInput(password, newPassword);
    await db.transaction((tx) => resetUserPassword(tx, actor.id, userId, value));
    refresh();
  }, "პაროლი შეიცვალა — მომხმარებელი გამოვიდა ყველა მოწყობილობიდან");
}

export async function deleteUserAction(userId: number) {
  return runAction(async () => {
    const actor = await authorizeSuperAdmin();
    const target = parseInput(id, userId);
    await db.transaction((tx) => deleteUser(tx, actor.id, target));
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
    const data = parseInput(changePasswordSchema, formObject(formData));
    const [row] = await db.select().from(users).where(eq(users.id, me.id));
    const check = await verifyPassword(row, data.current);
    if (!check.ok) throw new ActionError("მიმდინარე პაროლი არასწორია.", { current: "მიმდინარე პაროლი არასწორია." });
    const keepSession = await currentSessionId();
    await db.transaction((tx) => changeOwnPassword(tx, me.id, data.next, keepSession));
  }, "პაროლი შეიცვალა. სხვა მოწყობილობებიდან გამოხვედით.");
}

export async function updateOwnNameAction(name: string) {
  return runAction(async () => {
    const me = await requireUser();
    const value = parseInput(z.string().trim().max(120, "მაქსიმუმ 120 სიმბოლო"), name);
    await db.transaction((tx) => updateOwnName(tx, me.id, value));
    refresh();
  }, "სახელი შენახულია");
}
