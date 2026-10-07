import { type SQL, type SQLWrapper, sql } from "drizzle-orm";

import type { SortDir } from "@/lib/sort";

/** `expr ASC|DESC NULLS LAST`: empty values stay at the bottom in both directions. */
export function by(expr: SQLWrapper, dir: SortDir): SQL {
  return sql`${expr} ${sql.raw(dir === "desc" ? "desc" : "asc")} nulls last`;
}
