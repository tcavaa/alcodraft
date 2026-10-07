"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/action-result";

export type RowMenuItem =
  | { type: "link"; label: string; href: string; icon?: React.ReactNode }
  | {
      type: "action";
      label: string;
      icon?: React.ReactNode;
      run: () => Promise<ActionResult<unknown> | void>;
      /** Ask first (dialog) — for destructive or important actions. */
      confirm?: { title: string; description?: string; confirmLabel?: string };
      destructive?: boolean;
      success?: string;
    }
  | { type: "separator" };

/** "⋯" menu for table rows; confirmations open in a dialog outside the menu. */
export function RowMenu({ items, label = "მოქმედებები" }: { items: RowMenuItem[]; label?: string }) {
  const [confirming, setConfirming] = useState<Extract<RowMenuItem, { type: "action" }> | null>(null);
  const [pending, startTransition] = useTransition();

  const execute = (item: Extract<RowMenuItem, { type: "action" }>) =>
    startTransition(async () => {
      const result = await item.run();
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      const message = (result && result.ok && result.message) || item.success;
      if (message) toast.success(message);
      setConfirming(null);
    });

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label} disabled={pending}>
            {pending ? <Spinner /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {items.map((item, i) => {
            if (item.type === "separator") return <DropdownMenuSeparator key={i} />;
            if (item.type === "link") {
              return (
                <DropdownMenuItem key={i} asChild>
                  <Link href={item.href}>
                    {item.icon}
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              );
            }
            return (
              <DropdownMenuItem
                key={i}
                variant={item.destructive ? "destructive" : "default"}
                onSelect={() => (item.confirm ? setConfirming(item) : execute(item))}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={Boolean(confirming)} onOpenChange={(o) => !o && !pending && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.confirm?.title}</AlertDialogTitle>
            {confirming?.confirm?.description ? (
              <AlertDialogDescription>{confirming.confirm.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>გაუქმება</AlertDialogCancel>
            <Button
              variant={confirming?.destructive ? "destructive" : "default"}
              disabled={pending}
              onClick={() => confirming && execute(confirming)}
            >
              {pending ? <Spinner /> : null}
              {confirming?.confirm?.confirmLabel ?? "დადასტურება"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
