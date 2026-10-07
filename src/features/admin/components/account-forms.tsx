"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";

import { FormError, TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { changeOwnPasswordAction, updateOwnNameAction } from "../actions";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changeOwnPasswordAction, undefined);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form action={formAction} className="space-y-5">
      <FieldGroup>
        <TextField label="მიმდინარე პაროლი" name="current" type="password" autoComplete="current-password" error={errors?.current} required />
        <TextField
          label="ახალი პაროლი"
          name="next"
          type="password"
          autoComplete="new-password"
          error={errors?.next}
          description="მინიმუმ 8 სიმბოლო."
          required
        />
        <TextField label="გაიმეორეთ ახალი პაროლი" name="confirm" type="password" autoComplete="new-password" error={errors?.confirm} required />
      </FieldGroup>
      {state?.ok ? <p className="text-sm text-success">{state.message}</p> : null}
      <FormError message={state && !state.ok && !errors ? state.error : undefined} />
      <SubmitButton>პაროლის შეცვლა</SubmitButton>
    </form>
  );
}

export function NameForm({ name }: { name: string }) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex gap-2">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="თქვენი სახელი" />
      <Button
        variant="outline"
        disabled={pending || value.trim() === name}
        onClick={() =>
          startTransition(async () => {
            const result = await updateOwnNameAction(value);
            if (result.ok) toast.success(result.message ?? "შენახულია");
            else toast.error(result.error);
          })
        }
      >
        {pending ? <Spinner /> : null}
        შენახვა
      </Button>
    </div>
  );
}
