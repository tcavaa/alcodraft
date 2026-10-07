"use client";

import { ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useServerAction } from "@/hooks/use-server-action";

import { adjustStockAction } from "../actions";

/** Inventory count: "there are actually N on the shelf". Logged with a reason. */
export function StockAdjustDialog({ storeId, productId, current }: { storeId: number; productId: number; current: number }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(current));
  const [reason, setReason] = useState("");
  const router = useRouter();
  const { run, pending, errors } = useServerAction();
  const parsed = /^-?\d+$/.test(qty.trim()) ? Number(qty) : null;

  // `current` is what this dialog shows; the server refuses the count if stock moved since.
  const submit = () =>
    run(() => adjustStockAction(storeId, productId, { newQty: qty, expectedQty: current, reason }), {
      onSuccess: () => {
        setOpen(false);
        setReason("");
      },
      // Refused because stock moved meanwhile: load the current number for the next try.
      onError: () => router.refresh(),
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (o) setQty(String(current));
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ClipboardCheck />
          ინვენტარიზაცია
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>მარაგის შესწორება</DialogTitle>
          <DialogDescription>მიუთითეთ რეალურად არსებული რაოდენობა. ცვლილება ჩაიწერება ისტორიაში.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.newQty)}>
            <FieldLabel htmlFor="new-qty">ახალი რაოდენობა</FieldLabel>
            <Input id="new-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} className="text-right tabular-nums" />
            {parsed !== null && parsed !== current ? (
              <p className="text-xs text-muted-foreground">
                ცვლილება: {parsed - current > 0 ? "+" : ""}
                {parsed - current}
              </p>
            ) : null}
            {errors.newQty ? <FieldError>{errors.newQty}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.reason)}>
            <FieldLabel htmlFor="adj-reason">მიზეზი</FieldLabel>
            <Textarea id="adj-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="მაგ.: ინვენტარიზაცია, დაზიანებული ბოთლი" />
            {errors.reason ? <FieldError>{errors.reason}</FieldError> : null}
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            გაუქმება
          </Button>
          <Button onClick={submit} disabled={pending || parsed === null || parsed === current}>
            {pending ? <Spinner /> : null}
            შენახვა
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
