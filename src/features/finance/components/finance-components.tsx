"use client";

import { Archive, ArchiveRestore, Banknote, HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { AmountField, FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { RowMenu, type RowMenuItem } from "@/components/row-menu";
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
import type { ActionResult } from "@/lib/action-result";
import { dec, parseAmount } from "@/lib/money";
import { storeHref } from "@/lib/routes";

import {
  accrueWageAction,
  createAccountAction,
  createEntryAction,
  deleteEntryAction,
  payWageAction,
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const result = await createEntryAction(storeId, { accountId, amountOut: out, amountIn: inc, description, note });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success("ჩანაწერი დაემატა");
      setOpen(false);
      setOut("");
      setInc("");
      setDescription("");
      setNote("");
      setErrors({});
    });

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
              ბალანსი შეიცვლება: <span className={net.isNegative() ? "text-destructive" : "text-success"}>{net.isNegative() ? "" : "+"}{net.toString()} ₾</span>
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
  canDelete,
  locked,
}: {
  storeId: number;
  entryId: number;
  description: string;
  note: string;
  canDelete: boolean;
  /** Belongs to an operation — change it there. */
  locked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(description);
  const [n, setN] = useState(note);
  const [pending, startTransition] = useTransition();
  const items: RowMenuItem[] = [
    { type: "action", label: "კომენტარის შეცვლა", icon: <Pencil />, run: async () => setEditing(true) },
  ];
  if (canDelete && !locked) {
    items.push({ type: "separator" });
    items.push({
      type: "action",
      label: "წაშლა",
      icon: <Trash2 />,
      destructive: true,
      run: () => deleteEntryAction(storeId, entryId),
      confirm: {
        title: "ჩანაწერის წაშლა?",
        description: "ბალანსი ამ და შემდეგი ჩანაწერებისთვის გადაითვლება. ხელფასის გადახდის წაშლა თანამშრომელს ვალს აღუდგენს.",
        confirmLabel: "წაშლა",
      },
    });
  }
  const save = () =>
    startTransition(async () => {
      const result = await updateEntryTextAction(storeId, entryId, { description: desc, note: n });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("შენახულია");
      setEditing(false);
    });
  return (
    <>
      <RowMenu items={items} />
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

export function NewAccountButton({ storeId }: { storeId: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  const submit = () =>
    startTransition(async () => {
      const result = await createAccountAction(storeId, name);
      if (result && !result.ok) toast.error(result.error);
    });
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus />
          ახალი სალარო
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ახალი სალარო</DialogTitle>
          <DialogDescription>მაგ.: საბანკო ანგარიში ან მეორე სალარო.</DialogDescription>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="დასახელება" autoFocus />
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !name.trim()}>
            {pending ? <Spinner /> : null}
            შექმნა
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const [state, formAction] = useActionState(action, undefined);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="space-y-6">
      <FieldGroup>
        <TextField label="სახელი" name="name" defaultValue={defaults?.name} error={errors?.name} required autoFocus />
        <AmountField
          label="ხელფასის ნაშთი (₾)"
          name="wageBalance"
          defaultValue={defaults ? dec(defaults.wageBalance).toString() : ""}
          error={errors?.wageBalance}
          description="გადასახდელი (დარიცხული და ჯერ გაუცემელი) ხელფასი."
        />
      </FieldGroup>
      <FormError message={state && !state.ok && !errors ? state.error : undefined} />
      <div className="flex justify-end">
        <SubmitButton size="lg">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

/** Old historywages forms: "wage_form" (add to balance) and "gadaxdili_form" (pay out). */
export function WageForm({ storeId, employeeId, mode }: { storeId: number; employeeId: number; mode: "accrue" | "pay" }) {
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const action = mode === "accrue" ? accrueWageAction : payWageAction;
      const result = await action(storeId, employeeId, { amount, text });
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "შენახულია");
      setAmount("");
      setText("");
      setErrors({});
    });
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field data-invalid={Boolean(errors.amount)}>
        <FieldLabel htmlFor={`${mode}-amount`}>თანხა (₾)</FieldLabel>
        <Input id={`${mode}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="text-right tabular-nums" />
        {errors.amount ? <FieldError>{errors.amount}</FieldError> : null}
      </Field>
      <Field>
        <FieldLabel htmlFor={`${mode}-text`}>კომენტარი</FieldLabel>
        <Input id={`${mode}-text`} value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "accrue" ? "მაგ.: ოქტომბრის ხელფასი" : "მაგ.: ავანსი"} />
      </Field>
      <Button type="submit" variant={mode === "pay" ? "default" : "outline"} className="w-full" disabled={pending}>
        {pending ? <Spinner /> : mode === "pay" ? <Banknote /> : <HandCoins />}
        {mode === "pay" ? "გაცემა (სალაროდან)" : "დარიცხვა"}
      </Button>
    </form>
  );
}

export function EmployeeRowMenu({ storeId, employeeId, name, archived }: { storeId: number; employeeId: number; name: string; archived: boolean }) {
  const items: RowMenuItem[] = [
    { type: "link", label: "რედაქტირება", href: storeHref(storeId, `employees/${employeeId}/edit`), icon: <Pencil /> },
    { type: "separator" },
    archived
      ? { type: "action", label: "აღდგენა", icon: <ArchiveRestore />, run: () => setEmployeeArchivedAction(storeId, employeeId, false) }
      : {
          type: "action",
          label: "სანაგვეში გადატანა",
          icon: <Archive />,
          run: () => setEmployeeArchivedAction(storeId, employeeId, true),
          confirm: { title: `${name} — სანაგვეში გადატანა?`, confirmLabel: "გადატანა" },
        },
  ];
  return <RowMenu items={items} />;
}
