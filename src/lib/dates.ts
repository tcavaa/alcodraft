/**
 * Business dates are plain "YYYY-MM-DD" strings (Postgres `date`). "Today" is
 * always Tbilisi time, whatever timezone the server (Vercel = UTC) runs in.
 */
export const APP_TIME_ZONE = "Asia/Tbilisi";

const isoDayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date in Tbilisi as "YYYY-MM-DD". */
export function todayIso(now: Date = new Date()): string {
  return isoDayFormatter.format(now);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** "2026-10-07" → "07.10.2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

const GEORGIAN_MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
] as const;

/** "2026-10" or "2026-10-07" → "ოქტომბერი 2026" */
export function formatMonth(iso: string): string {
  const [y, m] = iso.split("-");
  return `${GEORGIAN_MONTHS[Number(m) - 1]} ${y}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Timestamp in Tbilisi time: "07.10.2026 14:05" */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const parts = dateTimeFormatter.formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}
