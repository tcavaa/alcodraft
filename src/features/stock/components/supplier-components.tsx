"use client";

import { Banknote, Pencil, Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { AmountNoteForm } from "@/components/forms/amount-note-form";
import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { archiveMenuItems, RowMenu } from "@/components/row-menu";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useActionForm } from "@/hooks/use-action-form";
import type { ActionResult } from "@/lib/action-result";
import { storeHref } from "@/lib/routes";

import {
  deleteReceiptAction,
  deleteSupplierAction,
  paySupplierAction,
  setSupplierArchivedAction,
} from "../actions";

export function SupplierForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  defaults?: { name: string; isReturns: boolean };
  submitLabel: string;
}) {
  const form = useActionForm(action);
  return (
    <form onSubmit={form.onSubmit} className="space-y-6">
      <FieldGroup>
        <TextField label="დასახელება" name="name" defaultValue={defaults?.name} error={form.errors?.name} required autoFocus />
        <Field orientation="horizontal">
          <Switch id="isReturns" name="isReturns" defaultChecked={defaults?.isReturns} />
          <div>
            <FieldLabel htmlFor="isReturns">დაბრუნებული საქონლის მომწოდებელი</FieldLabel>
            <FieldDescription>მიღების ფორმაში გამოჩნდება ყველა პროდუქტი (ძველი „დაბრუნებული — არ წაშალოთ“).</FieldDescription>
          </div>
        </Field>
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

export function SupplierRowMenu({
  storeId,
  supplierId,
  name,
  archived,
  canDelete,
}: {
  storeId: number;
  supplierId: number;
  name: string;
  archived: boolean;
  canDelete: boolean;
}) {
  return (
    <RowMenu
      label={`${name} — მოქმედებები`}
      items={[
        { type: "link", label: "რედაქტირება", href: storeHref(storeId, `suppliers/${supplierId}/edit`), icon: <Pencil /> },
        { type: "separator" },
        ...archiveMenuItems({
          name,
          archived,
          archive: () => setSupplierArchivedAction(storeId, supplierId, true),
          restore: () => setSupplierArchivedAction(storeId, supplierId, false),
          remove: canDelete
            ? {
                run: () => deleteSupplierAction(storeId, supplierId),
                description: "წაიშლება მხოლოდ თუ მიღებები და გადახდები არ აქვს.",
              }
            : undefined,
        }),
      ]}
    />
  );
}

/** Old "გადახდა" box on the supplier page: amount + note → cash-book expense. */
export function PaySupplierForm({ storeId, supplierId, supplierName }: { storeId: number; supplierId: number; supplierName: string }) {
  return (
    <AmountNoteForm
      idPrefix="pay"
      notePlaceholder="მაგ.: ნაწილობრივი გადახდა"
      submitLabel="გადახდა"
      submitIcon={<Banknote />}
      confirmTitle={`გადახდა მომწოდებელს — ${supplierName}`}
      confirmDescription={() => <p>ჩაიწერება სალაროში ხარჯად და შეამცირებს მომწოდებლის „დარჩა“-ს.</p>}
      save={({ amount, note, requestId }) => paySupplierAction(storeId, supplierId, { amount, note, requestId })}
    />
  );
}

export function DeleteReceiptButton({ storeId, receiptId, number }: { storeId: number; receiptId: number; number: number }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" className="text-destructive hover:text-destructive print:hidden">
          <Trash2 />
          წაშლა
        </Button>
      }
      title={`მიღება #${number} — წაშლა?`}
      description="მიღებული რაოდენობები ჩამოიწერება საწყობიდან და მომწოდებლის გადასახდელი შემცირდება."
      confirmLabel="წაშლა"
      destructive
      action={() => deleteReceiptAction(storeId, receiptId)}
    />
  );
}
