"use server";

import { and, asc, eq, ilike, or } from "drizzle-orm";

import { getMyStores, requireUser } from "@/server/auth/dal";
import { db } from "@/server/db";
import { likePattern } from "@/server/db/expressions";
import { customers, products, suppliers } from "@/server/db/schema";

export interface SearchHit {
  kind: "customer" | "product" | "supplier";
  id: number;
  title: string;
  subtitle: string;
  archived: boolean;
}

/** Quick search for the ⌘K palette (top matches of each kind in one store). */
export async function searchStoreAction(storeId: number, query: string): Promise<SearchHit[]> {
  await requireUser();
  const store = (await getMyStores()).find((s) => s.id === storeId);
  const q = query.trim();
  if (!store || q.length < 2) return [];
  const pattern = likePattern(q);

  const [c, p, s] = await Promise.all([
    db
      .select({ id: customers.id, name: customers.name, address: customers.address, phone: customers.phone, archived: customers.isArchived })
      .from(customers)
      .where(
        and(
          eq(customers.storeId, storeId),
          or(ilike(customers.name, pattern), ilike(customers.taxId, pattern), ilike(customers.phone, pattern), ilike(customers.address, pattern)),
        ),
      )
      .orderBy(asc(customers.isArchived), asc(customers.name))
      .limit(6),
    db
      .select({ id: products.id, name: products.name, stock: products.stockQty, archived: products.isArchived })
      .from(products)
      .where(and(eq(products.storeId, storeId), ilike(products.name, pattern)))
      .orderBy(asc(products.isArchived), asc(products.name))
      .limit(6),
    db
      .select({ id: suppliers.id, name: suppliers.name, archived: suppliers.isArchived })
      .from(suppliers)
      .where(and(eq(suppliers.storeId, storeId), ilike(suppliers.name, pattern)))
      .orderBy(asc(suppliers.isArchived), asc(suppliers.name))
      .limit(4),
  ]);

  return [
    ...c.map((r) => ({
      kind: "customer" as const,
      id: r.id,
      title: r.name,
      subtitle: [r.address, r.phone].filter(Boolean).join(" · "),
      archived: r.archived,
    })),
    ...p.map((r) => ({ kind: "product" as const, id: r.id, title: r.name, subtitle: `მარაგი: ${r.stock}`, archived: r.archived })),
    ...s.map((r) => ({ kind: "supplier" as const, id: r.id, title: r.name, subtitle: "მომწოდებელი", archived: r.archived })),
  ];
}
