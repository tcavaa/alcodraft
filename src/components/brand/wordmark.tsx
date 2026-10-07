import { cn } from "@/lib/utils";

/** "AlcoDraft" set in the display serif, echoing the brand mark. */
export function Wordmark({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn("font-display font-semibold tracking-[0.02em] select-none", className)}>
      <span className={onDark ? "text-sidebar-primary" : "text-gold-strong"}>Alco</span>
      <span className={onDark ? "text-sidebar-foreground" : "text-foreground"}>Draft</span>
    </span>
  );
}
