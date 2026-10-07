import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { formatQty } from "@/lib/money";
import { hrefWith, type SearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

/** Server-rendered pager: every page is a plain link, so back/forward and sharing work. */
export function Pagination({
  page,
  pageSize,
  total,
  pathname,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  pathname: string;
  searchParams: SearchParams;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const href = (p: number) => hrefWith(pathname, searchParams, { page: p === 1 ? null : p });

  const numbers = new Set<number>([1, pages, page - 1, page, page + 1]);
  const list = [...numbers].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  return (
    <nav className="mt-4 flex flex-col items-center justify-between gap-3 text-sm sm:flex-row" aria-label="გვერდები">
      <p className="text-muted-foreground">
        {formatQty(from)}–{formatQty(to)} / {formatQty(total)}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink href={href(page - 1)} disabled={page <= 1} label="წინა">
            <ChevronLeft className="size-4" />
          </PageLink>
          {list.map((n, i) => (
            <span key={n} className="flex items-center gap-1">
              {i > 0 && n - list[i - 1] > 1 ? <span className="px-1 text-muted-foreground">…</span> : null}
              <PageLink href={href(n)} active={n === page} label={`გვერდი ${n}`}>
                {n}
              </PageLink>
            </span>
          ))}
          <PageLink href={href(page + 1)} disabled={page >= pages} label="შემდეგი">
            <ChevronRight className="size-4" />
          </PageLink>
        </div>
      ) : null}
    </nav>
  );
}

function PageLink({
  href,
  children,
  active,
  disabled,
  label,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  label: string;
}) {
  const cls = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 tabular-nums transition-colors",
    active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
    disabled && "pointer-events-none opacity-40",
  );
  if (disabled) {
    return (
      <span className={cls} aria-disabled aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={cls} aria-label={label} aria-current={active ? "page" : undefined} scroll={false}>
      {children}
    </Link>
  );
}
