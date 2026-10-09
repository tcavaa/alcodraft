import "server-only";

import { and, asc, desc, eq, ilike, lte, sql, type SQL } from "drizzle-orm";

import { db } from "@/server/db";
import { countByArchived } from "@/server/db/archived";
import { likePattern } from "@/server/db/expressions";
import {
  customers,
  deliveries,
  deliveryItems,
  productPriceChanges,
  products,
  stockAdjustments,
  stockReceiptItems,
  stockReceipts,
  suppliers,
  users,
} from "@/server/db/schema";


/** Old drinks/index (+ the "ცვლილება" flag without one query per row). */
export async function listProducts(
  storeId: number,
  p: { q?: string; archived: boolean; supplierId?: number; active?: boolean; outOfStock?: boolean },
) {
  const conditions: (SQL | undefined)[] = [eq(products.storeId, storeId), eq(products.isArchived, p.archived)];
  if (p.q) conditions.push(ilike(products.name, likePattern(p.q)));
  if (p.supplierId) conditions.push(eq(products.supplierId, p.supplierId));
  if (p.active !== undefined) conditions.push(eq(products.isActive, p.active));
  if (p.outOfStock) conditions.push(lte(products.stockQty, 0));
  return db
    .select({
      id: products.id,
      name: products.name,
      salePrice: products.salePrice,
      purchasePrice: products.purchasePrice,
      stockQty: products.stockQty,
      supplierId: products.supplierId,
      supplierName: suppliers.name,
      isActive: products.isActive,
      priceChanged: sql<boolean>`exists (select 1 from ${productPriceChanges} where ${productPriceChanges.productId} = ${products.id})`,
    })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(and(...conditions))
    .orderBy(asc(products.id));
}

export const countProducts = (storeId: number) => countByArchived(products, storeId);

export async function getProduct(storeId: number, productId: number) {
  const [row] = await db
    .select({ product: products, supplierName: suppliers.name })
    .from(products)
    .leftJoin(suppliers, eq(suppliers.id, products.supplierId))
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)));
  if (!row) return null;
  const [priceChanges, movements] = await Promise.all([
    db
      .select({
        id: productPriceChanges.id,
        changedOn: productPriceChanges.changedOn,
        oldSalePrice: productPriceChanges.oldSalePrice,
        oldPurchasePrice: productPriceChanges.oldPurchasePrice,
        newSalePrice: productPriceChanges.newSalePrice,
        newPurchasePrice: productPriceChanges.newPurchasePrice,
        by: users.name,
      })
      .from(productPriceChanges)
      .leftJoin(users, eq(users.id, productPriceChanges.changedById))
      .where(eq(productPriceChanges.productId, productId))
      .orderBy(desc(productPriceChanges.id)),
    getProductMovements(productId, 40),
  ]);
  return { ...row, priceChanges, movements };
}

export interface Movement {
  kind: "receipt" | "delivery" | "adjustment";
  refId: number;
  number: number | null;
  date: string;
  delta: number;
  label: string;
}

/** Latest stock movements of a product: receipts (+), operations (− delivered − gift), corrections. */
async function getProductMovements(productId: number, limit: number): Promise<Movement[]> {
  const result = await db.execute<{
    kind: Movement["kind"];
    ref_id: number;
    number: number | null;
    date: string;
    delta: number;
    label: string;
    sort_at: string;
  }>(sql`
    (select 'receipt' as kind, r.id as ref_id, r.number, r.receipt_date::text as date, i.quantity as delta,
            coalesce(s.name, '') as label, r.created_at as sort_at
       from ${stockReceiptItems} i
       join ${stockReceipts} r on r.id = i.receipt_id
       left join ${suppliers} s on s.id = r.supplier_id
      where i.product_id = ${productId}
      order by r.id desc limit ${limit})
    union all
    (select 'delivery', d.id, d.number, d.delivery_date::text, -(i.quantity + i.gift_qty), c.name, d.created_at
       from ${deliveryItems} i
       join ${deliveries} d on d.id = i.delivery_id
       join ${customers} c on c.id = d.customer_id
      where i.product_id = ${productId}
      order by d.id desc limit ${limit})
    union all
    (select 'adjustment', a.id, null, (a.created_at at time zone 'Asia/Tbilisi')::date::text, a.quantity_delta, a.reason, a.created_at
       from ${stockAdjustments} a
      where a.product_id = ${productId}
      order by a.id desc limit ${limit})
    order by date desc, sort_at desc
    limit ${limit}
  `);
  return result.rows.map((r) => ({
    kind: r.kind,
    refId: r.ref_id,
    number: r.number,
    date: r.date,
    delta: Number(r.delta),
    label: r.label,
  }));
}

export async function listSupplierOptions(storeId: number) {
  return db
    .select({ id: suppliers.id, name: suppliers.name, isArchived: suppliers.isArchived, isReturns: suppliers.isReturns })
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId))
    .orderBy(asc(suppliers.isArchived), asc(suppliers.name));
}
