/**
 * Calculation rules for operations (deliveries) and orders — exactly the old
 * PHP rules, made exact with decimals. Pure functions: shared by the server
 * services and the live preview in the forms.
 *
 *   unit price  = entered price × discount factor   (old: drink_price = value * sale)
 *   line total  = delivered qty × unit price         (old: drink_sum = drink_in * value * sale)
 *   total       = Σ line totals                      (old: fullamount)
 *   debt after  = previous debt + total − paid       (old: darchenili)
 *   stock       −= delivered + gift                  (leftover is informational)
 */
import { Decimal, dec, type Numeric, sum } from "@/lib/money";

/** The discount choices of the old forms (`sale` select). */
export const DISCOUNT_OPTIONS = [
  { factor: "1", label: "ფასდაკლების გარეშე" },
  { factor: "0.9", label: "10%" },
  { factor: "0.85", label: "15%" },
  { factor: "0.8", label: "20%" },
  { factor: "0.75", label: "25%" },
  { factor: "0.7", label: "30%" },
  { factor: "0.6", label: "40%" },
] as const;

export const PAYMENT_METHODS = [
  { value: "cash", label: "ნაღდი", hint: "Cash" },
  { value: "card", label: "ბარათი", hint: "Card" },
  { value: "back", label: "დაბრუნება", hint: "Back — ვალს ამცირებს, სალაროში არ შედის" },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];

export function paymentLabel(method: string | null | undefined): string {
  return PAYMENT_METHODS.find((m) => m.value === method)?.label ?? "—";
}

export interface LineInput {
  productId: number;
  /** Price per unit before the discount (defaults to the product's sale price). */
  price: Numeric;
  quantity: number;
  giftQty: number;
  leftoverQty: number;
}

export interface ComputedLine {
  productId: number;
  unitPrice: Decimal;
  quantity: number;
  giftQty: number;
  leftoverQty: number;
  lineTotal: Decimal;
}

export function isEmptyLine(l: { quantity: number; giftQty: number; leftoverQty: number }): boolean {
  return l.quantity === 0 && l.giftQty === 0 && l.leftoverQty === 0;
}

/** Applies the discount to entered prices. Lines with nothing entered are dropped. */
export function computeLines(lines: LineInput[], discountFactor: Numeric = 1): ComputedLine[] {
  const factor = dec(discountFactor);
  return lines
    .filter((l) => !isEmptyLine(l))
    .map((l) => {
      const unitPrice = dec(l.price).times(factor).toDecimalPlaces(4);
      return {
        productId: l.productId,
        unitPrice,
        quantity: l.quantity,
        giftQty: l.giftQty,
        leftoverQty: l.leftoverQty,
        lineTotal: unitPrice.times(l.quantity).toDecimalPlaces(4),
      };
    });
}

/** Lines whose unit price is already final (order edit / completion: no discount re-applied). */
export function computeFinalLines(
  lines: { productId: number; unitPrice: Numeric; quantity: number; giftQty: number; leftoverQty: number }[],
): ComputedLine[] {
  return computeLines(
    lines.map((l) => ({ ...l, price: l.unitPrice })),
    1,
  );
}

export function totalOf(lines: { lineTotal: Numeric }[]): Decimal {
  return sum(lines.map((l) => l.lineTotal));
}

/** Customer debt after an operation. */
export function debtAfter(previousDebt: Numeric, total: Numeric, paid: Numeric, adjustment: Numeric = 0): Decimal {
  return dec(previousDebt).plus(dec(total)).minus(dec(paid)).plus(dec(adjustment));
}

/** Cash-book balance after an entry (old: balance = previous − money + darchenili). */
export function balanceAfter(previous: Numeric, amountIn: Numeric, amountOut: Numeric, adjustment: Numeric = 0): Decimal {
  return dec(previous).plus(dec(amountIn)).minus(dec(amountOut)).plus(dec(adjustment));
}

/** How much each product's stock changes (negative = leaves the warehouse). */
export function stockDeltas(lines: { productId: number; quantity: number; giftQty: number }[], sign: 1 | -1 = -1) {
  const deltas = new Map<number, number>();
  for (const l of lines) deltas.set(l.productId, (deltas.get(l.productId) ?? 0) + sign * (l.quantity + l.giftQty));
  return deltas;
}

/** Value of what was left on the customer's shelf (old "ნაშთი" in the summary box). */
export function leftoverValue(lines: { unitPrice: Numeric; leftoverQty: number }[]): Decimal {
  return sum(lines.map((l) => dec(l.unitPrice).times(l.leftoverQty)));
}

/** Old cash-book description for customer payments: "<customer> <method>". */
export function paymentDescription(customerName: string, method: PaymentMethod): string {
  return `${customerName} ${method}`;
}

/** Whether a payment reaches the cash book (old: only `back` is skipped). */
export function paymentHitsCashBook(method: PaymentMethod | null, paid: Numeric): boolean {
  return method !== null && method !== "back" && !dec(paid).isZero();
}
