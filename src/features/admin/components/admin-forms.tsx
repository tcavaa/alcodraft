"use client";

import { KeyRound, Shuffle, Trash2 } from "lucide-react";
import { useState } from "react";

import { ConfirmAction } from "@/components/confirm-action";
import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useActionForm } from "@/hooks/use-action-form";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/lib/action-result";
import { PASSWORD_MIN } from "@/lib/policy";

import { deleteStoreAction, deleteUserAction, resetPasswordAction } from "../actions";

type FormAction = (prev: ActionResult | undefined, formData: FormData) => Promise<ActionResult>;

/** Random, readable temporary password (no ambiguous characters). */
function generatePassword(length = 12) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// ── Stores ──────────────────────────────────────────────────────────────────

export function StoreForm({
  action,
  defaults,
  submitLabel,
  showAdvanced,
}: {
  action: FormAction;
  defaults?: { name: string; sortOrder: number; isArchived: boolean };
  submitLabel: string;
  showAdvanced: boolean;
}) {
  const form = useActionForm(action);
  return (
    <form onSubmit={form.onSubmit} className="space-y-6">
      <FieldGroup>
        <TextField label="დასახელება" name="name" defaultValue={defaults?.name} error={form.errors?.name} required autoFocus />
        {showAdvanced ? (
          <>
            <TextField
              label="რიგითობა"
              name="sortOrder"
              type="number"
              min={0}
              defaultValue={defaults?.sortOrder ?? 0}
              error={form.errors?.sortOrder}
              description="მენიუში რიგითობა (პატარა რიცხვი — ზემოთ)."
            />
            <Field orientation="horizontal">
              <Switch id="isArchived" name="isArchived" defaultChecked={defaults?.isArchived} />
              <div>
                <FieldLabel htmlFor="isArchived">დაარქივებული</FieldLabel>
                <FieldDescription>დაარქივებულ მაღაზიას მხოლოდ სუპერ ადმინი ხედავს; მონაცემები ინახება.</FieldDescription>
              </div>
            </Field>
          </>
        ) : null}
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

export function DeleteStoreButton({ storeId, name }: { storeId: number; name: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="destructive">
          <Trash2 />
          მაღაზიის წაშლა
        </Button>
      }
      title={`${name} — წაშლა?`}
      description="წაიშლება მხოლოდ ცარიელი მაღაზია (ობიექტების, პროდუქციის, ოპერაციების და ჩანაწერების გარეშე). სხვა შემთხვევაში დაარქივეთ."
      confirmLabel="წაშლა"
      destructive
      action={() => deleteStoreAction(storeId)}
    />
  );
}

// ── Users ───────────────────────────────────────────────────────────────────

export function UserForm({
  action,
  stores,
  defaults,
  submitLabel,
  isCreate,
  isSelf,
}: {
  action: FormAction;
  stores: { id: number; name: string; isArchived: boolean }[];
  defaults?: { email: string; name: string; role: "super_admin" | "user"; isActive: boolean; storeIds: number[] };
  submitLabel: string;
  isCreate: boolean;
  isSelf?: boolean;
}) {
  // Submitted without React's automatic form reset: after a save the checkboxes, switch and role
  // keep showing what was saved (a reset used to bring back the old access and save it again).
  const form = useActionForm(action);
  const errors = form.errors;
  const [role, setRole] = useState<"super_admin" | "user">(defaults?.role ?? "user");
  const [password, setPassword] = useState("");

  return (
    <form onSubmit={form.onSubmit} className="space-y-6">
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <TextField label="ელფოსტა" name="email" type="email" defaultValue={defaults?.email} error={errors?.email} required autoComplete="off" />
        <TextField label="სახელი" name="name" defaultValue={defaults?.name} error={errors?.name} placeholder="მაგ.: ნიკა" />
        {isCreate ? (
          <Field data-invalid={Boolean(errors?.password)} className="sm:col-span-2">
            <FieldLabel htmlFor="password">პაროლი</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="password"
                name="password"
                type="text"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={PASSWORD_MIN}
              />
              <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                <Shuffle />
                გენერაცია
              </Button>
            </div>
            <FieldDescription>
              მინიმუმ {PASSWORD_MIN} სიმბოლო. გადაეცით მომხმარებელს — შეცვლა შეუძლია „ჩემი ანგარიშიდან“.
            </FieldDescription>
            {errors?.password ? <p className="text-sm text-destructive">{errors.password}</p> : null}
          </Field>
        ) : null}
      </FieldGroup>

      <FieldSet>
        <FieldLegend>როლი</FieldLegend>
        <RadioGroup name="role" value={role} onValueChange={(v) => setRole(v as "super_admin" | "user")} className="grid gap-3 sm:grid-cols-2" disabled={isSelf}>
          <FieldLabel htmlFor="role-user">
            <Field orientation="horizontal">
              <RadioGroupItem value="user" id="role-user" />
              <div>
                <div className="font-medium">მომხმარებელი</div>
                <FieldDescription>ხედავს მხოლოდ მინიჭებულ მაღაზიებს.</FieldDescription>
              </div>
            </Field>
          </FieldLabel>
          <FieldLabel htmlFor="role-super">
            <Field orientation="horizontal">
              <RadioGroupItem value="super_admin" id="role-super" />
              <div>
                <div className="font-medium">სუპერ ადმინი</div>
                <FieldDescription>ყველა მაღაზია, მომხმარებლები, წაშლა.</FieldDescription>
              </div>
            </Field>
          </FieldLabel>
        </RadioGroup>
        {isSelf ? <input type="hidden" name="role" value={role} /> : null}
      </FieldSet>

      {role === "user" ? (
        <FieldSet>
          <FieldLegend>მაღაზიები</FieldLegend>
          <FieldDescription>რომელ მაღაზიებზე ექნება წვდომა.</FieldDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {stores.map((s) => (
              <label key={s.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 has-[:checked]:border-gold/60 has-[:checked]:bg-accent/40">
                <Checkbox name="storeIds" value={String(s.id)} defaultChecked={defaults?.storeIds.includes(s.id)} />
                <span className="flex-1">{s.name}</span>
                {s.isArchived ? <span className="text-xs text-muted-foreground">არქივი</span> : null}
              </label>
            ))}
          </div>
        </FieldSet>
      ) : null}

      <Field orientation="horizontal">
        <Switch id="isActive" name="isActive" defaultChecked={defaults?.isActive ?? true} disabled={isSelf} />
        <div>
          <FieldLabel htmlFor="isActive">აქტიური</FieldLabel>
          <FieldDescription>გათიშული მომხმარებელი ვერ შედის სისტემაში (მიმდინარე სესიებიც უქმდება).</FieldDescription>
        </div>
        {isSelf ? <input type="hidden" name="isActive" value="on" /> : null}
      </Field>

      <FormError message={form.formError} />
      <div className="flex justify-end">
        <SubmitButton size="lg" pending={form.pending}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

export function ResetPasswordDialog({ userId, email }: { userId: number; email: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const { run, pending } = useServerAction();
  const submit = () => run(() => resetPasswordAction(userId, value), { onSuccess: () => setOpen(false) });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (o) setValue(generatePassword());
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound />
          პაროლის შეცვლა
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ახალი პაროლი — {email}</DialogTitle>
          <DialogDescription>მომხმარებელი გამოვა ყველა მოწყობილობიდან. ახალი პაროლი გადაეცით პირადად.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" aria-label="ახალი პაროლი" />
          <Button type="button" variant="outline" size="icon" onClick={() => setValue(generatePassword())} aria-label="გენერაცია">
            <Shuffle />
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            გაუქმება
          </Button>
          <Button onClick={submit} disabled={pending || value.length < PASSWORD_MIN}>
            {pending ? <Spinner /> : null}
            შენახვა
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteUserButton({ userId, email }: { userId: number; email: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 />
          წაშლა
        </Button>
      }
      title={`${email} — წაშლა?`}
      description="მომხმარებელი წაიშლება; მის მიერ შექმნილი ოპერაციები და ისტორია დარჩება. თუ მხოლოდ დროებით გსურთ — გათიშეთ."
      confirmLabel="წაშლა"
      destructive
      action={() => deleteUserAction(userId)}
    />
  );
}
