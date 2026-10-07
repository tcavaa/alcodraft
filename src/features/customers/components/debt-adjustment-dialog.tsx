"use client";

import { Scale } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Money } from "@/components/money";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { adjustDebtAction } from "@/features/sales/actions";
import { dec, parseAmount } from "@/lib/money";

/**
 * Manual debt correction — what used to be done by editing `darchenili` in
 * phpMyAdmin. Recorded as its own line in the customer's history.
 */
export function DebtAdjustmentDialog({
  storeId,
  customerId,
  currentDebt,
}: {
  storeId: number;
  customerId: number;
  currentDebt: string;
}) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"decrease" | "increase">("decrease");
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const parsed = parseAmount(value);
  const signed = parsed ? (direction === "decrease" ? parsed.negated() : parsed) : null;
  const after = signed ? dec(currentDebt).plus(signed) : null;

  const submit = () =>
    startTransition(async () => {
      if (!signed || signed.isZero()) {
        setErrors({ amount: "შეიყვანეთ თანხა" });
        return;
      }
      const result = await adjustDebtAction(storeId, { customerId, amount: signed.toString(), comment });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("ვალი დაკორექტირდა");
      setOpen(false);
      setValue("");
      setComment("");
      setErrors({});
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Scale />
          ვალის კორექტირება
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ვალის კორექტირება</DialogTitle>
          <DialogDescription>
            ჩაიწერება კლიენტის ისტორიაში ცალკე ხაზად. სალარო და საწყობი არ იცვლება.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <ToggleGroup
            type="single"
            variant="outline"
            value={direction}
            onValueChange={(v) => v && setDirection(v as "decrease" | "increase")}
            className="w-full"
          >
            <ToggleGroupItem value="decrease" className="flex-1">
              ვალის შემცირება
            </ToggleGroupItem>
            <ToggleGroupItem value="increase" className="flex-1">
              ვალის გაზრდა
            </ToggleGroupItem>
          </ToggleGroup>
          <Field data-invalid={Boolean(errors.amount)}>
            <FieldLabel htmlFor="adj-amount">თანხა (₾)</FieldLabel>
            <Input
              id="adj-amount"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="0,00"
              className="text-right tabular-nums"
              autoFocus
            />
            {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
          </Field>
          <Field data-invalid={Boolean(errors.comment)}>
            <FieldLabel htmlFor="adj-comment">მიზეზი</FieldLabel>
            <Textarea
              id="adj-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="მაგ.: ორჯერ შევიყვანეთ, გასწორება"
              rows={3}
            />
            {errors.comment ? <FieldError>{errors.comment}</FieldError> : null}
          </Field>
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">ახლანდელი ვალი</span>
            <Money value={currentDebt} currency tone="debt" />
          </div>
          {after ? (
            <div className="flex items-center justify-between rounded-lg border border-gold/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">ვალი კორექტირების შემდეგ</span>
              <Money value={after} currency tone="debt" className="font-semibold" />
            </div>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            გაუქმება
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Spinner /> : null}
            შენახვა
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
