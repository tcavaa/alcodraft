"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Submit button that disables itself while the form is saving. Forms using `useActionForm` pass
 * `pending`; plain `<form action>` forms are tracked through `useFormStatus`.
 */
export function SubmitButton({
  children,
  pending,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  const status = useFormStatus();
  const busy = pending ?? status.pending;
  return (
    <Button type="submit" {...props} disabled={busy || disabled}>
      {busy ? <Spinner /> : null}
      {children}
    </Button>
  );
}
