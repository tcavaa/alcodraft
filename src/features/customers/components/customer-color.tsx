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
import { CUSTOMER_COLOR_LABEL, CUSTOMER_COLORS, type CustomerColor } from "../colors";

const COLOR_DOT: Record<CustomerColor, string> = {
  red: "bg-rose-500 border-transparent",
  yellow: "bg-amber-400 border-transparent",
  green: "bg-emerald-500 border-transparent",
  blue: "bg-blue-500 border-transparent",
  black: "bg-neutral-900 border-neutral-900 dark:border-neutral-400",
  white: "bg-white border-neutral-400",
};

// White has no row tint: on a white card it would be invisible anyway, the dot marks it.
export const COLOR_ROW: Record<CustomerColor, string> = {
  red: "bg-rose-500/[0.07] hover:bg-rose-500/12",
  yellow: "bg-amber-400/[0.09] hover:bg-amber-400/15",
  green: "bg-emerald-500/[0.06] hover:bg-emerald-500/10",
  blue: "bg-blue-500/[0.06] hover:bg-blue-500/10",
  black: "bg-neutral-900/[0.06] hover:bg-neutral-900/10 dark:bg-white/[0.05] dark:hover:bg-white/10",
  white: "",
};

/** Old company/index colour select (row highlight), now a one-click menu. */
export function CustomerColorPicker({
  storeId,
  customerId,
  color,
}: {
  storeId: number;
  customerId: number;
  color: CustomerColor | null;
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
            optimistic ? COLOR_DOT[optimistic] : "border-muted-foreground/40 border-dashed",
          )}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuLabel className="text-xs text-muted-foreground">ფერი</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={optimistic ?? "none"} onValueChange={change}>
          {(["none", ...CUSTOMER_COLORS] as const).map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className="gap-2">
              <span
                className={cn("size-2.5 rounded-full border", c === "none" ? "border-dashed border-muted-foreground/50" : COLOR_DOT[c])}
              />
              {c === "none" ? "უფერო" : CUSTOMER_COLOR_LABEL[c]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
