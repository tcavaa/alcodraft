"use client";

import { useState } from "react";

import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useActionForm } from "@/hooks/use-action-form";
import { useServerAction } from "@/hooks/use-server-action";
import { PASSWORD_MIN } from "@/lib/policy";

import { changeOwnPasswordAction, updateOwnNameAction } from "../actions";

export function ChangePasswordForm() {
  const form = useActionForm(changeOwnPasswordAction, { resetOnSuccess: true });
  return (
    <form onSubmit={form.onSubmit} className="space-y-5">
      <FieldGroup>
        <TextField label="მიმდინარე პაროლი" name="current" type="password" autoComplete="current-password" error={form.errors?.current} required />
        <TextField
          label="ახალი პაროლი"
          name="next"
          type="password"
          autoComplete="new-password"
          error={form.errors?.next}
          description={`მინიმუმ ${PASSWORD_MIN} სიმბოლო.`}
          minLength={PASSWORD_MIN}
          required
        />
        <TextField label="გაიმეორეთ ახალი პაროლი" name="confirm" type="password" autoComplete="new-password" error={form.errors?.confirm} required />
      </FieldGroup>
      <FormError message={form.formError} />
      <SubmitButton pending={form.pending}>პაროლის შეცვლა</SubmitButton>
    </form>
  );
}

export function NameForm({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const { run, pending } = useServerAction();
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="თქვენი სახელი" aria-label="სახელი" />
      <Button variant="outline" disabled={pending || value.trim() === name} onClick={() => run(() => updateOwnNameAction(value))}>
        {pending ? <Spinner /> : null}
        შენახვა
      </Button>
    </div>
  );
}
