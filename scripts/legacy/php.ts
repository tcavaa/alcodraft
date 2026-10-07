import { Decimal } from "../../src/lib/money";

/**
 * The old app stored every number as text and let PHP 7 coerce it during
 * arithmetic. PHP takes the longest numeric *prefix* (after leading
 * whitespace) and ignores the rest, or uses 0 when there is no prefix:
 *   "1072,3" → 1072, "30 ზაზას ბენზინი" → 30, "ლ50" → 0, "1-" → 1.
 * The import must reproduce exactly the numbers the old app computed with.
 */
const NUMERIC_PREFIX = /^[ \t\n\r\v\f]*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/;
const CLEAN_NUMBER = /^-?\d+(\.\d+)?$/;

/** PHP 7 `$value + 0`, as an exact Decimal. */
export function phpNumber(raw: string | number | null | undefined): Decimal {
  if (raw === null || raw === undefined) return new Decimal(0);
  if (typeof raw === "number") return new Decimal(raw);
  const match = NUMERIC_PREFIX.exec(raw);
  if (!match) return new Decimal(0);
  return new Decimal(match[1].replace(/\.$/, ""));
}

/** PHP 7 `(int) $value` (truncates toward zero). */
export function phpInt(raw: string | number | null | undefined): number {
  return phpNumber(raw).truncated().toNumber();
}

/** True when the stored text is not a plain number (worth keeping the raw value). */
export function isDirtyNumber(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined) return false;
  return raw !== "" && !CLEAN_NUMBER.test(raw);
}

/** Value rounded to the 4 decimals a numeric(18,4) column keeps. */
export function money4(raw: string | number | null | undefined): Decimal {
  return phpNumber(raw).toDecimalPlaces(4);
}

/** Old dates are "dd/mm/YYYY" strings. Returns "YYYY-MM-DD" or null. */
export function legacyDate(raw: string | null | undefined): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((raw ?? "").trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (date.getUTCDate() !== Number(d) || date.getUTCMonth() !== Number(mo) - 1) return null;
  return `${y}-${mo}-${d}`;
}

/** Trim text fields (old order forms saved the template's indentation into comments). */
export function cleanText(raw: string | null | undefined): string {
  return (raw ?? "").replace(/^\s+|\s+$/g, "");
}
