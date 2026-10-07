"use client";

import { unstable_rethrow } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";

/**
 * Calls a Server Action from a button or dialog: pending state, field errors (a message that
 * belongs to no field is kept under `_form`), and a toast for the outcome (the action's own
 * message wins over `success`). Redirects in the action just navigate.
 */
export function useServerAction() {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = <T>(
    call: () => Promise<ActionResult<T> | void>,
    options: { success?: string; onSuccess?: () => void; onError?: () => void } = {},
  ) =>
    startTransition(async () => {
      let result: ActionResult<T> | void;
      try {
        result = await call();
      } catch (error) {
        // A redirect (or 404) from the action is Next's to handle.
        unstable_rethrow(error);
        // The request may or may not have reached the server. The form stays as it is — with the
        // same request id, so sending it again can't book the document twice.
        const message = "კავშირი ვერ დამყარდა — სცადეთ თავიდან.";
        setErrors({ _form: message });
        toast.error(message);
        options.onError?.();
        return;
      }
      if (result && !result.ok) {
        setErrors(result.fieldErrors ?? { _form: result.error });
        toast.error(result.error);
        options.onError?.();
        return;
      }
      setErrors({});
      const message = (result && result.ok && result.message) || options.success;
      if (message) toast.success(message);
      options.onSuccess?.();
    });

  return { run, pending, errors, setErrors };
}
