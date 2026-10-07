"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { storeHref } from "@/lib/routes";
import { amount, id, text, wholeNumber } from "@/lib/validation";
import { ActionError, fieldErrorsFrom, runAction } from "@/server/action";
import { authorizeStore } from "@/server/auth/dal";
import { db } from "@/server/db";

import { DISCOUNT_OPTIONS } from "./logic";
import {
  cancelOrder,
  completeOrder,
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
  customerId: id,
  lines: z.array(entryLine).max(2000),
  discountFactor: z.enum(factors),
  paidAmount: amount({ allowNegative: true }),
  paymentMethod: method,
  hasWaybill: z.boolean(),
  comment: text(5000),
});

function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ActionError("შეასწორეთ მონიშნული ველები.", fieldErrorsFrom(parsed.error));
  return parsed.data;
}

// ── Operations ──────────────────────────────────────────────────────────────

export type DeliveryPayload = z.input<typeof deliverySchema>;

export async function createDeliveryAction(storeId: number, payload: DeliveryPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(deliverySchema, payload);
    const created = await db.transaction((tx) =>
      createDelivery(tx, actor, {
        ...data,
        lines: data.lines.map((l) => ({ ...l, price: l.price })),
      }),
    );
    redirect(`${storeHref(storeId, `operations/${created.id}`)}?created=1`);
  });
}

const deliveryEditSchema = z.object({
  lines: z.array(finalLine).max(2000),
  paidAmount: amount({ allowNegative: true }),
  paymentMethod: method,
  hasWaybill: z.boolean().nullable(),
  comment: text(5000),
});
export type DeliveryEditPayload = z.input<typeof deliveryEditSchema>;

export async function updateDeliveryAction(storeId: number, deliveryId: number, payload: DeliveryEditPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(deliveryEditSchema, payload);
    await db.transaction((tx) =>
      updateDelivery(tx, actor, deliveryId, {
        ...data,
        lines: data.lines.map((l) => ({ ...l, unitPrice: l.unitPrice.toFixed(4) })),
      }),
    );
    redirect(`${storeHref(storeId, `operations/${deliveryId}`)}?updated=1`);
  });
}

export async function deleteDeliveryAction(storeId: number, deliveryId: number, customerId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId, { superAdminOnly: true });
    await db.transaction((tx) => deleteDelivery(tx, actor, deliveryId));
    redirect(storeHref(storeId, `customers/${customerId}`));
  });
}

const adjustmentSchema = z.object({
  customerId: id,
  amount: amount({ required: true, allowNegative: true }),
  comment: z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().min(3, "მიუთითეთ მიზეზი").max(2000)),
});

export async function adjustDebtAction(storeId: number, payload: z.input<typeof adjustmentSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(adjustmentSchema, payload);
    await db.transaction((tx) => createDebtAdjustment(tx, actor, data));
    refresh();
  }, "ვალი დაკორექტირდა");
}

// ── Orders ──────────────────────────────────────────────────────────────────

const orderSchema = deliverySchema.extend({ uploadStatus: z.enum(["pending", "uploaded"]) });
export type OrderPayload = z.input<typeof orderSchema>;

export async function createOrderAction(storeId: number, payload: OrderPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(orderSchema, payload);
    const created = await db.transaction((tx) => createOrder(tx, actor, data));
    redirect(`${storeHref(storeId, `orders/${created.id}`)}?created=1`);
  });
}

const orderEditSchema = deliveryEditSchema.extend({ uploadStatus: z.enum(["pending", "uploaded"]).nullable() });
export type OrderEditPayload = z.input<typeof orderEditSchema>;

export async function updateOrderAction(storeId: number, orderId: number, payload: OrderEditPayload) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(orderEditSchema, payload);
    await db.transaction((tx) =>
      updateOrder(tx, actor, orderId, {
        ...data,
        lines: data.lines.map((l) => ({ ...l, unitPrice: l.unitPrice.toFixed(4) })),
      }),
    );
    refresh();
  }, "შეკვეთა შენახულია");
}

export async function completeOrderAction(storeId: number, orderId: number) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const created = await db.transaction((tx) => completeOrder(tx, actor, orderId));
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
  uploadStatus: z.enum(["pending", "uploaded"]).nullable().optional(),
  comment: z.string().max(5000).optional(),
});

export async function setOrderQuickAction(storeId: number, orderId: number, fields: z.input<typeof quickSchema>) {
  return runAction(async () => {
    const { actor } = await authorizeStore(storeId);
    const data = parse(quickSchema, fields);
    await db.transaction((tx) =>
      setOrderQuickFields(tx, actor, orderId, {
        ...(data.uploadStatus !== undefined ? { uploadStatus: data.uploadStatus } : {}),
        ...(data.comment !== undefined ? { comment: data.comment.trim() } : {}),
      }),
    );
    refresh();
  });
}
