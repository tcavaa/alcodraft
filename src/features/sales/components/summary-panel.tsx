"use client";

import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { type Decimal, dec, formatQty, parseAmount } from "@/lib/money";

import { DISCOUNT_OPTIONS, PAYMENT_METHODS, type PaymentMethod } from "../logic";

export interface SummaryValues {
  discountFactor: string;
  paid: string;
  method: PaymentMethod;
  hasWaybill: boolean;
  uploadStatus: "pending" | "uploaded";
  comment: string;
}

/** Right-hand panel of the operation/order forms (old "ინფორმაცია" + "კომენტარი" blocks). */
export function SummaryPanel({
  values,
  onChange,
  total,
  lineCount,
  quantity,
  gifts,
  leftoverValue,
  previousDebt,
  discountEditable,
  showUploadStatus,
  submitLabel,
  onSubmit,
  pending,
  errors,
}: {
  values: SummaryValues;
  onChange: (patch: Partial<SummaryValues>) => void;
  total: Decimal;
  lineCount: number;
  quantity: number;
  gifts: number;
  leftoverValue: Decimal;
  previousDebt: string | null;
  discountEditable: boolean;
  showUploadStatus: boolean;
  submitLabel: string;
  onSubmit: () => void;
  pending: boolean;
  errors: Record<string, string>;
}) {
  const paid = parseAmount(values.paid || "0");
  const after = previousDebt !== null && paid ? dec(previousDebt).plus(total).minus(paid) : null;

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5 shadow-xs">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">სულ ჯამში</span>
          <Money value={total} currency className="text-3xl font-semibold tracking-tight" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {lineCount} პროდუქტი · {formatQty(quantity)} ცალი{gifts ? ` · საჩუქარი ${formatQty(gifts)}` : ""}
          </span>
          {!leftoverValue.isZero() ? (
            <span>
              ნაშთი: <Money value={leftoverValue} />
            </span>
          ) : null}
        </div>
      </div>

      <Field>
        <FieldLabel>ფასდაკლება</FieldLabel>
        <Select
          value={values.discountFactor}
          onValueChange={(v) => onChange({ discountFactor: v })}
          disabled={!discountEditable}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISCOUNT_OPTIONS.map((o) => (
              <SelectItem key={o.factor} value={o.factor}>
                {o.label}
              </SelectItem>
            ))}
            {!DISCOUNT_OPTIONS.some((o) => o.factor === values.discountFactor) ? (
              <SelectItem value={values.discountFactor}>{values.discountFactor}</SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </Field>

      <Separator />

      <Field data-invalid={Boolean(errors.paidAmount)}>
        <FieldLabel htmlFor="paid">აღებული თანხა (₾)</FieldLabel>
        <Input
          id="paid"
          inputMode="decimal"
          value={values.paid}
          onChange={(e) => onChange({ paid: e.target.value })}
          onFocus={(e) => e.target.select()}
          placeholder="0"
          className="h-11 text-right text-lg tabular-nums"
          aria-invalid={Boolean(errors.paidAmount) || (values.paid !== "" && !parseAmount(values.paid))}
        />
        {errors.paidAmount ? <FieldError>{errors.paidAmount}</FieldError> : null}
      </Field>

      <Field>
        <FieldLabel>გადახდის მეთოდი</FieldLabel>
        <ToggleGroup
          type="single"
          variant="outline"
          value={values.method}
          onValueChange={(v) => v && onChange({ method: v as PaymentMethod })}
          className="w-full"
        >
          {PAYMENT_METHODS.map((m) => (
            <ToggleGroupItem key={m.value} value={m.value} className="flex-1" title={m.hint}>
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {values.method === "back" ? (
          <p className="text-xs text-muted-foreground">„დაბრუნება“ ამცირებს ვალს, მაგრამ სალაროში არ ჩაიწერება.</p>
        ) : null}
      </Field>

      <div className="flex items-center justify-between gap-3">
        <label htmlFor="waybill" className="text-sm">
          ზედნადები
        </label>
        <Switch id="waybill" checked={values.hasWaybill} onCheckedChange={(v) => onChange({ hasWaybill: v })} />
      </div>

      {showUploadStatus ? (
        <Field>
          <FieldLabel>სტატუსი (RS)</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={values.uploadStatus}
            onValueChange={(v) => v && onChange({ uploadStatus: v as "pending" | "uploaded" })}
            className="w-full"
          >
            <ToggleGroupItem value="pending" className="flex-1">
              ასატვირთი
            </ToggleGroupItem>
            <ToggleGroupItem value="uploaded" className="flex-1">
              ატვირთული
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      ) : null}

      <Field>
        <FieldLabel htmlFor="comment">კომენტარი</FieldLabel>
        <Textarea
          id="comment"
          rows={3}
          value={values.comment}
          onChange={(e) => onChange({ comment: e.target.value })}
          placeholder="კომენტარის გარეშე"
        />
      </Field>

      {previousDebt !== null ? (
        <div className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">წინა ვალი</span>
            <Money value={previousDebt} tone="debt" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">+ ჯამი − აღებული</span>
            <Money value={paid ? total.minus(paid) : total} />
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>დარჩენილი</span>
            {after ? <Money value={after} currency tone="debt" /> : <span>—</span>}
          </div>
        </div>
      ) : null}

      {errors._form ? <p className="text-sm text-destructive">{errors._form}</p> : null}

      <Button size="lg" className="h-12 w-full text-base" onClick={onSubmit} disabled={pending}>
        {pending ? <Spinner /> : null}
        {submitLabel}
      </Button>
    </div>
  );
}
