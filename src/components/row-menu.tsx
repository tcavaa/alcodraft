"use client";

import { Archive, ArchiveRestore, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useServerAction } from "@/hooks/use-server-action";
import type { ActionResult } from "@/lib/action-result";

type Result = Promise<ActionResult<unknown> | void>;

export type RowMenuItem =
  | { type: "link"; label: string; href: string; icon?: React.ReactNode }
  | {
      type: "action";
      label: string;
      icon?: React.ReactNode;
      run: () => Result;
      /** Ask first (dialog) — for destructive or important actions. */
      confirm?: { title: string; description?: string; confirmLabel?: string };
      destructive?: boolean;
      success?: string;
    }
  | { type: "separator" };

type ActionItem = Extract<RowMenuItem, { type: "action" }>;

/** "⋯" menu for table rows; confirmations open in a dialog outside the menu. */
export function RowMenu({ items, label = "მოქმედებები" }: { items: RowMenuItem[]; label?: string }) {
  const [confirming, setConfirming] = useState<ActionItem | null>(null);
  const { run, pending } = useServerAction();

  const execute = (item: ActionItem) => run(item.run, { success: item.success, onSuccess: () => setConfirming(null) });

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

      <ConfirmDialog
        open={Boolean(confirming)}
        onOpenChange={(o) => !o && setConfirming(null)}
        title={confirming?.confirm?.title}
        description={confirming?.confirm?.description}
        confirmLabel={confirming?.confirm?.confirmLabel}
        destructive={confirming?.destructive}
        pending={pending}
        onConfirm={() => confirming && execute(confirming)}
      />
    </>
  );
}

/**
 * The "trash" part of a row menu, the same for customers, products, suppliers and employees:
 * archive (with a confirmation) or restore, and — for super admins, in the trash — delete for good.
 */
export function archiveMenuItems({
  name,
  archived,
  archive,
  restore,
  archiveDescription,
  remove,
}: {
  name: string;
  archived: boolean;
  archive: () => Result;
  restore: () => Result;
  archiveDescription?: string;
  /** Present only when the user may delete and the row is in the trash. */
  remove?: { run: () => Result; description: string };
}): RowMenuItem[] {
  const items: RowMenuItem[] = [
    archived
      ? { type: "action", label: "აღდგენა", icon: <ArchiveRestore />, run: restore }
      : {
          type: "action",
          label: "სანაგვეში გადატანა",
          icon: <Archive />,
          run: archive,
          confirm: { title: `${name} — სანაგვეში გადატანა?`, description: archiveDescription, confirmLabel: "გადატანა" },
        },
  ];
  if (archived && remove) {
    items.push({
      type: "action",
      label: "სამუდამოდ წაშლა",
      icon: <Trash2 />,
      destructive: true,
      run: remove.run,
      confirm: { title: `${name} — სამუდამოდ წაშლა?`, description: remove.description, confirmLabel: "წაშლა" },
    });
  }
  return items;
}
