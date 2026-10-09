"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { amount, id, reason, requestId, text, wholeNumber } from "@/lib/validation";
import { parseInput, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";
import { once } from "@/server/db/once";

import { DISCOUNT_OPTIONS } from "./logic";
import {
  cancelOrder,
  completeOrder,
  createCustomerCount,
  createCustomerReturn,
  createDebtAdjustment,
  createDelivery,
  createOrder,
  deleteDelivery,
  setOrderQuickFields,
  updateDelivery,
  updateOrder,
} from "./service";

const factors = DISCOUNT_OPTIONS.map((o) => o.factor) as [string, ...string[]];
const method = z.enum(["cash", "card", "back"], { error: "აირჩიეთ გადახდის მეთოდი" });
const uploadStatus = z.enum(["pending", "uploaded"]);

const entryLine = z.object({
  productId: id,
  price: amount({ required: true }),
  quantity: wholeNumber({ allowNegative: true }),
  giftQty: wholeNumber(),
  leftoverQty: wholeNumber(),
});

const finalLine = z.object({
  productId: id,
  unitPrice: amount({ required: true }),
  quantity: wholeNumber({ allowNegative: true }),
  giftQty: wholeNumber(),
  leftoverQty: wholeNumber(),
});

const deliverySchema = z.object({
  requestId,
  customerId: id,
  lines: z.array(entryLine).max(2000),
  discountFactor: z.enum(factors),
  paidAmount: amount({ allowNegative: true }),
  paymentMethod: method,
  hasWaybill: z.boolean(),
  comment: text(5000),
});

/** An edit keeps an imported document's empty method/waybill unless the user sets one. */
const documentEditSchema = z.object({
  lines: z.array(finalLine).max(2000),
  paidAmount: amount({ allowNegative: true }),
  paymentMethod: method.nullable(),
  hasWaybill: z.boolean().nullable(),
  comment: text(5000),
});

// ── Operations ──────────────────────────────────────────────────────────────

export type DeliveryPayload = z.input<typeof deliverySchema>;

export async function createDeliveryAction(storeId: number, payload: DeliveryPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(deliverySchema, payload);
    const created = await once(db, { key: data.requestId, action: "delivery.create", userId: actor.userId }, (tx) =>
      createDelivery(tx, actor, data),
    );
    redirect(`${storeHref(storeId, `operations/${created.id}`)}?created=1`);
  });
}

export type DocumentEditPayload = z.input<typeof documentEditSchema>;

export async function updateDeliveryAction(storeId: number, deliveryId: number, payload: DocumentEditPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(documentEditSchema, payload);
    await db.transaction((tx) => updateDelivery(tx, actor, deliveryId, data));
    redirect(`${storeHref(storeId, `operations/${deliveryId}`)}?updated=1`);
  });
}

export async function deleteDeliveryAction(
  storeId: number,
  deliveryId: number,
  customerId: number,
  expectedKind: "delivery" | "adjustment" | "count" | "return",
) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    const kind = parseInput(z.enum(["delivery", "adjustment", "count", "return"]), expectedKind);
    await db.transaction((tx) => deleteDelivery(tx, actor, deliveryId, kind));
    redirect(storeHref(storeId, `customers/${customerId}`));
  });
}

const adjustmentSchema = z.object({
  requestId,
  customerId: id,
  amount: amount({ required: true, allowNegative: true }),
  comment: reason(),
});

export async function adjustDebtAction(storeId: number, payload: z.input<typeof adjustmentSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(adjustmentSchema, payload);
    await once(db, { key: data.requestId, action: "delivery.adjust_debt", userId: actor.userId }, (tx) =>
      createDebtAdjustment(tx, actor, data),
    );
    refresh();
  }, "ვალი დაკორექტირდა");
}

// ── Customer counts and returns ─────────────────────────────────────────────

const countSchema = z.object({
  requestId,
  customerId: id,
  lines: z
    .array(z.object({ productId: id, unitPrice: amount({ required: true }), leftoverQty: wholeNumber() }))
    .max(2000),
  comment: text(5000),
});
export type CountPayload = z.input<typeof countSchema>;

/** „განაშთვა“: the customer's shelf count. */
export async function createCountAction(storeId: number, payload: CountPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(countSchema, payload);
    await once(db, { key: data.requestId, action: "delivery.count", userId: actor.userId }, (tx) =>
      createCustomerCount(tx, actor, data),
    );
    redirect(`${storeHref(storeId, `customers/${data.customerId}`)}?tab=leftover&counted=1`);
  });
}

const returnSchema = z.object({
  requestId,
  customerId: id,
  lines: z.array(z.object({ productId: id, unitPrice: amount({ required: true }), quantity: wholeNumber() })).max(2000),
  comment: text(5000),
});
export type ReturnPayload = z.input<typeof returnSchema>;

/** „პროდუქციის გამოტანა“: goods back from the customer — debt down, stock up. */
export async function createReturnAction(storeId: number, payload: ReturnPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(returnSchema, payload);
    const created = await once(db, { key: data.requestId, action: "delivery.return", userId: actor.userId }, (tx) =>
      createCustomerReturn(tx, actor, data),
    );
    redirect(`${storeHref(storeId, `operations/${created.id}`)}?created=1`);
  });
}

// ── Orders ──────────────────────────────────────────────────────────────────

const orderSchema = deliverySchema.extend({ uploadStatus });
export type OrderPayload = z.input<typeof orderSchema>;

export async function createOrderAction(storeId: number, payload: OrderPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(orderSchema, payload);
    const created = await once(db, { key: data.requestId, action: "order.create", userId: actor.userId }, (tx) =>
      createOrder(tx, actor, data),
    );
    redirect(`${storeHref(storeId, `orders/${created.id}`)}?created=1`);
  });
}

/** `discountFactor` only when the user changed it (the line prices already carry it). */
const orderEditSchema = documentEditSchema.extend({
  uploadStatus: uploadStatus.nullable(),
  discountFactor: z.enum(factors).optional(),
});
export type OrderEditPayload = z.input<typeof orderEditSchema>;

export async function updateOrderAction(storeId: number, orderId: number, payload: OrderEditPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(orderEditSchema, payload);
    await db.transaction((tx) => updateOrder(tx, actor, orderId, data));
    refresh();
  }, "შეკვეთა შენახულია");
}

/** `edit` = the form's unsaved changes, saved in the same transaction before completing. */
export async function completeOrderAction(storeId: number, orderId: number, edit: OrderEditPayload | null) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const changes = edit ? parseInput(orderEditSchema, edit) : undefined;
    const created = await db.transaction((tx) => completeOrder(tx, actor, orderId, changes));
    redirect(`${storeHref(storeId, `operations/${created.id}`)}?fromOrder=1`);
  });
}

export async function cancelOrderAction(storeId: number, orderId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    await db.transaction((tx) => cancelOrder(tx, actor, orderId));
    refresh();
  }, "შეკვეთა გაუქმდა");
}

const quickSchema = z.object({
  uploadStatus: uploadStatus.nullable().optional(),
  comment: z
    .string()
    .max(5000, "კომენტარი ძალიან გრძელია")
    .transform((v) => v.trim())
    .optional(),
});

export async function setOrderQuickAction(storeId: number, orderId: number, fields: z.input<typeof quickSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parseInput(quickSchema, fields);
    await db.transaction((tx) => setOrderQuickFields(tx, actor, orderId, data));
    refresh();
  });
}
