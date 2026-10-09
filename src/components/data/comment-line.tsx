import { cn } from "@/lib/utils";

/**
 * A row's comment as a small line under its main cell, for screens where the table's comment
 * column is hidden. Pass the breakpoint that shows the column, e.g. `className="lg:hidden"`.
 */
export function CommentLine({ comment, className }: { comment: string | null | undefined; className?: string }) {
  if (!comment) return null;
  return (
    <div className={cn("mt-0.5 line-clamp-2 min-w-44 max-w-64 text-xs whitespace-pre-line text-muted-foreground", className)} title={comment}>
      {comment}
    </div>
  );
}
