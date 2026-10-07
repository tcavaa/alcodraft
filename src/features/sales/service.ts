import "server-only";

import { and, eq } from "drizzle-orm";

import { todayIso } from "@/lib/dates";
import { type Decimal, dec, formatAmount, toDb } from "@/lib/money";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import type { Tx } from "@/server/db";
import {
  applyStockDeltas,
  customerDebt,
  defaultAccountId,
  lockProducts,
  nextNumber,
  requireCustomerInStore,
} from "@/server/db/helpers";
import { deliveries, deliveryItems, financeEntries, orderItems, orders } from "@/server/db/schema";

import {
  type ComputedLine,
  computeFinalLines,
  computeLines,
  type LineInput,
  type PaymentMethod,
  paymentDescription,
  paymentHitsCashBook,
  stockDeltas,
  totalOf,
} from "./logic";

export interface Actor {
  userId: number;
  storeId: number;
}

type UploadStatus = "pending" | "uploaded";

export interface DeliveryInput {
  customerId: number;
  lines: LineInput[];
  discountFactor: string;
  paidAmount: Decimal;
  paymentMethod: PaymentMethod;
  hasWaybill: boolean;
  comment: string;
}

export interface FinalLineInput {
  productId: number;
  unitPrice: string;
  quantity: number;
  giftQty: number;
  leftoverQty: number;
}

/** Cash-book effect of a payment: income for positive amounts, expense for refunds. */
function cashAmounts(paid: Decimal) {
  return paid.isNegative()
    ? { amountIn: "0", amountOut: toDb(paid.abs()) }
    : { amountIn: toDb(paid), amountOut: "0" };
}

// ────────────────────────────────────────────────────────────────────────────
// Operations (old "distribution")
// ────────────────────────────────────────────────────────────────────────────

interface InsertDeliveryArgs {
  customer: { id: number; name: string };
  lines: ComputedLine[];
  discountFactor: string | null;
  paid: Decimal;
  method: PaymentMethod | null;
  hasWaybill: boolean | null;
  uploadStatus: UploadStatus | null;
  comment: string;
  /** Old add-form limited "შეტანილი" to the stock on hand; order completion did not. */
  enforceStock: boolean;
  requireActiveProducts: boolean;
}

async function insertDelivery(tx: Tx, actor: Actor, args: InsertDeliveryArgs) {
  const productsById = await lockProducts(
    tx,
    actor.storeId,
    args.lines.map((l) => l.productId),
  );

  if (args.requireActiveProducts) {
    const archived = args.lines.filter((l) => productsById.get(l.productId)?.isArchived);
    if (archived.length) {
      throw new ActionError(`არქივირებული პროდუქტი: ${archived.map((l) => productsById.get(l.productId)!.name).join(", ")}`);
    }
  }
  if (args.enforceStock) {
    const wanted = new Map<number, number>();
    for (const l of args.lines) if (l.quantity > 0) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.quantity);
    const short = [...wanted].filter(([id, qty]) => qty > productsById.get(id)!.stockQty);
    if (short.length) {
      throw new ActionError(
        `მარაგი არ არის საკმარისი: ${short
          .map(([id, qty]) => `${productsById.get(id)!.name} (საჭიროა ${qty}, მარაგშია ${productsById.get(id)!.stockQty})`)
          .join("; ")}`,
      );
    }
  }

  const number = await nextNumber(tx, actor.storeId, "delivery");
  const total = totalOf(args.lines);
  const [delivery] = await tx
    .insert(deliveries)
    .values({
      storeId: actor.storeId,
      customerId: args.customer.id,
      number,
      kind: "delivery",
      deliveryDate: todayIso(),
      totalAmount: toDb(total),
      paidAmount: toDb(args.paid),
      paymentMethod: args.method,
      hasWaybill: args.hasWaybill,
      discountFactor: args.discountFactor,
      uploadStatus: args.uploadStatus,
      comment: args.comment,
      createdById: actor.userId,
    })
    .returning({ id: deliveries.id });

  if (args.lines.length) {
    await tx.insert(deliveryItems).values(
      args.lines.map((l) => ({
        deliveryId: delivery.id,
        productId: l.productId,
        unitPrice: toDb(l.unitPrice),
        quantity: l.quantity,
        giftQty: l.giftQty,
        leftoverQty: l.leftoverQty,
        lineTotal: toDb(l.lineTotal),
      })),
    );
  }
  await applyStockDeltas(tx, stockDeltas(args.lines, -1));

  if (paymentHitsCashBook(args.method, args.paid)) {
    await tx.insert(financeEntries).values({
      storeId: actor.storeId,
      accountId: await defaultAccountId(tx, actor.storeId),
      entryDate: todayIso(),
      kind: "delivery",
      ...cashAmounts(args.paid),
      description: paymentDescription(args.customer.name, args.method!),
      deliveryId: delivery.id,
      createdById: actor.userId,
    });
  }

  return { id: delivery.id, number, total };
}

/** New operation from the "დღის ჩახურვა" form. */
export async function createDelivery(tx: Tx, actor: Actor, input: DeliveryInput) {
  const customer = await requireCustomerInStore(tx, actor.storeId, input.customerId);
  if (customer.isArchived) throw new ActionError("კლიენტი სანაგვეშია — ჯერ აღადგინეთ.");
  const lines = computeLines(input.lines, input.discountFactor);
  if (lines.length === 0 && input.paidAmount.isZero()) {
    throw new ActionError("შეიყვანეთ რაოდენობა ან აღებული თანხა.");
  }
  const created = await insertDelivery(tx, actor, {
    customer,
    lines,
    discountFactor: input.discountFactor,
    paid: input.paidAmount,
    method: input.paymentMethod,
    hasWaybill: input.hasWaybill,
    uploadStatus: null,
    comment: input.comment,
    enforceStock: true,
    requireActiveProducts: true,
  });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "delivery.create",
    entityType: "delivery",
    entityId: created.id,
    summary: `ოპერაცია #${created.number} — ${customer.name}: ${formatAmount(created.total)} ₾, აღებული ${formatAmount(input.paidAmount)} ₾`,
  });
  return created;
}

async function lockDelivery(tx: Tx, actor: Actor, deliveryId: number) {
  const [row] = await tx
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.id, deliveryId), eq(deliveries.storeId, actor.storeId)))
    .for("update");
  if (!row) throw new ActionError("ოპერაცია ვერ მოიძებნა.");
  return row;
}

/**
 * Keeps the cash book equal to the operation's payment.
 * Linked entry → updated in place. Imported operations whose cash entry could not be
 * linked get an appended correction for the difference instead.
 */
async function reconcileCash(
  tx: Tx,
  actor: Actor,
  delivery: { id: number; number: number },
  customerName: string,
  before: { paid: Decimal; method: PaymentMethod | null },
  after: { paid: Decimal; method: PaymentMethod | null },
  reason: "edit" | "delete",
) {
  const linked = await tx.select().from(financeEntries).where(eq(financeEntries.deliveryId, delivery.id));
  const hits = paymentHitsCashBook(after.method, after.paid);
  if (linked.length) {
    const [first, ...rest] = linked;
    for (const extra of rest) await tx.delete(financeEntries).where(eq(financeEntries.id, extra.id));
    if (hits) {
      await tx
        .update(financeEntries)
        .set({ ...cashAmounts(after.paid), description: paymentDescription(customerName, after.method!) })
        .where(eq(financeEntries.id, first.id));
    } else {
      await tx.delete(financeEntries).where(eq(financeEntries.id, first.id));
    }
    return;
  }
  // The old app booked every payment except "back" — also rows saved before it recorded a
  // method (method null) — so that is what the imported, unlinked cash book contains.
  const oldEffect = before.method === "back" ? dec(0) : before.paid;
  const newEffect = hits ? after.paid : dec(0);
  const delta = newEffect.minus(oldEffect);
  if (delta.isZero()) return;
  await tx.insert(financeEntries).values({
    storeId: actor.storeId,
    accountId: await defaultAccountId(tx, actor.storeId),
    entryDate: todayIso(),
    kind: "manual",
    ...cashAmounts(delta),
    description: `${customerName} — ${reason === "delete" ? "წაშლილი" : "შესწორებული"} ოპერაცია #${delivery.number}`,
    createdById: actor.userId,
  });
}

export interface DeliveryEditInput {
  lines: FinalLineInput[];
  paidAmount: Decimal;
  paymentMethod: PaymentMethod;
  hasWaybill: boolean | null;
  comment: string;
}

/** Edits an operation; stock, debt and cash book follow automatically. */
export async function updateDelivery(tx: Tx, actor: Actor, deliveryId: number, input: DeliveryEditInput) {
  const delivery = await lockDelivery(tx, actor, deliveryId);
  if (delivery.kind !== "delivery") throw new ActionError("კორექტირება არ რედაქტირდება — წაშალეთ და შექმენით ახალი.");
  const customer = await requireCustomerInStore(tx, actor.storeId, delivery.customerId);
  const oldItems = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id));
  const lines = computeFinalLines(input.lines);

  const deltas = stockDeltas(oldItems, 1);
  for (const [id, d] of stockDeltas(lines, -1)) deltas.set(id, (deltas.get(id) ?? 0) + d);
  await lockProducts(tx, actor.storeId, [...deltas.keys()]);
  await applyStockDeltas(tx, deltas);

  await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id));
  if (lines.length) {
    await tx.insert(deliveryItems).values(
      lines.map((l) => ({
        deliveryId: delivery.id,
        productId: l.productId,
        unitPrice: toDb(l.unitPrice),
        quantity: l.quantity,
        giftQty: l.giftQty,
        leftoverQty: l.leftoverQty,
        lineTotal: toDb(l.lineTotal),
      })),
    );
  }

  const total = totalOf(lines);
  await reconcileCash(
    tx,
    actor,
    delivery,
    customer.name,
    { paid: dec(delivery.paidAmount), method: delivery.paymentMethod },
    { paid: input.paidAmount, method: input.paymentMethod },
    "edit",
  );
  await tx
    .update(deliveries)
    .set({
      totalAmount: toDb(total),
      paidAmount: toDb(input.paidAmount),
      paymentMethod: input.paymentMethod,
      hasWaybill: input.hasWaybill,
      comment: input.comment,
    })
    .where(eq(deliveries.id, delivery.id));

  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "delivery.update",
    entityType: "delivery",
    entityId: delivery.id,
    summary: `ოპერაცია #${delivery.number} შეიცვალა — ჯამი ${formatAmount(delivery.totalAmount)} → ${formatAmount(total)} ₾, აღებული ${formatAmount(delivery.paidAmount)} → ${formatAmount(input.paidAmount)} ₾`,
    details: { before: { total: delivery.totalAmount, paid: delivery.paidAmount, items: oldItems.length }, after: { total: toDb(total), paid: toDb(input.paidAmount), items: lines.length } },
  });
}

/** Deletes an operation and undoes its stock and cash effects; a completed order is reopened. */
export async function deleteDelivery(tx: Tx, actor: Actor, deliveryId: number) {
  const delivery = await lockDelivery(tx, actor, deliveryId);
  const customer = await requireCustomerInStore(tx, actor.storeId, delivery.customerId);
  const items = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id));
  const deltas = stockDeltas(items, 1);
  await lockProducts(tx, actor.storeId, [...deltas.keys()]);
  await applyStockDeltas(tx, deltas);
  await reconcileCash(
    tx,
    actor,
    delivery,
    customer.name,
    { paid: dec(delivery.paidAmount), method: delivery.paymentMethod },
    { paid: dec(0), method: null },
    "delete",
  );
  await tx
    .update(orders)
    .set({ status: "open", deliveryId: null, completedAt: null })
    .where(eq(orders.deliveryId, delivery.id));
  await tx.delete(deliveries).where(eq(deliveries.id, delivery.id));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "delivery.delete",
    entityType: "delivery",
    entityId: delivery.id,
    summary: `წაიშალა ოპერაცია #${delivery.number} — ${customer.name}: ${formatAmount(delivery.totalAmount)} ₾`,
    details: { delivery, items },
  });
}

/** A manual debt correction (replaces editing the database by hand). */
export async function createDebtAdjustment(
  tx: Tx,
  actor: Actor,
  input: { customerId: number; amount: Decimal; comment: string },
) {
  const customer = await requireCustomerInStore(tx, actor.storeId, input.customerId);
  if (input.amount.isZero()) throw new ActionError("თანხა არ შეიძლება იყოს 0.");
  const number = await nextNumber(tx, actor.storeId, "delivery");
  const [row] = await tx
    .insert(deliveries)
    .values({
      storeId: actor.storeId,
      customerId: customer.id,
      number,
      kind: "adjustment",
      deliveryDate: todayIso(),
      adjustmentAmount: toDb(input.amount),
      comment: input.comment,
      createdById: actor.userId,
    })
    .returning({ id: deliveries.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "delivery.adjust_debt",
    entityType: "delivery",
    entityId: row.id,
    summary: `ვალის კორექტირება — ${customer.name}: ${input.amount.isNegative() ? "" : "+"}${formatAmount(input.amount)} ₾`,
  });
  return { id: row.id, number };
}

// ────────────────────────────────────────────────────────────────────────────
// Orders
// ────────────────────────────────────────────────────────────────────────────

export interface OrderInput extends DeliveryInput {
  uploadStatus: UploadStatus;
}

export async function createOrder(tx: Tx, actor: Actor, input: OrderInput) {
  const customer = await requireCustomerInStore(tx, actor.storeId, input.customerId);
  if (customer.isArchived) throw new ActionError("კლიენტი სანაგვეშია — ჯერ აღადგინეთ.");
  const lines = computeLines(input.lines, input.discountFactor);
  if (lines.length === 0) throw new ActionError("შეკვეთაში არცერთი პროდუქტი არ არის.");
  const productsById = await lockProducts(tx, actor.storeId, lines.map((l) => l.productId));
  const archived = lines.filter((l) => productsById.get(l.productId)?.isArchived);
  if (archived.length) throw new ActionError("შეკვეთაში არქივირებული პროდუქტია.");

  const total = totalOf(lines);
  // Old rule: debt shown on the order = customer's current debt (or the order total for a first order).
  const hasHistory = await tx
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(eq(deliveries.customerId, customer.id))
    .limit(1);
  const debtSnapshot = hasHistory.length ? await customerDebt(tx, customer.id) : total;

  const number = await nextNumber(tx, actor.storeId, "order");
  const [order] = await tx
    .insert(orders)
    .values({
      storeId: actor.storeId,
      customerId: customer.id,
      number,
      orderDate: todayIso(),
      status: "open",
      totalAmount: toDb(total),
      paidAmount: toDb(input.paidAmount),
      debtSnapshot: toDb(debtSnapshot),
      paymentMethod: input.paymentMethod,
      hasWaybill: input.hasWaybill,
      discountFactor: input.discountFactor,
      uploadStatus: input.uploadStatus,
      comment: input.comment,
      createdById: actor.userId,
    })
    .returning({ id: orders.id });
  await tx.insert(orderItems).values(
    lines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      unitPrice: toDb(l.unitPrice),
      quantity: l.quantity,
      giftQty: l.giftQty,
      leftoverQty: l.leftoverQty,
      lineTotal: toDb(l.lineTotal),
    })),
  );
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "order.create",
    entityType: "order",
    entityId: order.id,
    summary: `შეკვეთა #${number} — ${customer.name}: ${formatAmount(total)} ₾`,
  });
  return { id: order.id, number };
}

async function lockOrder(tx: Tx, actor: Actor, orderId: number) {
  const [row] = await tx
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, actor.storeId)))
    .for("update");
  if (!row) throw new ActionError("შეკვეთა ვერ მოიძებნა.");
  return row;
}

export interface OrderEditInput {
  lines: FinalLineInput[];
  paidAmount: Decimal;
  paymentMethod: PaymentMethod;
  hasWaybill: boolean | null;
  uploadStatus: UploadStatus | null;
  comment: string;
}

/** Old orders/edit: prices are final per line; the discount is not applied again. */
export async function updateOrder(tx: Tx, actor: Actor, orderId: number, input: OrderEditInput) {
  const order = await lockOrder(tx, actor, orderId);
  if (order.status !== "open") throw new ActionError("დასრულებული ან გაუქმებული შეკვეთა არ რედაქტირდება.");
  const lines = computeFinalLines(input.lines);
  if (lines.length === 0) throw new ActionError("შეკვეთაში არცერთი პროდუქტი არ არის.");
  await lockProducts(tx, actor.storeId, lines.map((l) => l.productId));
  await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
  await tx.insert(orderItems).values(
    lines.map((l) => ({
      orderId: order.id,
      productId: l.productId,
      unitPrice: toDb(l.unitPrice),
      quantity: l.quantity,
      giftQty: l.giftQty,
      leftoverQty: l.leftoverQty,
      lineTotal: toDb(l.lineTotal),
    })),
  );
  const total = totalOf(lines);
  await tx
    .update(orders)
    .set({
      totalAmount: toDb(total),
      paidAmount: toDb(input.paidAmount),
      paymentMethod: input.paymentMethod,
      hasWaybill: input.hasWaybill,
      uploadStatus: input.uploadStatus,
      comment: input.comment,
    })
    .where(eq(orders.id, order.id));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "order.update",
    entityType: "order",
    entityId: order.id,
    summary: `შეკვეთა #${order.number} შეიცვალა — ჯამი ${formatAmount(order.totalAmount)} → ${formatAmount(total)} ₾`,
  });
}

/**
 * Old orders/finish: turns the order into an operation with the same lines,
 * takes the goods from stock (no stock check) and books the payment.
 */
export async function completeOrder(tx: Tx, actor: Actor, orderId: number) {
  const order = await lockOrder(tx, actor, orderId);
  if (order.status !== "open") throw new ActionError("შეკვეთა უკვე დასრულებული ან გაუქმებულია.");
  const customer = await requireCustomerInStore(tx, actor.storeId, order.customerId);
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const lines: ComputedLine[] = items.map((i) => ({
    productId: i.productId,
    unitPrice: dec(i.unitPrice),
    quantity: i.quantity,
    giftQty: i.giftQty,
    leftoverQty: i.leftoverQty,
    lineTotal: dec(i.lineTotal),
  }));
  const created = await insertDelivery(tx, actor, {
    customer,
    lines,
    discountFactor: order.discountFactor,
    paid: dec(order.paidAmount),
    method: order.paymentMethod,
    hasWaybill: order.hasWaybill,
    uploadStatus: order.uploadStatus,
    comment: order.comment,
    enforceStock: false,
    requireActiveProducts: false,
  });
  await tx
    .update(orders)
    .set({ status: "completed", deliveryId: created.id, completedAt: new Date() })
    .where(eq(orders.id, order.id));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "order.complete",
    entityType: "order",
    entityId: order.id,
    summary: `შეკვეთა #${order.number} დასრულდა → ოპერაცია #${created.number} (${customer.name})`,
  });
  return created;
}

export async function cancelOrder(tx: Tx, actor: Actor, orderId: number) {
  const order = await lockOrder(tx, actor, orderId);
  if (order.status !== "open") throw new ActionError("მხოლოდ ღია შეკვეთა უქმდება.");
  await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, order.id));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "order.cancel",
    entityType: "order",
    entityId: order.id,
    summary: `შეკვეთა #${order.number} გაუქმდა`,
  });
}

/** Quick edits from the order lists (old inline forms). Allowed in any status. */
export async function setOrderQuickFields(
  tx: Tx,
  actor: Actor,
  orderId: number,
  fields: { uploadStatus?: UploadStatus | null; comment?: string },
) {
  const order = await lockOrder(tx, actor, orderId);
  await tx.update(orders).set(fields).where(eq(orders.id, order.id));
}
