import { z } from "zod";

import { type Decimal, dec, parseAmount } from "./money";

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

/** Whole number (quantities, stock counts). */
export function wholeNumber(opts: { allowNegative?: boolean } = {}) {
  return z
    .union([z.string(), z.number()])
    .optional()
    .transform((raw, ctx): number => {
      const text = raw === undefined || raw === null ? "" : String(raw).trim();
      if (text === "") return 0;
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

export const id = z.coerce.number().int().positive();

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
  .pipe(z.email("არასწორი ელფოსტა"));

export const PASSWORD_MIN = 8;
export const password = z
  .string({ error: "შეიყვანეთ პაროლი" })
  .min(PASSWORD_MIN, `პაროლი მინიმუმ ${PASSWORD_MIN} სიმბოლო`)
  .max(200, "ძალიან გრძელი პაროლი");

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
