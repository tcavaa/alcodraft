import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { todayIso } from "@/lib/dates";
import { type Decimal, dec, formatAmount, toDb } from "@/lib/money";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import type { Tx } from "@/server/db";
import {
  applyStockDeltas,
  assertProductsAvailable,
  customerDebt,
  defaultAccountId,
  lockProducts,
  nextNumber,
  requireCustomerInStore,
} from "@/server/db/helpers";
import { deliveries, deliveryItems, financeEntries, orderItems, orders, type products } from "@/server/db/schema";

import { UPLOAD_STATUS_LABEL } from "./labels";
import {
  type ComputedLine,
  computeLines,
  type EditedLine,
  legacyCashEffect,
  type LineEditPlan,
  type LineInput,
  type PaymentMethod,
  paymentDescription,
  paymentHitsCashBook,
  planLineEdit,
  stockDeltas,
  totalOf,
} from "./logic";

export interface Actor {
  userId: number;
  storeId: number;
}

type UploadStatus = "pending" | "uploaded";
type Product = typeof products.$inferSelect;

export interface DeliveryInput {
  customerId: number;
  lines: LineInput[];
  discountFactor: string;
  paidAmount: Decimal;
  paymentMethod: PaymentMethod;
  hasWaybill: boolean;
  comment: string;
}

/** Edit of a saved operation or open order (final unit prices, see `planLineEdit`). */
export interface DocumentEditInput {
  /** Every product the user filled plus every product already on the document. */
  lines: EditedLine[];
  paidAmount: Decimal;
  /** null only keeps the missing method of an imported document. */
  paymentMethod: PaymentMethod | null;
  hasWaybill: boolean | null;
  comment: string;
}

/** Cash-book effect of a payment: income for positive amounts, expense for refunds. */
function cashAmounts(paid: Decimal) {
  return paid.isNegative()
    ? { amountIn: "0", amountOut: toDb(paid.abs()) }
    : { amountIn: toDb(paid), amountOut: "0" };
}

function itemValues(line: ComputedLine) {
  return {
    productId: line.productId,
    unitPrice: toDb(line.unitPrice),
    quantity: line.quantity,
    giftQty: line.giftQty,
    leftoverQty: line.leftoverQty,
    lineTotal: toDb(line.lineTotal),
  };
}

/** Old add-form rule: „შეტანილი“ may not exceed the stock on hand (gifts are not checked). */
function assertStock(wanted: Map<number, number>, productsById: Map<number, Product>) {
  const short = [...wanted].filter(([id, qty]) => qty > 0 && qty > productsById.get(id)!.stockQty);
  if (short.length) {
    throw new ActionError(
      `მარაგი არ არის საკმარისი: ${short
        .map(([id, qty]) => `${productsById.get(id)!.name} (საჭიროა ${qty}, მარაგშია ${productsById.get(id)!.stockQty})`)
        .join("; ")}`,
    );
  }
}

function assertUniqueProducts(lines: { productId: number }[]) {
  if (new Set(lines.map((l) => l.productId)).size !== lines.length) {
    throw new ActionError("ერთი პროდუქტი ორჯერ არის მითითებული.");
  }
}

/** An empty method may stay empty (imported documents), but a set method can't be removed. */
function assertMethodKept(before: PaymentMethod | null, after: PaymentMethod | null) {
  if (after === null && before !== null) throw new ActionError("აირჩიეთ გადახდის მეთოდი.");
}

/** Products of an edit, locked, plus the stock changes it causes (removed rows back in, added rows out). */
async function lockEditProducts(tx: Tx, actor: Actor, plan: LineEditPlan) {
  const deltas = stockDeltas(plan.remove, 1);
  for (const [id, d] of stockDeltas(plan.add, -1)) deltas.set(id, (deltas.get(id) ?? 0) + d);
  const productsById = await lockProducts(tx, actor.storeId, [...deltas.keys()]);
  return { deltas, productsById };
}

// ────────────────────────────────────────────────────────────────────────────
// Operations (old "distribution")
// ────────────────────────────────────────────────────────────────────────────

interface InsertDeliveryArgs {
  customer: { id: number; name: string };
  lines: ComputedLine[];
  /** Defaults to Σ line totals; a completed order keeps its own saved total. */
  total?: Decimal;
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

  if (args.requireActiveProducts) assertProductsAvailable(args.lines, productsById, "არააქტიური ან სანაგვეში მყოფი პროდუქტი");
  if (args.enforceStock) {
    const wanted = new Map<number, number>();
    for (const l of args.lines) if (l.quantity > 0) wanted.set(l.productId, (wanted.get(l.productId) ?? 0) + l.quantity);
    assertStock(wanted, productsById);
  }

  const number = await nextNumber(tx, actor.storeId, "delivery");
  const total = args.total ?? totalOf(args.lines);
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
    await tx.insert(deliveryItems).values(args.lines.map((l) => ({ deliveryId: delivery.id, ...itemValues(l) })));
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
  return { id: created.id, number: created.number };
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
 * Takes a linked cash entry off the operation. An imported entry that also carries an old manual
 * balance correction keeps that correction as its own row in the same place (like `deleteEntry`).
 */
async function removeCashEntry(tx: Tx, entry: typeof financeEntries.$inferSelect) {
  if (dec(entry.adjustmentAmount).isZero()) {
    await tx.delete(financeEntries).where(eq(financeEntries.id, entry.id));
    return;
  }
  await tx
    .update(financeEntries)
    .set({
      kind: "manual",
      amountIn: "0",
      amountOut: "0",
      deliveryId: null,
      description: `ძველი სისტემის კორექტირება (${entry.description})`,
    })
    .where(eq(financeEntries.id, entry.id));
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
  if (linked.length) {
    const [first, ...rest] = linked;
    for (const extra of rest) await removeCashEntry(tx, extra);
    if (paymentHitsCashBook(after.method, after.paid)) {
      await tx
        .update(financeEntries)
        .set({ ...cashAmounts(after.paid), description: paymentDescription(customerName, after.method!) })
        .where(eq(financeEntries.id, first.id));
    } else {
      await removeCashEntry(tx, first);
    }
    return;
  }
  // No linked entry: the old app's rule decides what is already in the cash book.
  const delta = legacyCashEffect(after.method, after.paid).minus(legacyCashEffect(before.method, before.paid));
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

/**
 * Edits an operation; stock, debt and cash book follow automatically. Untouched products keep
 * their saved rows, so editing an imported operation never re-prices it behind the user's back.
 * What the edit adds follows the rules of a new operation (stock on hand, no archived products).
 */
export async function updateDelivery(tx: Tx, actor: Actor, deliveryId: number, input: DocumentEditInput) {
  const delivery = await lockDelivery(tx, actor, deliveryId);
  if (delivery.kind !== "delivery") throw new ActionError("კორექტირება არ რედაქტირდება — წაშალეთ და შექმენით ახალი.");
  assertUniqueProducts(input.lines);
  assertMethodKept(delivery.paymentMethod, input.paymentMethod);
  const customer = await requireCustomerInStore(tx, actor.storeId, delivery.customerId);
  const stored = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id));
  const plan = planLineEdit(stored, input.lines, delivery.totalAmount);
  if (plan.keep.length + plan.add.length === 0 && input.paidAmount.isZero()) {
    throw new ActionError("შეიყვანეთ რაოდენობა ან აღებული თანხა. ოპერაციის წაშლა მხოლოდ სუპერ ადმინს შეუძლია.");
  }

  const { deltas, productsById } = await lockEditProducts(tx, actor, plan);
  const before = new Set(stored.map((r) => r.productId));
  assertProductsAvailable(
    plan.add.filter((l) => !before.has(l.productId)),
    productsById,
    "არააქტიურ ან სანაგვეში მყოფ პროდუქტს ვერ დაამატებთ",
  );
  // Only what the edit delivers on top of the saved operation must be in stock.
  const increase = new Map<number, number>();
  for (const r of plan.remove) increase.set(r.productId, (increase.get(r.productId) ?? 0) - r.quantity);
  for (const l of plan.add) increase.set(l.productId, (increase.get(l.productId) ?? 0) + l.quantity);
  assertStock(increase, productsById);

  await applyStockDeltas(tx, deltas);
  if (plan.remove.length) await tx.delete(deliveryItems).where(inArray(deliveryItems.id, plan.remove.map((r) => r.id)));
  if (plan.add.length) await tx.insert(deliveryItems).values(plan.add.map((l) => ({ deliveryId: delivery.id, ...itemValues(l) })));

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
      totalAmount: toDb(plan.total),
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
    summary: `ოპერაცია #${delivery.number} შეიცვალა — ჯამი ${formatAmount(delivery.totalAmount)} → ${formatAmount(plan.total)} ₾, აღებული ${formatAmount(delivery.paidAmount)} → ${formatAmount(input.paidAmount)} ₾`,
    details: {
      before: { total: delivery.totalAmount, paid: delivery.paidAmount, method: delivery.paymentMethod, items: stored },
      after: { total: toDb(plan.total), paid: toDb(input.paidAmount), method: input.paymentMethod },
      removedItems: plan.remove.map((r) => r.id),
      addedItems: plan.add.map(itemValues),
    },
  });
}

/**
 * Deletes an operation and undoes its stock and cash effects; a completed order is reopened.
 * An imported operation that carries an old manual debt correction is turned into a
 * correction-only row instead, so the debt of every later operation stays as it was.
 * `expectedKind` is what the person confirmed: a second delete of the same row (another tab)
 * would otherwise remove the correction that the first one kept.
 */
export async function deleteDelivery(
  tx: Tx,
  actor: Actor,
  deliveryId: number,
  expectedKind: "delivery" | "adjustment",
) {
  // Orders first, then the operation — the same order as order quick edits (no deadlock).
  await tx.select({ id: orders.id }).from(orders).where(eq(orders.deliveryId, deliveryId)).for("update");
  const delivery = await lockDelivery(tx, actor, deliveryId);
  if (delivery.kind !== expectedKind) throw new ActionError("ოპერაცია ამასობაში შეიცვალა — განაახლეთ გვერდი.");
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

  const keptCorrection = delivery.kind === "delivery" && !dec(delivery.adjustmentAmount).isZero();
  if (keptCorrection) {
    await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryId, delivery.id));
    await tx
      .update(deliveries)
      .set({
        kind: "adjustment",
        totalAmount: "0",
        paidAmount: "0",
        paymentMethod: null,
        hasWaybill: null,
        discountFactor: null,
        uploadStatus: null,
        comment: `ძველი სისტემის კორექტირება — ოპერაცია #${delivery.number} წაიშალა.${delivery.comment ? `\n${delivery.comment}` : ""}`,
      })
      .where(eq(deliveries.id, delivery.id));
  } else {
    await tx.delete(deliveries).where(eq(deliveries.id, delivery.id));
  }
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "delivery.delete",
    entityType: "delivery",
    entityId: delivery.id,
    summary: `წაიშალა ოპერაცია #${delivery.number} — ${customer.name}: ${formatAmount(delivery.totalAmount)} ₾${
      keptCorrection ? ` (ძველი კორექტირება ${formatAmount(delivery.adjustmentAmount)} ₾ დარჩა)` : ""
    }`,
    details: { delivery, items, keptCorrection },
  });
  return { keptCorrection };
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
  assertProductsAvailable(lines, productsById, "შეკვეთაში არააქტიური ან სანაგვეში მყოფი პროდუქტია");

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
  await tx.insert(orderItems).values(lines.map((l) => ({ orderId: order.id, ...itemValues(l) })));
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

export interface OrderEditInput extends DocumentEditInput {
  uploadStatus: UploadStatus | null;
  /** Set when the discount was changed; the submitted prices are already at the new discount. */
  discountFactor?: string;
}

/**
 * Old orders/edit: prices are final per line; the discount is not applied again. New: the
 * discount can be changed — the form moves the line prices, this records the new factor.
 */
export async function updateOrder(tx: Tx, actor: Actor, orderId: number, input: OrderEditInput) {
  const order = await lockOrder(tx, actor, orderId);
  if (order.status !== "open") throw new ActionError("დასრულებული ან გაუქმებული შეკვეთა არ რედაქტირდება.");
  assertUniqueProducts(input.lines);
  assertMethodKept(order.paymentMethod, input.paymentMethod);
  const stored = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const plan = planLineEdit(stored, input.lines, order.totalAmount);
  if (plan.keep.length + plan.add.length === 0) throw new ActionError("შეკვეთაში არცერთი პროდუქტი არ არის.");
  // Orders don't move stock; the lock only keeps products from changing store/archive state meanwhile.
  const { productsById } = await lockEditProducts(tx, actor, plan);
  const before = new Set(stored.map((r) => r.productId));
  assertProductsAvailable(
    plan.add.filter((l) => !before.has(l.productId)),
    productsById,
    "არააქტიურ ან სანაგვეში მყოფ პროდუქტს ვერ დაამატებთ",
  );

  if (plan.remove.length) await tx.delete(orderItems).where(inArray(orderItems.id, plan.remove.map((r) => r.id)));
  if (plan.add.length) await tx.insert(orderItems).values(plan.add.map((l) => ({ orderId: order.id, ...itemValues(l) })));
  await tx
    .update(orders)
    .set({
      totalAmount: toDb(plan.total),
      paidAmount: toDb(input.paidAmount),
      paymentMethod: input.paymentMethod,
      hasWaybill: input.hasWaybill,
      uploadStatus: input.uploadStatus,
      comment: input.comment,
      ...(input.discountFactor !== undefined ? { discountFactor: input.discountFactor } : {}),
    })
    .where(eq(orders.id, order.id));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "order.update",
    entityType: "order",
    entityId: order.id,
    summary: `შეკვეთა #${order.number} შეიცვალა — ჯამი ${formatAmount(order.totalAmount)} → ${formatAmount(plan.total)} ₾`,
    details: {
      before: {
        total: order.totalAmount,
        paid: order.paidAmount,
        method: order.paymentMethod,
        discountFactor: order.discountFactor,
        items: stored,
      },
      discountFactor: input.discountFactor,
      removedItems: plan.remove.map((r) => r.id),
      addedItems: plan.add.map(itemValues),
    },
  });
}

/**
 * Old orders/finish: turns the order into an operation with the same lines,
 * takes the goods from stock (no stock check) and books the payment.
 * `edit` = changes still unsaved in the form; they are saved first, in the same transaction.
 */
export async function completeOrder(tx: Tx, actor: Actor, orderId: number, edit?: OrderEditInput) {
  if (edit) {
    // Lock every product the edit and the completion touch at once, in id order, so the two
    // steps don't take product locks in a different order than a concurrent operation.
    await lockOrder(tx, actor, orderId);
    const current = await tx.select({ productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, orderId));
    await lockProducts(tx, actor.storeId, [...current.map((i) => i.productId), ...edit.lines.map((l) => l.productId)]);
    await updateOrder(tx, actor, orderId, edit);
  }
  const order = await lockOrder(tx, actor, orderId);
  if (order.status !== "open") throw new ActionError("შეკვეთა უკვე დასრულებული ან გაუქმებულია.");
  if (order.paymentMethod === null && !dec(order.paidAmount).isZero()) {
    throw new ActionError("შეკვეთას გადახდის მეთოდი არ აქვს — აირჩიეთ მეთოდი და შემდეგ დაასრულეთ.");
  }
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
    total: dec(order.totalAmount),
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
  return { id: created.id, number: created.number };
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

/**
 * Quick edits from the order lists (old inline forms). Allowed in any status. The RS status of a
 * completed order is copied to its operation, which shows the same waybill.
 */
export async function setOrderQuickFields(
  tx: Tx,
  actor: Actor,
  orderId: number,
  fields: { uploadStatus?: UploadStatus | null; comment?: string },
) {
  const order = await lockOrder(tx, actor, orderId);
  const changes: string[] = [];
  if (fields.uploadStatus !== undefined && fields.uploadStatus !== order.uploadStatus) {
    const label = (s: UploadStatus | null) => (s ? UPLOAD_STATUS_LABEL[s] : "—");
    changes.push(`RS სტატუსი: ${label(order.uploadStatus)} → ${label(fields.uploadStatus)}`);
  }
  if (fields.comment !== undefined && fields.comment !== order.comment) changes.push("კომენტარი შეიცვალა");
  if (changes.length === 0) return;

  await tx.update(orders).set(fields).where(eq(orders.id, order.id));
  if (fields.uploadStatus !== undefined && order.deliveryId) {
    await tx.update(deliveries).set({ uploadStatus: fields.uploadStatus }).where(eq(deliveries.id, order.deliveryId));
  }
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "order.quick_edit",
    entityType: "order",
    entityId: order.id,
    summary: `შეკვეთა #${order.number}: ${changes.join("; ")}`,
    details: { before: { uploadStatus: order.uploadStatus, comment: order.comment }, after: fields },
  });
}
