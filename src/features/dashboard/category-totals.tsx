import Link from "next/link";

import { Money } from "@/components/money";
import { formatQty } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { categoryTotals } from "../products/categories";

/**
 * Sold units and money per product category, then „სულ“. With `hrefFor` each tile links to the
 * list filtered to it and `active` marks the current filter.
 */
export function CategoryTotals({
  totals,
  hrefFor,
  active,
  compact,
}: {
  totals: ReturnType<typeof categoryTotals>;
  hrefFor?: (key: string | null) => string;
  active?: string | null;
  compact?: boolean;
}) {
  const tiles = [
    ...totals.groups.map((g) => ({ key: g.key as string | null, label: g.label, quantity: g.quantity, total: g.total })),
    { key: null, label: "სულ", quantity: totals.quantity, total: totals.total },
  ];
  return (
    <div className={cn("grid gap-2", tiles.length <= 3 ? "grid-cols-3" : compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
      {tiles.map((t) => {
        const isTotal = t.key === null;
        const body = (
          <>
            <div className="truncate text-xs text-muted-foreground">{t.label}</div>
            <div className={cn("font-semibold tabular-nums", compact ? "text-sm" : "text-lg")}>{formatQty(t.quantity)} ც.</div>
            <Money value={t.total} currency className="block truncate text-xs text-muted-foreground" />
          </>
        );
        const className = cn(
          "min-w-0 rounded-lg border px-3 py-2",
          isTotal ? "border-gold/40 bg-accent/50" : "bg-card",
          hrefFor && "transition-colors hover:bg-muted",
          hrefFor && (active ?? null) === t.key && "ring-2 ring-gold/60",
        );
        return hrefFor ? (
          <Link key={t.key ?? "all"} href={hrefFor(t.key)} scroll={false} className={className}>
            {body}
          </Link>
        ) : (
          <div key={t.key ?? "all"} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
