import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface BaseProps {
  label: string;
  name: string;
  error?: string;
  description?: React.ReactNode;
  className?: string;
}

export function TextField({
  label,
  name,
  error,
  description,
  className,
  ...input
}: BaseProps & Omit<React.ComponentProps<"input">, "name">) {
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} name={name} aria-invalid={Boolean(error)} {...input} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

/** Amount input: accepts "1234,50" / "1234.50"; validated on the server. */
export function AmountField(props: BaseProps & Omit<React.ComponentProps<"input">, "name">) {
  return (
    <TextField
      inputMode="decimal"
      autoComplete="off"
      {...props}
      className={cn("[&_input]:text-right [&_input]:tabular-nums", props.className)}
    />
  );
}

export function TextAreaField({
  label,
  name,
  error,
  description,
  className,
  ...textarea
}: BaseProps & Omit<React.ComponentProps<"textarea">, "name">) {
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea id={name} name={name} aria-invalid={Boolean(error)} {...textarea} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
