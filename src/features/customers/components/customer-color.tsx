"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { setCustomerColorAction } from "../actions";

export type CustomerColor = "green" | "yellow" | "red" | null;

const COLOR_DOT: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-400",
  red: "bg-rose-500",
};

export const COLOR_ROW: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-500/[0.06] hover:bg-emerald-500/10",
  yellow: "bg-amber-400/[0.09] hover:bg-amber-400/15",
  red: "bg-rose-500/[0.07] hover:bg-rose-500/12",
};

const LABELS = { none: "უფერო", green: "მწვანე", yellow: "ყვითელი", red: "წითელი" } as const;

/** Old company/index colour select (row highlight), now a one-click menu. */
export function CustomerColorPicker({
  storeId,
  customerId,
  color,
}: {
  storeId: number;
  customerId: number;
  color: CustomerColor;
}) {
  const [optimistic, setOptimistic] = useOptimistic(color);
  const [, startTransition] = useTransition();

  const change = (value: string) =>
    startTransition(async () => {
      const next = value === "none" ? null : (value as CustomerColor);
      setOptimistic(next);
      const result = await setCustomerColorAction(storeId, customerId, next);
      if (!result.ok) toast.error(result.error);
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-6 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="ფერის შეცვლა"
      >
        <span
          className={cn(
            "size-3 rounded-full border",
            optimistic ? `${COLOR_DOT[optimistic]} border-transparent` : "border-muted-foreground/40 border-dashed",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">ფერი</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={optimistic ?? "none"} onValueChange={change}>
          {(["none", "green", "yellow", "red"] as const).map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className="gap-2">
              <span
                className={cn("size-2.5 rounded-full", c === "none" ? "border border-dashed border-muted-foreground/50" : COLOR_DOT[c])}
              />
              {LABELS[c]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
