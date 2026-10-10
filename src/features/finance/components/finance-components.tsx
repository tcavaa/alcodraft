"use client";

import { Banknote, HandCoins, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { AmountNoteForm } from "@/components/forms/amount-note-form";
import { AmountField, FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { archiveMenuItems, RowMenu, type RowMenuItem } from "@/components/row-menu";
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
import { useActionForm } from "@/hooks/use-action-form";
import { useRequestId } from "@/hooks/use-request-id";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/lib/action-result";
import { dec, formatMoney, parseAmount } from "@/lib/money";
import { storeHref } from "@/lib/routes";

import {
  accrueWageAction,
  createEntryAction,
  payWageAction,
  renameAccountAction,
  setEmployeeArchivedAction,
  updateEntryTextAction,
} from "../actions";

/** Old finance/add: expense and/or income with a comment. */
export function AddEntryDialog({ storeId, accountId, accountName }: { storeId: number; accountId: number; accountName: string }) {
  const [open, setOpen] = useState(false);
  const [out, setOut] = useState("");
  const [inc, setInc] = useState("");
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const requestId = useRequestId();
  const { run, pending, errors } = useServerAction();

  const submit = () =>
    run(
      () =>
        createEntryAction(storeId, {
          accountId,
          amountOut: out,
          amountIn: inc,
          description,
          note,
          requestId: requestId.current(),
        }),
      {
        onSuccess: () => {
          requestId.renew();
          setOpen(false);
          setOut("");
          setInc("");
          setDescription("");
          setNote("");
        },
      },
    );

  const net = (parseAmount(inc || "0") ?? dec(0)).minus(parseAmount(out || "0") ?? dec(0));

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          ჩანაწერის დამატება
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ახალი ჩანაწერი — {accountName}</DialogTitle>
          <DialogDescription>ბალანსი = წინა ბალანსი − ხარჯი + შემოსავალი.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field data-invalid={Boolean(errors.amountOut)}>
              <FieldLabel htmlFor="e-out">ხარჯი (₾)</FieldLabel>
              <Input id="e-out" inputMode="decimal" value={out} onChange={(e) => setOut(e.target.value)} placeholder="0" className="text-right tabular-nums" autoFocus />
              {errors.amountOut ? <FieldError>{errors.amountOut}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(errors.amountIn)}>
              <FieldLabel htmlFor="e-in">შემოსავალი (₾)</FieldLabel>
              <Input id="e-in" inputMode="decimal" value={inc} onChange={(e) => setInc(e.target.value)} placeholder="0" className="text-right tabular-nums" />
              {errors.amountIn ? <FieldError>{errors.amountIn}</FieldError> : null}
            </Field>
          </div>
          <Field data-invalid={Boolean(errors.description)}>
            <FieldLabel htmlFor="e-desc">კომენტარი</FieldLabel>
            <Textarea id="e-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="მაგ.: ბენზინი, ქირა, ინკასო" />
            {errors.description ? <FieldError>{errors.description}</FieldError> : null}
          </Field>
          <Field>
            <FieldLabel htmlFor="e-note">დამატებითი შენიშვნა</FieldLabel>
            <Input id="e-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {!net.isZero() ? (
            <p className="text-sm text-muted-foreground">
              ბალანსი შეიცვლება: <span className={net.isNegative() ? "text-destructive" : "text-success"}>{net.isNegative() ? "" : "+"}{formatMoney(net)}</span>
            </p>
          ) : null}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            გაუქმება
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Spinner /> : null}
            დამატება
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EntryRowMenu({
  storeId,
  entryId,
  description,
  note,
}: {
  storeId: number;
  entryId: number;
  description: string;
  note: string;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(description);
  const [n, setN] = useState(note);
  const { run, pending } = useServerAction();
  // Every time the dialog opens it starts from the saved text (not a cancelled half-edit).
  const openEditor = () => {
    setDesc(description);
    setN(note);
    setEditing(true);
  };
  // Cash entries can't be deleted from the app (owner's decision) — only their text is editable.
  const items: RowMenuItem[] = [
    { type: "action", label: "კომენტარის შეცვლა", icon: <Pencil />, run: async () => openEditor() },
  ];
  const save = () =>
    run(() => updateEntryTextAction(storeId, entryId, { description: desc, note: n }), {
      onSuccess: () => setEditing(false),
    });
  return (
    <>
      <RowMenu items={items} label={`${description || "ჩანაწერი"} — მოქმედებები`} />
      <Dialog open={editing} onOpenChange={(o) => !pending && setEditing(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>კომენტარის შეცვლა</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="ed-desc">კომენტარი</FieldLabel>
              <Textarea id="ed-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="ed-note">შენიშვნა</FieldLabel>
              <Input id="ed-note" value={n} onChange={(e) => setN(e.target.value)} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={pending}>
              გაუქმება
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? <Spinner /> : null}
              შენახვა
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Name dialog for a cash book: create a new one or rename an existing one (super admin). */
function AccountNameDialog({
  trigger,
  title,
  description,
  initialName,
  submitLabel,
  save,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  initialName: string;
  submitLabel: string;
  save: (name: string) => Promise<ActionResult<unknown> | void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const { run, pending } = useServerAction();
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (o) setName(initialName);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="account-name" className="sr-only">
            დასახელება
          </FieldLabel>
          <Input id="account-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="დასახელება" autoFocus />
        </Field>
        <DialogFooter>
          <Button
            onClick={() => run(() => save(name), { onSuccess: () => setOpen(false) })}
            disabled={pending || !name.trim() || name.trim() === initialName}
          >
            {pending ? <Spinner /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RenameAccountButton({ storeId, accountId, name }: { storeId: number; accountId: number; name: string }) {
  return (
    <AccountNameDialog
      trigger={
        <Button variant="ghost" size="sm">
          <Pencil />
          გადარქმევა
        </Button>
      }
      title={`სალაროს გადარქმევა — ${name}`}
      initialName={name}
      submitLabel="შენახვა"
      save={(next) => renameAccountAction(storeId, accountId, next)}
    />
  );
}

// ── Employees ───────────────────────────────────────────────────────────────

export function EmployeeForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;
  defaults?: { name: string; wageBalance: string };
  submitLabel: string;
}) {
  const form = useActionForm(action);
  const balance = defaults ? dec(defaults.wageBalance).toString() : "";
  return (
    <form onSubmit={form.onSubmit} className="space-y-6">
      <FieldGroup>
        <TextField label="სახელი" name="name" defaultValue={defaults?.name} error={form.errors?.name} required autoFocus />
        <AmountField
          label="ხელფასის ნაშთი (₾)"
          name="wageBalance"
          defaultValue={balance}
          error={form.errors?.wageBalance}
          description="გადასახდელი (დარიცხული და ჯერ გაუცემელი) ხელფასი."
          required={Boolean(defaults)}
        />
        {/* The balance this form showed: saving won't undo a wage paid or accrued meanwhile. */}
        {defaults ? <input type="hidden" name="wageBalanceBefore" value={balance} /> : null}
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

/** Old historywages forms: "wage_form" (add to balance) and "gadaxdili_form" (pay out). */
export function WageForm({
  storeId,
  employeeId,
  employeeName,
  mode,
}: {
  storeId: number;
  employeeId: number;
  employeeName: string;
  mode: "accrue" | "pay";
}) {
  const pay = mode === "pay";
  return (
    <AmountNoteForm
      idPrefix={mode}
      notePlaceholder={pay ? "მაგ.: ავანსი" : "მაგ.: ოქტომბრის ხელფასი"}
      submitLabel={pay ? "გაცემა (სალაროდან)" : "დარიცხვა"}
      submitIcon={pay ? <Banknote /> : <HandCoins />}
      submitVariant={pay ? "default" : "outline"}
      confirmTitle={`${pay ? "ხელფასის გაცემა" : "ხელფასის დარიცხვა"} — ${employeeName}`}
      confirmDescription={() =>
        pay ? (
          <p>ჩაიწერება სალაროში ხარჯად და შეამცირებს გასაცემ ხელფასს.</p>
        ) : (
          <p>გაზრდის გასაცემ ხელფასს; სალარო არ იცვლება.</p>
        )
      }
      save={({ amount, note, requestId }) =>
        (pay ? payWageAction : accrueWageAction)(storeId, employeeId, { amount, text: note, requestId })
      }
    />
  );
}

export function EmployeeRowMenu({ storeId, employeeId, name, archived }: { storeId: number; employeeId: number; name: string; archived: boolean }) {
  return (
    <RowMenu
      label={`${name} — მოქმედებები`}
      items={[
        { type: "link", label: "რედაქტირება", href: storeHref(storeId, `employees/${employeeId}/edit`), icon: <Pencil /> },
        { type: "separator" },
        ...archiveMenuItems({
          name,
          archived,
          archive: () => setEmployeeArchivedAction(storeId, employeeId, true),
          restore: () => setEmployeeArchivedAction(storeId, employeeId, false),
        }),
      ]}
    />
  );
}
