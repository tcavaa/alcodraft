import "server-only";

import { unstable_rethrow } from "next/navigation";
import type { output, ZodError, ZodType } from "zod";

import type { ActionResult } from "@/lib/action-result";

export type { ActionResult };

/** A message meant for the person using the app (Georgian). */
export class ActionError extends Error {
  constructor(
    message: string,
    readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
  }
}

export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

/** Validates action input; failures become field errors on the form (never a 500). */
export function parseInput<T extends ZodType>(schema: T, input: unknown): output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error);
    // A schema for a single value reports its message under "_" — show it as the form message.
    throw new ActionError(fieldErrors._ ?? "შეასწორეთ მონიშნული ველები.", fieldErrors);
  }
  return parsed.data;
}

/**
 * Runs an action body: known failures become `{ ok: false }` for the form,
 * redirects/notFound pass through, anything else is logged and reported generically.
 */
export async function runAction<T>(body: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await body();
    return { ok: true, data, message };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) {
      return { ok: false, error: error.message, fieldErrors: error.fieldErrors };
    }
    console.error("[action]", error);
    return { ok: false, error: "დაფიქსირდა შეცდომა. სცადეთ თავიდან." };
  }
}
