import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { todayIso } from "@/lib/dates";
import { type Decimal, dec, formatAmount, toDb } from "@/lib/money";
import { ActionError } from "@/server/action";
import { audit } from "@/server/audit";
import type { Tx } from "@/server/db";
import { lockProducts } from "@/server/db/helpers";
import {
  customers,
  deliveries,
  deliveryItems,
  financeEntries,
  orderItems,
  orders,
  productPriceChanges,
  products,
  stockAdjustments,
  stockReceiptItems,
  stockReceipts,
  suppliers,
} from "@/server/db/schema";

import type { Actor } from "../sales/service";

// ── Products (old "drinks") ─────────────────────────────────────────────────

export interface ProductInput {
  name: string;
  supplierId: number | null;
  salePrice: Decimal;
  purchasePrice: Decimal;
  comment: string;
}

async function assertSupplier(tx: Tx, storeId: number, supplierId: number | null) {
  if (supplierId === null) return;
  const [row] = await tx
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, storeId)));
  if (!row) throw new ActionError("მომწოდებელი ვერ მოიძებნა.");
}

export async function createProduct(tx: Tx, actor: Actor, input: ProductInput) {
  await assertSupplier(tx, actor.storeId, input.supplierId);
  const [row] = await tx
    .insert(products)
    .values({
      storeId: actor.storeId,
      supplierId: input.supplierId,
      name: input.name,
      salePrice: toDb(input.salePrice),
      purchasePrice: toDb(input.purchasePrice),
      comment: input.comment,
      stockQty: 0,
    })
    .returning({ id: products.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "product.create",
    entityType: "product",
    entityId: row.id,
    summary: `ახალი პროდუქტი: ${input.name}`,
  });
  return row;
}

/** Old drinks/edit: the previous prices are kept in the change history. */
export async function updateProduct(tx: Tx, actor: Actor, productId: number, input: ProductInput) {
  const product = (await lockProducts(tx, actor.storeId, [productId])).get(productId)!;
  await assertSupplier(tx, actor.storeId, input.supplierId);
  const priceChanged =
    !dec(product.salePrice).equals(input.salePrice) || !dec(product.purchasePrice).equals(input.purchasePrice);
  if (priceChanged) {
    await tx.insert(productPriceChanges).values({
      productId,
      oldSalePrice: product.salePrice,
      oldPurchasePrice: product.purchasePrice,
      newSalePrice: toDb(input.salePrice),
      newPurchasePrice: toDb(input.purchasePrice),
      changedOn: todayIso(),
      changedById: actor.userId,
    });
  }
  await tx
    .update(products)
    .set({
      name: input.name,
      supplierId: input.supplierId,
      salePrice: toDb(input.salePrice),
      purchasePrice: toDb(input.purchasePrice),
      comment: input.comment,
    })
    .where(eq(products.id, productId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "product.update",
    entityType: "product",
    entityId: productId,
    summary: priceChanged
      ? `${input.name}: ფასი ${formatAmount(product.salePrice)} → ${formatAmount(input.salePrice)}, შემოტანის ${formatAmount(product.purchasePrice)} → ${formatAmount(input.purchasePrice)}`
      : `${input.name}: მონაცემები განახლდა`,
  });
}

export async function setProductArchived(tx: Tx, actor: Actor, productId: number, archived: boolean) {
  const product = (await lockProducts(tx, actor.storeId, [productId])).get(productId)!;
  await tx.update(products).set({ isArchived: archived }).where(eq(products.id, productId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: archived ? "product.archive" : "product.restore",
    entityType: "product",
    entityId: productId,
    summary: `${product.name} ${archived ? "გადავიდა სანაგვეში" : "აღდგა"}`,
  });
}

/**
 * Inventory count: sets the stock to what is physically there, with a reason. `expectedQty` is the
 * stock the dialog showed; if goods came in or went out since, the count is refused so the person
 * can re-check instead of wiping that movement.
 */
export async function adjustProductStock(
  tx: Tx,
  actor: Actor,
  productId: number,
  input: { newQty: number; expectedQty: number; reason: string },
) {
  const product = (await lockProducts(tx, actor.storeId, [productId])).get(productId)!;
  if (product.stockQty !== input.expectedQty) {
    throw new ActionError(`მარაგი ამასობაში შეიცვალა (ახლა ${product.stockQty}). გადაამოწმეთ და სცადეთ თავიდან.`, {
      newQty: `ახლანდელი მარაგი: ${product.stockQty}`,
    });
  }
  const delta = input.newQty - product.stockQty;
  if (delta === 0) return;
  await tx.insert(stockAdjustments).values({
    storeId: actor.storeId,
    productId,
    quantityDelta: delta,
    stockBefore: product.stockQty,
    reason: input.reason,
    createdById: actor.userId,
  });
  await tx.update(products).set({ stockQty: input.newQty }).where(eq(products.id, productId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "product.adjust_stock",
    entityType: "product",
    entityId: productId,
    summary: `${product.name}: მარაგი ${product.stockQty} → ${input.newQty} (${input.reason || "მიზეზის გარეშე"})`,
  });
}

/** Hard delete — only for products that never appeared anywhere. */
export async function deleteProduct(tx: Tx, actor: Actor, productId: number) {
  const product = (await lockProducts(tx, actor.storeId, [productId])).get(productId)!;
  const [used] = await tx.execute<{ used: boolean }>(sql`
    SELECT EXISTS (SELECT 1 FROM ${deliveryItems} WHERE ${deliveryItems.productId} = ${productId})
        OR EXISTS (SELECT 1 FROM ${orderItems} WHERE ${orderItems.productId} = ${productId})
        OR EXISTS (SELECT 1 FROM ${stockReceiptItems} WHERE ${stockReceiptItems.productId} = ${productId})
        OR EXISTS (SELECT 1 FROM ${stockAdjustments} WHERE ${stockAdjustments.productId} = ${productId}) AS used
  `).then((r) => r.rows);
  if (used?.used) throw new ActionError("პროდუქტს აქვს ისტორია — წაშლა შეუძლებელია, გადაიტანეთ სანაგვეში.");
  await tx.delete(productPriceChanges).where(eq(productPriceChanges.productId, productId));
  await tx.delete(products).where(eq(products.id, productId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "product.delete",
    entityType: "product",
    entityId: productId,
    summary: `წაიშალა პროდუქტი: ${product.name}`,
  });
}

// ── Suppliers (old "momwodebeli") ───────────────────────────────────────────

async function lockSupplier(tx: Tx, actor: Actor, supplierId: number) {
  const [row] = await tx
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, supplierId), eq(suppliers.storeId, actor.storeId)))
    .for("update");
  if (!row) throw new ActionError("მომწოდებელი ვერ მოიძებნა.");
  return row;
}

export async function createSupplier(tx: Tx, actor: Actor, input: { name: string; isReturns: boolean }) {
  const [row] = await tx
    .insert(suppliers)
    .values({ storeId: actor.storeId, name: input.name, isReturns: input.isReturns })
    .returning({ id: suppliers.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "supplier.create",
    entityType: "supplier",
    entityId: row.id,
    summary: `ახალი მომწოდებელი: ${input.name}`,
  });
  return row;
}

export async function updateSupplier(
  tx: Tx,
  actor: Actor,
  supplierId: number,
  input: { name: string; isReturns: boolean },
) {
  const supplier = await lockSupplier(tx, actor, supplierId);
  await tx.update(suppliers).set(input).where(eq(suppliers.id, supplierId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "supplier.update",
    entityType: "supplier",
    entityId: supplierId,
    summary: supplier.name === input.name ? `${input.name}: განახლდა` : `${supplier.name} → ${input.name}`,
  });
}

export async function setSupplierArchived(tx: Tx, actor: Actor, supplierId: number, archived: boolean) {
  const supplier = await lockSupplier(tx, actor, supplierId);
  await tx.update(suppliers).set({ isArchived: archived }).where(eq(suppliers.id, supplierId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: archived ? "supplier.archive" : "supplier.restore",
    entityType: "supplier",
    entityId: supplierId,
    summary: `${supplier.name} ${archived ? "გადავიდა სანაგვეში" : "აღდგა"}`,
  });
}

export async function deleteSupplier(tx: Tx, actor: Actor, supplierId: number) {
  const supplier = await lockSupplier(tx, actor, supplierId);
  const [inReceipts] = await tx
    .select({ id: stockReceipts.id })
    .from(stockReceipts)
    .where(eq(stockReceipts.supplierId, supplierId))
    .limit(1);
  if (inReceipts) throw new ActionError("მომწოდებელს აქვს მიღებების ისტორია — გადაიტანეთ სანაგვეში.");
  const [paid] = await tx
    .select({ id: financeEntries.id })
    .from(financeEntries)
    .where(eq(financeEntries.supplierId, supplierId))
    .limit(1);
  if (paid) throw new ActionError("მომწოდებელს აქვს გადახდების ისტორია — გადაიტანეთ სანაგვეში.");
  await tx.update(products).set({ supplierId: null }).where(eq(products.supplierId, supplierId));
  await tx.delete(suppliers).where(eq(suppliers.id, supplierId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "supplier.delete",
    entityType: "supplier",
    entityId: supplierId,
    summary: `წაიშალა მომწოდებელი: ${supplier.name}`,
  });
}

// ── Customers (old "company") ───────────────────────────────────────────────

export interface CustomerInput {
  name: string;
  address: string;
  taxId: string;
  phone: string;
  contactPerson: string;
}

async function lockCustomer(tx: Tx, actor: Actor, customerId: number) {
  const [row] = await tx
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, actor.storeId)))
    .for("update");
  if (!row) throw new ActionError("კლიენტი ვერ მოიძებნა.");
  return row;
}

export async function createCustomer(tx: Tx, actor: Actor, input: CustomerInput) {
  const [row] = await tx
    .insert(customers)
    .values({ storeId: actor.storeId, ...input })
    .returning({ id: customers.id });
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "customer.create",
    entityType: "customer",
    entityId: row.id,
    summary: `ახალი კლიენტი: ${input.name}`,
  });
  return row;
}

export async function updateCustomer(tx: Tx, actor: Actor, customerId: number, input: CustomerInput) {
  const customer = await lockCustomer(tx, actor, customerId);
  await tx.update(customers).set(input).where(eq(customers.id, customerId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "customer.update",
    entityType: "customer",
    entityId: customerId,
    summary: customer.name === input.name ? `${input.name}: მონაცემები განახლდა` : `${customer.name} → ${input.name}`,
  });
}

const COLOR_LABEL = { green: "მწვანე", yellow: "ყვითელი", red: "წითელი" } as const;

export async function setCustomerNote(
  tx: Tx,
  actor: Actor,
  customerId: number,
  fields: { comment?: string; color?: "green" | "yellow" | "red" | null },
) {
  const customer = await lockCustomer(tx, actor, customerId);
  const changes: string[] = [];
  if (fields.comment !== undefined && fields.comment !== customer.comment) changes.push("კომენტარი შეიცვალა");
  if (fields.color !== undefined && fields.color !== customer.color) {
    changes.push(`ფერი: ${fields.color ? COLOR_LABEL[fields.color] : "უფერო"}`);
  }
  if (changes.length === 0) return;
  await tx.update(customers).set(fields).where(eq(customers.id, customerId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "customer.note",
    entityType: "customer",
    entityId: customerId,
    summary: `${customer.name}: ${changes.join("; ")}`,
    details: { before: { comment: customer.comment, color: customer.color }, after: fields },
  });
}

export async function setCustomerArchived(tx: Tx, actor: Actor, customerId: number, archived: boolean) {
  const customer = await lockCustomer(tx, actor, customerId);
  await tx.update(customers).set({ isArchived: archived }).where(eq(customers.id, customerId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: archived ? "customer.archive" : "customer.restore",
    entityType: "customer",
    entityId: customerId,
    summary: `${customer.name} ${archived ? "გადავიდა სანაგვეში" : "აღდგა"}`,
  });
}

export async function deleteCustomer(tx: Tx, actor: Actor, customerId: number) {
  const customer = await lockCustomer(tx, actor, customerId);
  const [hasDeliveries] = await tx
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(eq(deliveries.customerId, customerId))
    .limit(1);
  const [hasOrders] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.customerId, customerId)).limit(1);
  if (hasDeliveries || hasOrders) throw new ActionError("კლიენტს აქვს ოპერაციები — გადაიტანეთ სანაგვეში.");
  await tx.delete(customers).where(eq(customers.id, customerId));
  await audit(tx, {
    storeId: actor.storeId,
    userId: actor.userId,
    action: "customer.delete",
    entityType: "customer",
    entityId: customerId,
    summary: `წაიშალა კლიენტი: ${customer.name}`,
  });
}
