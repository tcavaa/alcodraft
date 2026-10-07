"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { amount, formObject, reason, requiredText, text, wholeNumber } from "@/lib/validation";
import { type ActionResult, parseInput, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";

import {
  adjustProductStock,
  createProduct,
  deleteProduct,
  setProductArchived,
  updateProduct,
} from "../catalog/service";

const productSchema = z.object({
  name: requiredText("დასახელება"),
  supplierId: z
    .string()
    .optional()
    .transform((v) => (v && v !== "none" ? Number(v) : null))
    .pipe(z.number().int().positive().nullable()),
  salePrice: amount({ required: true }),
  purchasePrice: amount(),
  comment: text(2000),
});

export async function createProductAction(storeId: number, _prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(productSchema, formObject(formData));
    const row = await db.transaction((tx) => createProduct(tx, actor, data));
    redirect(storeHref(storeId, `products/${row.id}?created=1`));
  });
}

export async function updateProductAction(
  storeId: number,
  productId: number,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(productSchema, formObject(formData));
    await db.transaction((tx) => updateProduct(tx, actor, productId, data));
    refresh();
  }, "პროდუქტი შენახულია");
}

export async function setProductArchivedAction(storeId: number, productId: number, archived: boolean) {
  return runAction(
    async () => {
      const { actor } = await authorizeStore(storeId);
      const value = parseInput(z.boolean(), archived);
      await db.transaction((tx) => setProductArchived(tx, actor, productId, value));
      refresh();
    },
    archived === true ? "პროდუქტი გადავიდა სანაგვეში" : "პროდუქტი აღდგა",
  );
}

export async function deleteProductAction(storeId: number, productId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    await db.transaction((tx) => deleteProduct(tx, actor, productId));
    redirect(storeHref(storeId, "products?archived=1"));
  });
}

const adjustSchema = z.object({
  newQty: wholeNumber({ allowNegative: true, required: true }),
  /** The stock the dialog showed — a receipt or sale since then must not be wiped by the count. */
  expectedQty: z.number().int(),
  reason: reason(500),
});

export async function adjustStockAction(storeId: number, productId: number, input: z.input<typeof adjustSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(adjustSchema, input);
    await db.transaction((tx) => adjustProductStock(tx, actor, productId, data));
    refresh();
  }, "მარაგი განახლდა");
}
