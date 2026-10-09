"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { amount, formObject, id, requestId, requiredText, text } from "@/lib/validation";
import { type ActionResult, parseInput, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";
import { once } from "@/server/db/once";

import {
  accrueWage,
  createEmployee,
  createEntry,
  deleteEntry,
  payWage,
  renameAccount,
  setEmployeeArchived,
  updateEmployee,
  updateEntryText,
} from "./service";

// ── Cash book ───────────────────────────────────────────────────────────────

const entrySchema = z.object({
  requestId,
  accountId: id,
  amountOut: amount(),
  amountIn: amount(),
  description: requiredText("კომენტარი", 2000),
  note: text(2000),
});

export async function createEntryAction(storeId: number, input: z.input<typeof entrySchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(entrySchema, input);
    await once(db, { key: data.requestId, action: "finance.create", userId: actor.userId }, (tx) =>
      createEntry(tx, actor, data),
    );
    refresh();
  }, "ჩანაწერი დაემატა");
}

const entryTextSchema = z.object({ description: requiredText("კომენტარი", 2000), note: text(2000) });

export async function updateEntryTextAction(storeId: number, entryId: number, input: z.input<typeof entryTextSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(entryTextSchema, input);
    await db.transaction((tx) => updateEntryText(tx, actor, entryId, data));
    refresh();
  }, "შენახულია");
}

export async function deleteEntryAction(storeId: number, entryId: number, expected: "entry" | "correction") {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    const state = parseInput(z.enum(["entry", "correction"]), expected);
    await db.transaction((tx) => deleteEntry(tx, actor, entryId, state));
    refresh();
  }, "ჩანაწერი წაიშალა");
}

const accountName = requiredText("დასახელება", 100);

export async function renameAccountAction(storeId: number, accountId: number, name: string) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    const value = parseInput(accountName, name);
    await db.transaction((tx) => renameAccount(tx, actor, accountId, value));
    refresh();
  }, "სალარო გადაერქვა");
}

// ── Employees ───────────────────────────────────────────────────────────────

const employeeSchema = z.object({
  name: requiredText("სახელი", 200),
  wageBalance: amount({ allowNegative: true }),
});

/** Editing: the balance is required and compared with the one the form showed (`wageBalanceBefore`). */
const employeeEditSchema = z.object({
  name: requiredText("სახელი", 200),
  wageBalance: amount({ allowNegative: true, required: true }),
  wageBalanceBefore: amount({ allowNegative: true, required: true }),
});

export async function createEmployeeAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(employeeSchema, formObject(formData));
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
    const data = parseInput(employeeEditSchema, formObject(formData));
    await db.transaction((tx) => updateEmployee(tx, actor, employeeId, data));
    redirect(storeHref(storeId, `employees/${employeeId}`));
  });
}

export async function setEmployeeArchivedAction(storeId: number, employeeId: number, archived: boolean) {
  return runAction(
    async () => {
      const { actor } = await authorizeStore(storeId);
      const value = parseInput(z.boolean(), archived);
      await db.transaction((tx) => setEmployeeArchived(tx, actor, employeeId, value));
      refresh();
    },
    archived === true ? "თანამშრომელი გადავიდა სანაგვეში" : "თანამშრომელი აღდგა",
  );
}

const wageSchema = z.object({ requestId, amount: amount({ required: true }), text: text(500) });

export async function accrueWageAction(storeId: number, employeeId: number, input: z.input<typeof wageSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(wageSchema, input);
    await once(db, { key: data.requestId, action: "employee.accrue", userId: actor.userId }, (tx) =>
      accrueWage(tx, actor, { employeeId, amount: data.amount, comment: data.text }),
    );
    refresh();
  }, "ხელფასი დაერიცხა");
}

export async function payWageAction(storeId: number, employeeId: number, input: z.input<typeof wageSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(wageSchema, input);
    await once(db, { key: data.requestId, action: "employee.pay", userId: actor.userId }, (tx) =>
      payWage(tx, actor, { employeeId, amount: data.amount, note: data.text }),
    );
    refresh();
  }, "გადახდა ჩაიწერა სალაროში");
}
