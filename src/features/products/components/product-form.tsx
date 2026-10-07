"use client";

import { useActionState, useState } from "react";

import { AmountField, FormError, TextAreaField, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/lib/action-result";
import { dec } from "@/lib/money";

export function ProductForm({
  action,
  suppliers,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  suppliers: { id: number; name: string; isArchived: boolean }[];
  defaults?: { name: string; supplierId: number | null; salePrice: string; purchasePrice: string; comment: string };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const supplierOptions = [
    { value: "none", label: "— მომწოდებლის გარეშე —" },
    ...suppliers
      .filter((s) => !s.isArchived || s.id === defaults?.supplierId)
      .map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const [supplierId, setSupplierId] = useState(defaults?.supplierId ? String(defaults.supplierId) : "none");

  return (
    <form action={formAction} className="space-y-6">
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="დასახელება"
          name="name"
          defaultValue={defaults?.name}
          error={errors?.name}
          required
          className="sm:col-span-2"
        />
        <Field data-invalid={Boolean(errors?.supplierId)} className="sm:col-span-2">
          <FieldLabel>მომწოდებელი</FieldLabel>
          <Select name="supplierId" value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="w-full">
              {/* Label rendered on the server too (Radix fills an empty SelectValue only after hydration). */}
              <SelectValue>{supplierOptions.find((o) => o.value === supplierId)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {supplierOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors?.supplierId ? <FieldError>{errors.supplierId}</FieldError> : null}
        </Field>
        <AmountField
          label="ფასი (₾)"
          name="salePrice"
          defaultValue={defaults ? dec(defaults.salePrice).toString() : ""}
          error={errors?.salePrice}
          description="გასაყიდი ფასი — ოპერაციაში ავტომატურად ჩაიწერება."
          required
        />
        <AmountField
          label="შემოტანის ფასი (₾)"
          name="purchasePrice"
          defaultValue={defaults ? dec(defaults.purchasePrice).toString() : ""}
          error={errors?.purchasePrice}
          description="საწყობში მიღებისას ნაგულისხმევი ფასი."
        />
        <TextAreaField
          label="კომენტარი"
          name="comment"
          defaultValue={defaults?.comment}
          error={errors?.comment}
          rows={2}
          className="sm:col-span-2"
        />
      </FieldGroup>
      <FormError message={state && !state.ok && !errors ? state.error : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
