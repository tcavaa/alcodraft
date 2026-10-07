import { notFound } from "next/navigation";

import { isIsoDate } from "./dates";
import { MAX_ID } from "./policy";
import { parseSort, type SortState } from "./sort";

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const first = Array.isArray(v) ? v[0] : v;
  return first?.trim() ? first.trim() : undefined;
}

/** A positive id from a URL segment or query value, or null when it is not one. */
export function parseId(raw: string | string[] | undefined): number | null {
  const v = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!v || !/^\d{1,10}$/.test(v)) return null;
  const n = Number(v);
  return n >= 1 && n <= MAX_ID ? n : null;
}

/** Route segment id (`/customers/[customerId]`) — anything else is a 404, never a database error. */
export function idParam(raw: string | string[] | undefined): number {
  const id = parseId(raw);
  if (id === null) notFound();
  return id;
}

export function intParam(sp: SearchParams, key: string): number | undefined {
  const v = param(sp, key);
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) && n <= MAX_ID ? n : undefined;
}

export function pageParam(sp: SearchParams): number {
  return Math.max(1, intParam(sp, "page") ?? 1);
}

/** One of the allowed values, or undefined. */
export function enumParam<T extends string>(sp: SearchParams, key: string, values: readonly T[]): T | undefined {
  const v = param(sp, key);
  return values.find((x) => x === v);
}

/** `?from=…&to=…` as valid ISO dates (invalid ones are ignored). */
export function dateRangeParam(sp: SearchParams): { from?: string; to?: string } {
  const valid = (v: string | undefined) => (v && isIsoDate(v) ? v : undefined);
  return { from: valid(param(sp, "from")), to: valid(param(sp, "to")) };
}

/** Same URL with some query params changed (null/undefined/"" removes them). */
export function hrefWith(
  pathname: string,
  sp: SearchParams,
  changes: Record<string, string | number | null | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value !== undefined && value !== "") params.set(k, value);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === "") params.delete(k);
    else params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** The table's sort from the URL (`?sort=col` / `?sort=-col`), or null for the default order. */
export function sortParam<C extends string>(sp: SearchParams, columns: readonly C[], key = "sort"): SortState<C> | null {
  return parseSort(param(sp, key), columns);
}
