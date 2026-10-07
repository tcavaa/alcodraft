"use client";

import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FieldGroup } from "@/components/ui/field";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/action-result";

export interface CustomerFormValues {
  name: string;
  address: string;
  taxId: string;
  phone: string;
  contactPerson: string;
}

/** Old company/add + company/edit fields. */
export function CustomerForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  defaults?: Partial<CustomerFormValues>;
  submitLabel: string;
}) {
  const form = useActionForm(action);
  const errors = form.errors;

  return (
    <form onSubmit={form.onSubmit} className="space-y-6">
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="დასახელება"
          name="name"
          defaultValue={defaults?.name}
          error={errors?.name}
          required
          autoFocus
          className="sm:col-span-2"
        />
        <TextField label="მისამართი" name="address" defaultValue={defaults?.address} error={errors?.address} className="sm:col-span-2" />
        <TextField label="საიდენტიფიკაციო ნომერი" name="taxId" defaultValue={defaults?.taxId} error={errors?.taxId} />
        <TextField label="ტელეფონი" name="phone" type="tel" defaultValue={defaults?.phone} error={errors?.phone} />
        <TextField
          label="საკონტაქტო პირი"
          name="contactPerson"
          defaultValue={defaults?.contactPerson}
          error={errors?.contactPerson}
          className="sm:col-span-2"
        />
      </FieldGroup>
      <FormError message={form.formError} />
      <div className="flex justify-end">
        <SubmitButton size="lg" pending={form.pending}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
