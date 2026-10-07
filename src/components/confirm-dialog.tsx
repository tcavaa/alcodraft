"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Controlled "are you sure?" dialog; stays open with a spinner while `pending`. */
export function ConfirmDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "დადასტურება",
  cancelLabel = "გაუქმება",
  destructive = false,
  pending,
  onConfirm,
}: {
  /** Element that opens the dialog (optional — the dialog can also be opened from code). */
  trigger?: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">{description}</div>
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={pending}>
            {pending ? <Spinner /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Label/value rows for the amounts shown in a confirmation. */
export function ConfirmFigures({ rows }: { rows: { label: React.ReactNode; value: React.ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
      {rows.map((r, i) => (
        <div key={i} className="contents">
          <dt>{r.label}</dt>
          <dd className={r.strong ? "text-right font-semibold text-foreground" : "text-right"}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
