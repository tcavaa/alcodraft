import { z } from "zod";

import { type Decimal, dec, parseAmount } from "./money";
import { EMAIL_MAX, MAX_ID, PASSWORD_MAX, PASSWORD_MIN } from "./policy";

/** Amount typed by a person ("1 234,50" or "1234.5"). */
export function amount(opts: { required?: boolean; allowNegative?: boolean; min?: number } = {}) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((raw, ctx): Decimal => {
      const text = raw === undefined || raw === null ? "" : String(raw).trim();
      if (text === "") {
        if (opts.required) ctx.addIssue({ code: "custom", message: "შეიყვანეთ თანხა" });
        return dec(0);
      }
      const value = parseAmount(text);
      if (!value) {
        ctx.addIssue({ code: "custom", message: "არასწორი რიცხვი" });
        return z.NEVER;
      }
      if (!opts.allowNegative && value.isNegative()) {
        ctx.addIssue({ code: "custom", message: "უარყოფითი არ შეიძლება" });
        return z.NEVER;
      }
      if (opts.min !== undefined && value.lt(opts.min)) {
        ctx.addIssue({ code: "custom", message: `მინიმუმ ${opts.min}` });
        return z.NEVER;
      }
      if (value.abs().gte("100000000000000")) {
        ctx.addIssue({ code: "custom", message: "ძალიან დიდი რიცხვი" });
        return z.NEVER;
      }
      return value;
    });
}

/** Whole number (quantities, stock counts). Empty = 0 unless `required`. */
export function wholeNumber(opts: { allowNegative?: boolean; required?: boolean } = {}) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((raw, ctx): number => {
      const text = raw === undefined || raw === null ? "" : String(raw).trim();
      if (text === "") {
        if (opts.required) ctx.addIssue({ code: "custom", message: "შეიყვანეთ რაოდენობა" });
        return 0;
      }
      if (!/^-?\d+$/.test(text)) {
        ctx.addIssue({ code: "custom", message: "მთელი რიცხვი" });
        return z.NEVER;
      }
      const n = Number(text);
      if (!Number.isSafeInteger(n) || Math.abs(n) > 1_000_000_000) {
        ctx.addIssue({ code: "custom", message: "ძალიან დიდი რიცხვი" });
        return z.NEVER;
      }
      if (!opts.allowNegative && n < 0) {
        ctx.addIssue({ code: "custom", message: "უარყოფითი არ შეიძლება" });
        return z.NEVER;
      }
      return n;
    });
}

export const id = z.coerce.number().int().positive().max(MAX_ID);

export function text(max = 2000) {
  return z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim())
    .pipe(z.string().max(max, `მაქსიმუმ ${max} სიმბოლო`));
}

export function requiredText(label: string, max = 300) {
  return z
    .string({ error: `შეიყვანეთ ${label}` })
    .transform((v) => v.trim())
    .pipe(z.string().min(1, `შეიყვანეთ ${label}`).max(max, `მაქსიმუმ ${max} სიმბოლო`));
}

export const email = z
  .string({ error: "შეიყვანეთ ელფოსტა" })
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.email("არასწორი ელფოსტა").max(EMAIL_MAX, "ძალიან გრძელი ელფოსტა"));

export const password = z
  .string({ error: "შეიყვანეთ პაროლი" })
  .min(PASSWORD_MIN, `პაროლი მინიმუმ ${PASSWORD_MIN} სიმბოლო`)
  .max(PASSWORD_MAX, "ძალიან გრძელი პაროლი");

/** A switch / checkbox posted in a form ("on"); absent = false. Booleans pass through. */
export function checkbox() {
  return z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true");
}

/** Required free-text reason (stock count, debt correction). */
export function reason(max = 2000) {
  return z
    .string({ error: "მიუთითეთ მიზეზი" })
    .transform((v) => v.trim())
    .pipe(z.string().min(3, "მიუთითეთ მიზეზი").max(max, `მაქსიმუმ ${max} სიმბოლო`));
}

/** One-time id a form sends with a create, so a double submit or retry is not booked twice. */
export const requestId = z.uuid().optional();

/** Read a FormData into a plain object (repeated keys → arrays). */
export function formObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    const v = typeof value === "string" ? value : value.name;
    if (key in out) out[key] = ([] as unknown[]).concat(out[key], v);
    else out[key] = v;
  }
  return out;
}
