import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** The bordered card every list table sits in. */
export function TableCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>{children}</div>;
}

/** Header row of a list table (tinted, no hover). */
export function HeadRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <TableRow className={cn("bg-muted/40 hover:bg-muted/40", className)}>{children}</TableRow>;
}
