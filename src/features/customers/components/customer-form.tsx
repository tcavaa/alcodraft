"use client";

import { useActionState } from "react";

import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { FieldGroup } from "@/components/ui/field";
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
  const [state, formAction] = useActionState(action, undefined);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-6">
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
      <FormError message={state && !state.ok && !errors ? state.error : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
