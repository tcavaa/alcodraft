import { cn } from "@/lib/utils";

/** Place in a ranking; the first three are gold. */
export function RankBadge({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold tabular-nums",
        rank <= 3 ? "bg-gold/20 text-gold-strong" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {rank}
    </span>
  );
}
