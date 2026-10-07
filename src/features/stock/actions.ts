"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { amount, checkbox, formObject, id, requestId, requiredText, text, wholeNumber } from "@/lib/validation";
import { type ActionResult, parseInput, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";
import { once } from "@/server/db/once";

import { createSupplier, deleteSupplier, setSupplierArchived, updateSupplier } from "../catalog/service";
import { paySupplier } from "../finance/service";
import { createReceipt, deleteReceipt } from "./service";

// ── Stock receipts ──────────────────────────────────────────────────────────

const receiptSchema = z.object({
  requestId,
  supplierId: id.nullable(),
  lines: z
    .array(z.object({ productId: id, quantity: wholeNumber({ allowNegative: true }), unitCost: amount({ required: true }) }))
    .max(2000),
  comment: text(2000),
});
export type ReceiptPayload = z.input<typeof receiptSchema>;

export async function createReceiptAction(storeId: number, payload: ReceiptPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(receiptSchema, payload);
    const created = await once(db, { key: data.requestId, action: "receipt.create", userId: actor.userId }, (tx) =>
      createReceipt(tx, actor, data),
    );
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
  isReturns: checkbox(),
});

export async function createSupplierAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(supplierSchema, formObject(formData));
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
    const data = parseInput(supplierSchema, formObject(formData));
    await db.transaction((tx) => updateSupplier(tx, actor, supplierId, data));
    redirect(storeHref(storeId, `suppliers/${supplierId}`));
  });
}

export async function setSupplierArchivedAction(storeId: number, supplierId: number, archived: boolean) {
  return runAction(
    async () => {
      const { actor } = await authorizeStore(storeId);
      const value = parseInput(z.boolean(), archived);
      await db.transaction((tx) => setSupplierArchived(tx, actor, supplierId, value));
      refresh();
    },
    archived === true ? "მომწოდებელი გადავიდა სანაგვეში" : "მომწოდებელი აღდგა",
  );
}

export async function deleteSupplierAction(storeId: number, supplierId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    await db.transaction((tx) => deleteSupplier(tx, actor, supplierId));
    redirect(storeHref(storeId, "suppliers?archived=1"));
  });
}

const paySchema = z.object({ requestId, amount: amount({ required: true }), note: text(500) });

export async function paySupplierAction(storeId: number, supplierId: number, input: z.input<typeof paySchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(paySchema, input);
    await once(db, { key: data.requestId, action: "supplier.pay", userId: actor.userId }, (tx) =>
      paySupplier(tx, actor, { supplierId, amount: data.amount, note: data.note }),
    );
    refresh();
  }, "გადახდა ჩაიწერა სალაროში");
}
