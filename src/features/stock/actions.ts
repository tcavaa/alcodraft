"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { amount, formObject, id, requiredText, text, wholeNumber } from "@/lib/validation";
import { ActionError, type ActionResult, fieldErrorsFrom, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";

import { createSupplier, deleteSupplier, setSupplierArchived, updateSupplier } from "../catalog/service";
import { paySupplier } from "../finance/service";
import { createReceipt, deleteReceipt } from "./service";

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ActionError("შეასწორეთ მონიშნული ველები.", fieldErrorsFrom(parsed.error));
  return parsed.data;
}

// ── Stock receipts ──────────────────────────────────────────────────────────

const receiptSchema = z.object({
  supplierId: id.nullable(),
  lines: z
    .array(z.object({ productId: id, quantity: wholeNumber({ allowNegative: true }), unitCost: amount() }))
    .max(2000),
  comment: text(2000),
});
export type ReceiptPayload = z.input<typeof receiptSchema>;

export async function createReceiptAction(storeId: number, payload: ReceiptPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(receiptSchema, payload);
    const created = await db.transaction((tx) => createReceipt(tx, actor, data));
    redirect(`${storeHref(storeId, `stock/${created.id}`)}?created=1`);
  });
}

export async function deleteReceiptAction(storeId: number, receiptId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    await db.transaction((tx) => deleteReceipt(tx, actor, receiptId));
    redirect(storeHref(storeId, "stock"));
  });
}

// ── Suppliers ───────────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name: requiredText("დასახელება", 200),
  isReturns: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export async function createSupplierAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(supplierSchema, formObject(formData));
    const row = await db.transaction((tx) => createSupplier(tx, actor, data));
    redirect(storeHref(storeId, `suppliers/${row.id}`));
  });
}

export async function updateSupplierAction(
  storeId: number,
  supplierId: number,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(supplierSchema, formObject(formData));
    await db.transaction((tx) => updateSupplier(tx, actor, supplierId, data));
    redirect(storeHref(storeId, `suppliers/${supplierId}`));
  });
}

export async function setSupplierArchivedAction(storeId: number, supplierId: number, archived: boolean) {
  return runAction(
    async () => {
      const { actor } = await authorizeStore(storeId);
      await db.transaction((tx) => setSupplierArchived(tx, actor, supplierId, archived));
      refresh();
    },
    archived ? "მომწოდებელი გადავიდა სანაგვეში" : "მომწოდებელი აღდგა",
  );
}

export async function deleteSupplierAction(storeId: number, supplierId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    await db.transaction((tx) => deleteSupplier(tx, actor, supplierId));
    redirect(storeHref(storeId, "suppliers?archived=1"));
  });
}

const paySchema = z.object({ amount: amount({ required: true }), note: text(500) });

export async function paySupplierAction(storeId: number, supplierId: number, input: z.input<typeof paySchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(paySchema, input);
    await db.transaction((tx) => paySupplier(tx, actor, { supplierId, ...data }));
    refresh();
  }, "გადახდა ჩაიწერა");
}
