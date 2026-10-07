"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

import { loginAction, type LoginState } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="next" value={next ?? ""} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">ელფოსტა</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupAddon>
              <Mail />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="name@alcodraft.ge"
              defaultValue={state?.email}
              required
              autoFocus
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="password">პაროლი</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupAddon>
              <LockKeyhole />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
          </InputGroup>
        </Field>
      </FieldGroup>

      {state?.error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 w-full text-[0.95rem]" disabled={pending}>
        {pending ? <Spinner /> : null}
        შესვლა
      </Button>
    </form>
  );
}
