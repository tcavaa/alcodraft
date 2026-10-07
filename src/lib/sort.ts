/**
 * Table sorting, shared by server pages and the clickable column headers.
 *
 * URL format: `?sort=column` (ascending) or `?sort=-column` (descending); no param means the
 * table's default order. Pages with two tables use a second param name (e.g. `psort`).
 */

export type SortDir = "asc" | "desc";

export interface SortState<C extends string = string> {
  column: C;
  dir: SortDir;
}

/** `"-total"` → `{ column: "total", dir: "desc" }`; columns the table doesn't know → null (default order). */
export function parseSort<C extends string>(raw: string | null | undefined, columns: readonly C[]): SortState<C> | null {
  const value = raw?.trim();
  if (!value) return null;
  const dir: SortDir = value.startsWith("-") ? "desc" : "asc";
  const column = (dir === "desc" ? value.slice(1) : value) as C;
  return columns.includes(column) ? { column, dir } : null;
}

export function sortToParam(sort: SortState | null): string | null {
  if (!sort) return null;
  return sort.dir === "desc" ? `-${sort.column}` : sort.column;
}

/** Header click cycle: the column's first direction → the other one → back to the default order. */
export function nextSort(current: SortState | null, column: string, first: SortDir): SortState | null {
  if (current?.column !== column) return { column, dir: first };
  if (current.dir === first) return { column, dir: first === "asc" ? "desc" : "asc" };
  return null;
}

/** Decimal (money), number, text, ISO date string, boolean, or empty. */
export type SortValue = string | number | boolean | null | undefined | { comparedTo(other: never): number };

// Same rules as the database (ICU "en-US"): punctuation, digits, Latin, then Georgian ა→ჰ —
// so a table sorted here and one sorted in SQL agree.
const collator = new Intl.Collator("en-US");

const isEmpty = (v: SortValue) => v === null || v === undefined || v === "";

function compare(a: Exclude<SortValue, null | undefined>, b: Exclude<SortValue, null | undefined>): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "string" && typeof b === "string") return collator.compare(a, b);
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (typeof a === "object" && typeof b === "object") return a.comparedTo(b as never);
  return collator.compare(String(a), String(b));
}

/**
 * Sorts a small, fully loaded table (detail pages, settings) in memory.
 * Empty values stay last in both directions; ties keep the default order.
 */
export function sortRows<T, C extends string>(
  rows: readonly T[],
  sort: SortState<C> | null,
  by: Record<C, (row: T) => SortValue>,
): T[] {
  if (!sort) return [...rows];
  const get = by[sort.column];
  const sign = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: get(row) }))
    .sort((x, y) => {
      const ex = isEmpty(x.value);
      const ey = isEmpty(y.value);
      if (ex || ey) return ex === ey ? x.index - y.index : ex ? 1 : -1;
      return compare(x.value!, y.value!) * sign || x.index - y.index;
    })
    .map((x) => x.row);
}
