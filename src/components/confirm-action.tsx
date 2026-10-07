"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/lib/action-result";

/**
 * "Are you sure?" dialog that runs a Server Action and reports the result as a toast.
 * The dialog stays open (with a spinner) until the action finishes.
 */
export function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  destructive = false,
  action,
  successMessage,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  action: () => Promise<ActionResult<unknown> | void>;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useServerAction();

  return (
    <ConfirmDialog
      trigger={trigger}
      open={open}
      onOpenChange={setOpen}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={destructive}
      pending={pending}
      onConfirm={() => run(action, { success: successMessage, onSuccess: () => setOpen(false) })}
    />
  );
}
