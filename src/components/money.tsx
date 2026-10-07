import { dec, formatAmount, formatMoney, type Numeric } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Money amount, tabular and never wrapped.
 * tone="debt": positive = owed to us (amber), negative = customer credit (green).
 * tone="signed": positive green, negative red.
 */
export function Money({
  value,
  tone = "plain",
  currency = false,
  className,
}: {
  value: Numeric | null | undefined;
  tone?: "plain" | "debt" | "signed" | "muted-zero";
  currency?: boolean;
  className?: string;
}) {
  const d = dec(value);
  const color =
    tone === "debt"
      ? d.gt(0)
        ? "text-warning dark:text-warning"
        : d.lt(0)
          ? "text-success"
          : "text-muted-foreground"
      : tone === "signed"
        ? d.gt(0)
          ? "text-success"
          : d.lt(0)
            ? "text-destructive"
            : "text-muted-foreground"
        : tone === "muted-zero" && d.isZero()
          ? "text-muted-foreground/60"
          : "";
  return (
    <span className={cn("whitespace-nowrap tabular-nums", color, className)}>
      {currency ? formatMoney(d) : formatAmount(d)}
    </span>
  );
}
