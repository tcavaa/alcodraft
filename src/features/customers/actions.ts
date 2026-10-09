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
  phone: text(100),
  contactPerson: text(200),
});

export async function createCustomerAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(customerSchema, formObject(formData));
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
    const data = parseInput(customerSchema, formObject(formData));
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
