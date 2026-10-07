"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { amount, formObject, id, requiredText, text } from "@/lib/validation";
import { ActionError, type ActionResult, fieldErrorsFrom, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";

import {
  accrueWage,
  createAccount,
  createEmployee,
  createEntry,
  deleteEntry,
  payWage,
  renameAccount,
  setEmployeeArchived,
  updateEmployee,
  updateEntryText,
} from "./service";

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ActionError("შეასწორეთ მონიშნული ველები.", fieldErrorsFrom(parsed.error));
  return parsed.data;
}

// ── Cash book ───────────────────────────────────────────────────────────────

const entrySchema = z.object({
  accountId: id,
  amountOut: amount(),
  amountIn: amount(),
  description: requiredText("კომენტარი", 2000),
  note: text(2000),
});

export async function createEntryAction(storeId: number, input: z.input<typeof entrySchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(entrySchema, input);
    await db.transaction((tx) => createEntry(tx, actor, data));
    refresh();
  }, "ჩანაწერი დაემატა");
}

export async function updateEntryTextAction(storeId: number, entryId: number, input: { description: string; note: string }) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(z.object({ description: requiredText("კომენტარი", 2000), note: text(2000) }), input);
    await db.transaction((tx) => updateEntryText(tx, actor, entryId, data));
    refresh();
  }, "შენახულია");
}

export async function deleteEntryAction(storeId: number, entryId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    await db.transaction((tx) => deleteEntry(tx, actor, entryId));
    refresh();
  }, "ჩანაწერი წაიშალა");
}

export async function createAccountAction(storeId: number, name: string) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    const value = parse(requiredText("დასახელება", 100), name);
    const row = await db.transaction((tx) => createAccount(tx, actor, value));
    redirect(`${storeHref(storeId, "finance")}?account=${row.id}`);
  });
}

export async function renameAccountAction(storeId: number, accountId: number, name: string) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    const value = parse(requiredText("დასახელება", 100), name);
    await db.transaction((tx) => renameAccount(tx, actor, accountId, value));
    refresh();
  }, "სალარო გადაერქვა");
}

// ── Employees ───────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: requiredText("სახელი", 200),
  wageBalance: amount({ allowNegative: true }),
});

export async function createEmployeeAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(employeeSchema, formObject(formData));
    const row = await db.transaction((tx) => createEmployee(tx, actor, data));
    redirect(storeHref(storeId, `employees/${row.id}`));
  });
}

export async function updateEmployeeAction(
  storeId: number,
  employeeId: number,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(employeeSchema, formObject(formData));
    await db.transaction((tx) => updateEmployee(tx, actor, employeeId, data));
    redirect(storeHref(storeId, `employees/${employeeId}`));
  });
}

export async function setEmployeeArchivedAction(storeId: number, employeeId: number, archived: boolean) {
  return runAction(
    async () => {
      const { actor } = await authorizeStore(storeId);
      await db.transaction((tx) => setEmployeeArchived(tx, actor, employeeId, archived));
      refresh();
    },
    archived ? "თანამშრომელი გადავიდა სანაგვეში" : "თანამშრომელი აღდგა",
  );
}

const wageSchema = z.object({ amount: amount({ required: true }), text: text(500) });

export async function accrueWageAction(storeId: number, employeeId: number, input: z.input<typeof wageSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(wageSchema, input);
    await db.transaction((tx) => accrueWage(tx, actor, { employeeId, amount: data.amount, comment: data.text }));
    refresh();
  }, "ხელფასი დაერიცხა");
}

export async function payWageAction(storeId: number, employeeId: number, input: z.input<typeof wageSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(wageSchema, input);
    await db.transaction((tx) => payWage(tx, actor, { employeeId, amount: data.amount, note: data.text }));
    refresh();
  }, "გადახდა ჩაიწერა სალაროში");
}
