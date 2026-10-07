import { Skeleton } from "@/components/ui/skeleton";

/** Default loading state for list pages (shown instantly while data streams in). */
export function PageSkeleton({ rows = 10, stats = 0 }: { rows?: number; stats?: number }) {
  return (
    <div className="animate-in fade-in-0 duration-300">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
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
