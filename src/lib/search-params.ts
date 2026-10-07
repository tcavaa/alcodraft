export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const first = Array.isArray(v) ? v[0] : v;
  return first?.trim() ? first.trim() : undefined;
}

export function intParam(sp: SearchParams, key: string): number | undefined {
  const v = param(sp, key);
  if (!v || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return Number.isSafeInteger(n) ? n : undefined;
}

export function pageParam(sp: SearchParams): number {
  return Math.max(1, intParam(sp, "page") ?? 1);
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
