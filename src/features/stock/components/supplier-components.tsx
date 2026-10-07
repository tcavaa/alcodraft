"use client";

import { Archive, ArchiveRestore, Banknote, Pencil, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { ConfirmAction } from "@/components/confirm-action";
import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { RowMenu, type RowMenuItem } from "@/components/row-menu";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
  const [state, formAction] = useActionState(action, undefined);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="space-y-6">
      <FieldGroup>
        <TextField label="დასახელება" name="name" defaultValue={defaults?.name} error={errors?.name} required autoFocus />
        <Field orientation="horizontal">
          <Switch id="isReturns" name="isReturns" defaultChecked={defaults?.isReturns} />
          <div>
            <FieldLabel htmlFor="isReturns">დაბრუნებული საქონლის მომწოდებელი</FieldLabel>
            <FieldDescription>მიღების ფორმაში გამოჩნდება ყველა პროდუქტი (ძველი „დაბრუნებული — არ წაშალოთ“).</FieldDescription>
          </div>
        </Field>
      </FieldGroup>
      <FormError message={state && !state.ok && !errors ? state.error : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
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
  const items: RowMenuItem[] = [
    { type: "link", label: "რედაქტირება", href: storeHref(storeId, `suppliers/${supplierId}/edit`), icon: <Pencil /> },
    { type: "separator" },
    archived
      ? { type: "action", label: "აღდგენა", icon: <ArchiveRestore />, run: () => setSupplierArchivedAction(storeId, supplierId, false) }
      : {
          type: "action",
          label: "სანაგვეში გადატანა",
          icon: <Archive />,
          run: () => setSupplierArchivedAction(storeId, supplierId, true),
          confirm: { title: `${name} — სანაგვეში გადატანა?`, confirmLabel: "გადატანა" },
        },
  ];
  if (archived && canDelete) {
    items.push({
      type: "action",
      label: "სამუდამოდ წაშლა",
      icon: <Trash2 />,
      destructive: true,
      run: () => deleteSupplierAction(storeId, supplierId),
      confirm: {
        title: `${name} — სამუდამოდ წაშლა?`,
        description: "წაიშლება მხოლოდ თუ მიღებების ისტორია არ აქვს.",
        confirmLabel: "წაშლა",
      },
    });
  }
  return <RowMenu items={items} />;
}

/** Old "გადახდა" box on the supplier page: amount + note → cash-book expense. */
export function PaySupplierForm({ storeId, supplierId }: { storeId: number; supplierId: number }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await paySupplierAction(storeId, supplierId, { amount, note });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("გადახდა ჩაიწერა სალაროში");
      setAmount("");
      setNote("");
      setErrors({});
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field data-invalid={Boolean(errors.amount)}>
        <FieldLabel htmlFor="pay-amount">თანხა (₾)</FieldLabel>
        <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-right tabular-nums" />
        {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor="pay-note">კომენტარი</FieldLabel>
        <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="მაგ.: ნაწილობრივი გადახდა" />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner /> : <Banknote />}
        გადახდა
      </Button>
    </form>
  );
}

export function DeleteReceiptButton({ storeId, receiptId, number }: { storeId: number; receiptId: number; number: number }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" className="text-destructive hover:text-destructive">
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
