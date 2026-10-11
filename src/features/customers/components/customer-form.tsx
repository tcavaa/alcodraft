"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";

import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/action-result";

import { type CustomerPhone, PHONE_COUNTRY_CODE } from "../phones";

export interface CustomerFormValues {
  name: string;
  address: string;
  taxId: string;
  phones: CustomerPhone[];
  /** Part of an old free-text phone that could not be read as a number — shown so it isn't lost. */
  legacyPhoneRest?: string;
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
        <PhoneFields defaults={defaults?.phones} legacyRest={defaults?.legacyPhoneRest} errors={errors} />
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

let nextKey = 0;
const blankRow = () => ({ key: nextKey++, name: "", number: "" });

/** Name + number rows; „+“ adds one. Posted as repeated `phoneName` / `phoneNumber` fields. */
function PhoneFields({
  defaults,
  legacyRest,
  errors,
}: {
  defaults?: CustomerPhone[];
  legacyRest?: string;
  errors?: Record<string, string>;
}) {
  const [rows, setRows] = useState(() =>
    defaults?.length ? defaults.map((p) => ({ key: nextKey++, name: p.name, number: p.number })) : [blankRow()],
  );
  const update = (key: number, patch: Partial<{ name: string; number: string }>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <Field className="sm:col-span-2">
      <FieldLabel>ტელეფონი და საკონტაქტო პირი</FieldLabel>
      <div className="space-y-2">
        {rows.map((r, i) => {
          const numberError = errors?.[`phones.phoneNumber.${i}`];
          const nameError = errors?.[`phones.phoneName.${i}`];
          return (
            <div key={r.key} className="space-y-1">
              <div className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <InputGroup className="col-span-2 h-10 sm:col-span-1 sm:order-2">
                  <InputGroupAddon className="tabular-nums">{PHONE_COUNTRY_CODE}</InputGroupAddon>
                  <InputGroupInput
                    name="phoneNumber"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="557994849"
                    maxLength={20}
                    value={r.number}
                    onChange={(e) => update(r.key, { number: e.target.value.replace(/[^\d\s+-]/g, "") })}
                    aria-invalid={Boolean(numberError)}
                    aria-label={`ნომერი ${i + 1}`}
                    className="tabular-nums"
                  />
                </InputGroup>
                <Input
                  name="phoneName"
                  placeholder="სახელი (მაგ. მენეჯერი)"
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  aria-invalid={Boolean(nameError)}
                  aria-label={`სახელი ${i + 1}`}
                  className="h-10 sm:order-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 sm:order-3"
                  aria-label="ნომრის წაშლა"
                  onClick={() => setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((x) => x.key !== r.key)))}
                >
                  <X />
                </Button>
              </div>
              {numberError || nameError ? <FieldError>{numberError ?? nameError}</FieldError> : null}
            </div>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setRows((rs) => [...rs, blankRow()])}>
        <Plus />
        ნომრის დამატება
      </Button>
      {legacyRest ? <FieldDescription>ძველი ჩანაწერიდან: „{legacyRest}“</FieldDescription> : null}
    </Field>
  );
}
