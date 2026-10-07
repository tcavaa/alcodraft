import "server-only";

import { count, eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";

import { db } from "./index";

/** Active / trash counts of a store's customers, products, suppliers or employees (the list tabs). */
export async function countByArchived(
  table: PgTable & { storeId: AnyPgColumn; isArchived: AnyPgColumn },
  storeId: number,
): Promise<{ active: number; archived: number }> {
  const rows = await db
    .select({ archived: table.isArchived, n: count() })
    .from(table)
    .where(eq(table.storeId, storeId))
    .groupBy(table.isArchived);
  return { active: rows.find((r) => !r.archived)?.n ?? 0, archived: rows.find((r) => r.archived)?.n ?? 0 };
}
