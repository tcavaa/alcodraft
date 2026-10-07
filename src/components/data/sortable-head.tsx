"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { TableHead } from "@/components/ui/table";
import { nextSort, parseSort, type SortDir, sortToParam } from "@/lib/sort";
import { cn } from "@/lib/utils";

/**
 * A table header that sorts by its column: click → first direction (↑ or ↓), again → the other,
 * a third time → the table's default order. State lives in the URL (`?sort=col` / `?sort=-col`).
 *
 * `first` defaults to descending for right-aligned (numeric) columns and ascending otherwise;
 * pass `first="desc"` for date columns so the newest comes first.
 */
export function SortableHead({
  column,
  children,
  param = "sort",
  first,
  className,
}: {
  column: string;
  children: React.ReactNode;
  /** Query param of this table (pages with two tables use e.g. "psort"). */
  param?: string;
  first?: SortDir;
  className?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const right = className?.includes("text-right") ?? false;
  const current = parseSort(searchParams.get(param), [column]);
  const next = nextSort(current, column, first ?? (right ? "desc" : "asc"));

  const params = new URLSearchParams(searchParams.toString());
  const value = sortToParam(next);
  if (value) params.set(param, value);
  else params.delete(param);
  params.delete("page"); // a new order starts from the first page
  const qs = params.toString();
  const dir = current?.dir ?? null;

  return (
    <TableHead
      className={className}
      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
    >
      <Link
        href={qs ? `${pathname}?${qs}` : pathname}
        replace
        scroll={false}
        prefetch={false}
        className={cn(
          "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          right && "flex-row-reverse",
          dir && "text-foreground",
        )}
      >
        <span>{children}</span>
        <SortIcon dir={dir} />
      </Link>
    </TableHead>
  );
}

/**
 * Only the sorted column shows an arrow (and a clicked one pulses while the page loads), so
 * unsorted headers keep their natural width — no reserved space, tables don't get wider.
 */
function SortIcon({ dir }: { dir: SortDir | null }) {
  const { pending } = useLinkStatus();
  if (!dir && !pending) return null;
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return <Icon aria-hidden className={cn("size-3.5 shrink-0 text-gold-strong", pending && "animate-pulse")} />;
}
