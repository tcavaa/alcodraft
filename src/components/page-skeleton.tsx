import { Skeleton } from "@/components/ui/skeleton";

/*
 * Loading states. Every page folder has a `loading.tsx` that renders one of these, so a click
 * between sibling pages swaps to the skeleton at once (instant navigation) while data streams in.
 */

function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      {action ? <Skeleton className="h-9 w-36" /> : null}
    </div>
  );
}

/** List pages: header, optional stat cards, a table. */
export function PageSkeleton({ rows = 10, stats = 0 }: { rows?: number; stats?: number }) {
  return (
    <div className="animate-in fade-in-0 duration-300">
      <HeaderSkeleton />
      {stats ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-[106px] rounded-xl" />
          ))}
        </div>
      ) : null}
      <div className="rounded-xl border bg-card">
        <div className="flex gap-3 border-b p-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-40" />
        </div>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Detail pages: header, a few figures, then the document / history table. */
export function DetailSkeleton() {
  return <PageSkeleton stats={3} rows={6} />;
}

/** Create / edit forms. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="animate-in fade-in-0 duration-300">
      <HeaderSkeleton action={false} />
      <div className="max-w-2xl space-y-5 rounded-xl border bg-card p-6">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
