"use client";

import { ClipboardCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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

import { adjustStockAction } from "../actions";

/** Inventory count: "there are actually N on the shelf". Logged with a reason. */
export function StockAdjustDialog({ storeId, productId, current }: { storeId: number; productId: number; current: number }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(String(current));
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const parsed = /^-?\d+$/.test(qty.trim()) ? Number(qty) : null;

  const submit = () =>
    startTransition(async () => {
      const result = await adjustStockAction(storeId, productId, { newQty: qty, reason });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("მარაგი განახლდა");
      setOpen(false);
      setReason("");
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
