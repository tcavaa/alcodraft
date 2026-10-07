import Link from "next/link";

import { hrefWith, type SearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

/** Link-based segmented control (e.g. active / archived). */
export function FilterTabs({
  pathname,
  searchParams,
  param,
  options,
  value,
}: {
  pathname: string;
  searchParams: SearchParams;
  param: string;
  options: { value: string; label: string; count?: number | string }[];
  value: string;
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border bg-muted/60 p-0.5 text-sm">
      {options.map((o, i) => (
        <Link
          key={o.value}
          href={hrefWith(pathname, searchParams, { [param]: i === 0 ? null : o.value, page: null })}
          scroll={false}
          className={cn(
            "flex h-full items-center gap-1.5 rounded-md px-3 text-muted-foreground transition-colors hover:text-foreground",
            o.value === value && "bg-card font-medium text-foreground shadow-xs",
          )}
        >
          {o.label}
          {o.count !== undefined ? <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
