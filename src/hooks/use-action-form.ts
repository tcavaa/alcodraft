"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

type FormAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

/**
 * A `<form>` bound to a Server Action through `useActionState`, submitted from `onSubmit`.
 *
 * Not `<form action={…}>`: React 19 resets such a form after every submission, and Radix
 * checkboxes/switches/selects then jump back to their first values — a failed save lost what was
 * typed, a successful one showed stale values that the next save wrote back. Here the fields keep
 * what the person entered; pass `resetOnSuccess` for forms that should empty themselves.
 */
export function useActionForm(action: FormAction, options: { resetOnSuccess?: boolean } = {}) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const form = useRef<HTMLFormElement | null>(null);
  // Next keeps recent pages alive and re-runs their effects when they are shown again:
  // remember which result was handled so a "saved" toast (or reset) happens once.
  const handled = useRef<ActionResult | undefined>(undefined);

  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    if (state.message) toast.success(state.message);
    if (options.resetOnSuccess) form.current?.reset();
  }, [state, options.resetOnSuccess]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    form.current = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };

  const failed = state && !state.ok ? state : undefined;
  return {
    onSubmit,
    pending,
    /** Per-field messages (`name` → message). */
    errors: failed?.fieldErrors,
    /** A message that belongs to no field. */
    formError: failed && !failed.fieldErrors ? failed.error : undefined,
  };
}
