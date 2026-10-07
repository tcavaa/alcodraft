import DecimalJs from "decimal.js";

/**
 * Money is always exact: values come from Postgres `numeric` as strings and all
 * arithmetic goes through Decimal. Never use JS floats for amounts.
 */
const D = DecimalJs.clone({ precision: 40, rounding: DecimalJs.ROUND_HALF_UP });
export const Decimal = D;
export type Decimal = DecimalJs;
export type Numeric = Decimal | string | number;

export function dec(value: Numeric | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new D(0);
  return value instanceof D ? value : new D(value);
}

export function sum(values: Iterable<Numeric | null | undefined>): Decimal {
  let total = new D(0);
  for (const v of values) total = total.plus(dec(v));
  return total;
}

/** Value for a numeric(18,4) column. */
export function toDb(value: Numeric): string {
  return dec(value).toDecimalPlaces(4).toFixed(4);
}

/**
 * Parse what a person typed. Accepts "1234.5", "1234,5", "1 234,50" and a leading minus ("-" or "−").
 * Returns null for anything that is not a plain number — unlike the old PHP app,
 * which silently read "1072,3" as 1072 and "30 ბენზინი" as 30.
 */
export function parseAmount(raw: string | undefined): Decimal | null {
  // "−" (U+2212) is the minus formatAmount displays, so a copied amount can be pasted back.
  const cleaned = (raw ?? "").trim().replace("\u2212", "-").replace(/[\s  ]+/g, "").replace(",", ".");
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(cleaned)) return null;
  return new D(cleaned);
}

const THIN_NBSP = " ";

/** Georgian formatting, deterministic on server and client: 1 234 567,50 */
export function formatAmount(value: Numeric | null | undefined, fractionDigits = 2): string {
  const d = dec(value).toDecimalPlaces(fractionDigits);
  const negative = d.isNegative() && !d.isZero();
  const [intPart, fracPart] = d.abs().toFixed(fractionDigits).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, THIN_NBSP);
  return `${negative ? "−" : ""}${grouped}${fracPart ? `,${fracPart}` : ""}`;
}

/** Amount with the lari sign: 1 234,50 ₾ */
export function formatMoney(value: Numeric | null | undefined): string {
  return `${formatAmount(value)} ₾`;
}

/** Quantities are whole numbers; format with grouping only. */
export function formatQty(value: number | null | undefined): string {
  return formatAmount(value ?? 0, 0);
}

/** Discount factor 0.85 → "15%"; 1 or null → "". */
export function formatDiscount(factor: Numeric | null | undefined): string {
  if (factor === null || factor === undefined || factor === "") return "";
  const pct = new D(1).minus(dec(factor)).times(100).toDecimalPlaces(2);
  return pct.isZero() ? "" : `${pct.toString()}%`;
}
