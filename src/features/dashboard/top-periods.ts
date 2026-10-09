/** Periods of the best-sellers ranking (`?period=` on the ranking page, `?top=` on the dashboard). */
export const TOP_PERIODS = [
  { value: "30d", label: "30 დღე", description: "ბოლო 30 დღე" },
  { value: "6m", label: "6 თვე", description: "ბოლო 6 თვე" },
  { value: "1y", label: "1 წელი", description: "ბოლო 1 წელი" },
] as const;
export type TopPeriod = (typeof TOP_PERIODS)[number]["value"];
export const TOP_PERIOD_VALUES = TOP_PERIODS.map((p) => p.value);

/** First day of the period, today included: 30 days → today − 29, 6 months → the day after today − 6 months. */
export function topPeriodStart(today: string, period: TopPeriod): string {
  const [y, m, d] = today.split("-").map(Number);
  if (period === "30d") return new Date(Date.UTC(y, m - 1, d - 29)).toISOString().slice(0, 10);
  const month = m - 1 - (period === "6m" ? 6 : 12);
  // Same day N months back, clamped to that month's length (31 Aug → 28 Feb), then the next day.
  const day = Math.min(d, new Date(Date.UTC(y, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(y, month, day + 1)).toISOString().slice(0, 10);
}
