"use client";

import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useRequestId } from "@/hooks/use-request-id";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/lib/action-result";
import { type Decimal, parseAmount } from "@/lib/money";

/**
 * Amount + comment → one money record (supplier payment, wage accrual or payout). Asks for
 * confirmation with the amount first, and sends a one-time request id so a double click or a
 * retry can't book it twice.
 */
export function AmountNoteForm({
  idPrefix,
  notePlaceholder,
  submitLabel,
  submitIcon,
  submitVariant = "default",
  confirmTitle,
  confirmDescription,
  save,
}: {
  idPrefix: string;
  notePlaceholder?: string;
  submitLabel: string;
  submitIcon: React.ReactNode;
  submitVariant?: "default" | "outline";
  confirmTitle: string;
  confirmDescription: (amount: Decimal) => React.ReactNode;
  save: (input: { amount: string; note: string; requestId: string }) => Promise<ActionResult<unknown>>;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const requestId = useRequestId();
  const { run, pending, errors, setErrors } = useServerAction();
  const parsed = parseAmount(amount);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || parsed.isZero() || parsed.isNegative()) {
      setErrors({ amount: amount.trim() ? "არასწორი თანხა" : "შეიყვანეთ თანხა" });
      return;
    }
    setErrors({});
    setConfirming(true);
  };

  const confirm = () =>
    run(() => save({ amount, note, requestId: requestId.current() }), {
      onSuccess: () => {
        requestId.renew();
        setConfirming(false);
        setAmount("");
        setNote("");
      },
      onError: () => setConfirming(false),
    });

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field data-invalid={Boolean(errors.amount)}>
        <FieldLabel htmlFor={`${idPrefix}-amount`}>თანხა (₾)</FieldLabel>
        <Input
          id={`${idPrefix}-amount`}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          className="text-right tabular-nums"
          aria-invalid={Boolean(errors.amount)}
        />
        {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-note`}>კომენტარი</FieldLabel>
        <Input id={`${idPrefix}-note`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={notePlaceholder} />
      </Field>
      <Button type="submit" variant={submitVariant} className="w-full" disabled={pending}>
        {pending ? <Spinner /> : submitIcon}
        {submitLabel}
      </Button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={confirmTitle}
        description={
          parsed ? (
            <>
              <p className="text-2xl font-semibold text-foreground">
                <Money value={parsed} currency />
              </p>
              {confirmDescription(parsed)}
              {note.trim() ? <p>კომენტარი: {note.trim()}</p> : null}
            </>
          ) : null
        }
        confirmLabel={submitLabel}
        pending={pending}
        onConfirm={confirm}
      />
    </form>
  );
}
