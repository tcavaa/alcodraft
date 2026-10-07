import { CheckCircle2, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/** One-line banner at the top of a page: "saved", "created from order", or a hint. */
export function Notice({
  tone = "success",
  children,
  className,
}: {
  tone?: "success" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      className={cn(
        "mb-5 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm print:hidden",
        tone === "success" ? "border-success/30 bg-success/10 text-success" : "border-gold/40 bg-accent/50",
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "info" && "text-gold-strong")} />
      <div>{children}</div>
    </div>
  );
}
