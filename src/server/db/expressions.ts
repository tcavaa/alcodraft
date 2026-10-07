import "server-only";

import { sql } from "drizzle-orm";

import { deliveries, financeEntries } from "./schema";

/**
 * The two running-balance formulas of the app, written once (business-logic.md).
 * Use them inside `sum(...)`, optionally with a window: `sum(${debtDelta}) over (…)`.
 */

/** How much one operation changes the customer's debt (old `darchenili` step). */
export const debtDelta = sql`${deliveries.totalAmount} - ${deliveries.paidAmount} + ${deliveries.adjustmentAmount}`;

/** Σ debt over the selected operations (null when there are none). */
export const debtSum = sql<string>`sum(${debtDelta})`;

/** Σ debt over the selected operations, 0 when there are none. */
export const debtSumOrZero = sql<string>`coalesce(sum(${debtDelta}), 0)`;

/** How much one cash-book entry changes the balance (old `balance = previous − money + darchenili`). */
export const cashDelta = sql`${financeEntries.amountIn} - ${financeEntries.amountOut} + ${financeEntries.adjustmentAmount}`;

/** Σ balance over the selected entries, 0 when there are none. */
export const cashSumOrZero = sql<string>`coalesce(sum(${cashDelta}), 0)`;

/** What has been paid to a supplier: Σ cash-book expenses linked to it (income rows don't count). */
export const supplierPaidSum = sql<string>`coalesce(sum(${financeEntries.amountOut}), 0)`;

/** `ILIKE` pattern for "contains", with the user's `%`, `_` and `\` taken literally. */
export function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
