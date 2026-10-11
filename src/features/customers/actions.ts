"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { formObject, requiredText, text } from "@/lib/validation";
import { type ActionResult, parseInput, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";

import { CUSTOMER_COLORS } from "./colors";
import { type CustomerPhone, localDigits } from "./phones";

import {
  createCustomer,
  deleteCustomer,
  setCustomerArchived,
  setCustomerNote,
  updateCustomer,
} from "../catalog/service";

const customerSchema = z.object({
  name: requiredText("დასახელება"),
  address: text(500),
  taxId: text(100),
  phones: phoneRows(),
});

const asList = (v: unknown) => (v === undefined ? [] : Array.isArray(v) ? v : [v]).map((x) => String(x ?? "").trim());

/**
 * The form's repeated `phoneName` / `phoneNumber` fields → `{ name, number }` rows. Empty rows are
 * dropped; a number must be 9 digits (+995 is fixed).
 */
function phoneRows() {
  return z
    .object({ phoneName: z.unknown(), phoneNumber: z.unknown() })
    .transform(({ phoneName, phoneNumber }, ctx): CustomerPhone[] => {
      const names = asList(phoneName);
      const numbers = asList(phoneNumber);
      const rows: CustomerPhone[] = [];
      for (let i = 0; i < Math.max(names.length, numbers.length); i++) {
        const name = names[i] ?? "";
        const typed = numbers[i] ?? "";
        if (!name && !typed) continue;
        if (name.length > 200) ctx.addIssue({ code: "custom", path: [`phoneName.${i}`], message: "მაქსიმუმ 200 სიმბოლო" });
        const number = typed ? localDigits(typed) : "";
        if (number === null) ctx.addIssue({ code: "custom", path: [`phoneNumber.${i}`], message: "9 ციფრი, მაგ. 557994849" });
        rows.push({ name, number: number ?? "" });
      }
      if (rows.length > 20) ctx.addIssue({ code: "custom", path: ["phoneNumber.0"], message: "მაქსიმუმ 20 ნომერი" });
      return rows;
    });
}

/** Errors of row `i` come back as `phones.phoneNumber.<i>` / `phones.phoneName.<i>`. */
const parseCustomer = (formData: FormData) => {
  const raw = formObject(formData);
  return parseInput(customerSchema, { ...raw, phones: raw });
};

export async function createCustomerAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseCustomer(formData);
    const row = await db.transaction((tx) => createCustomer(tx, actor, data));
    redirect(storeHref(storeId, `customers/${row.id}`));
  });
}

export async function updateCustomerAction(
  storeId: number,
  customerId: number,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseCustomer(formData);
    await db.transaction((tx) => updateCustomer(tx, actor, customerId, data));
    redirect(storeHref(storeId, `customers/${customerId}`));
  });
}

export async function setCustomerCommentAction(storeId: number, customerId: number, comment: string) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const value = parseInput(text(5000), comment);
    await db.transaction((tx) => setCustomerNote(tx, actor, customerId, { comment: value }));
    refresh();
  }, "კომენტარი შენახულია");
}

export async function setCustomerColorAction(storeId: number, customerId: number, color: string | null) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const value = parseInput(z.enum(CUSTOMER_COLORS).nullable(), color);
    await db.transaction((tx) => setCustomerNote(tx, actor, customerId, { color: value }));
    refresh();
  });
}

export async function setCustomerArchivedAction(storeId: number, customerId: number, archived: boolean) {
  return runAction(
    async () => {
      const { actor } = await authorizeStore(storeId);
      const value = parseInput(z.boolean(), archived);
      await db.transaction((tx) => setCustomerArchived(tx, actor, customerId, value));
      refresh();
    },
    archived === true ? "ობიექტი გადავიდა სანაგვეში" : "ობიექტი აღდგა",
  );
}

export async function deleteCustomerAction(storeId: number, customerId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    await db.transaction((tx) => deleteCustomer(tx, actor, customerId));
    redirect(storeHref(storeId, "customers?archived=1"));
  });
}
