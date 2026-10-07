"use client";

import { CalendarRange, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** `?from=YYYY-MM-DD&to=YYYY-MM-DD` with quick presets. */
export function DateRangeFilter({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const apply = (next: { from?: string; to?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["from", "to"] as const) {
      const value = key in next ? next[key] : params.get(key);
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    // Two groups so a narrow toolbar wraps between them, never inside the date pair.
    <div className={cn("flex flex-wrap items-center gap-1.5", pending && "opacity-70", className)}>
      <div className="flex items-center gap-1.5">
        <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
        <DateField label="დან" value={from} max={to || undefined} onChange={(v) => apply({ from: v })} />
        <span className="text-muted-foreground">—</span>
        <DateField label="მდე" value={to} min={from || undefined} onChange={(v) => apply({ to: v })} />
      </div>
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={() => apply({ from: todayIso(), to: todayIso() })}>
          დღეს
        </Button>
        <Button variant="ghost" size="sm" onClick={() => apply({ from: `${todayIso().slice(0, 7)}-01`, to: todayIso() })}>
          ეს თვე
        </Button>
        {from || to ? (
          <Button variant="ghost" size="icon-sm" onClick={() => apply({ from: "", to: "" })} aria-label="გასუფთავება">
            <X />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Native date input. While empty and not focused it shows its label instead of the browser's
 * placeholder — Safari draws today's date there in grey, which reads like an active filter.
 */
function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
}) {
  const empty = value === "";
  return (
    <div className="relative">
      <Input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="peer h-9 w-[9.5rem] bg-card"
        aria-label={label}
      />
      {/* An opaque cover, not CSS on the date's inner parts: Safari ignores those. Clicks go through. */}
      {empty ? (
        <span className="pointer-events-none absolute inset-px flex items-center rounded-[calc(var(--radius-lg)-1px)] bg-card px-2.5 text-sm text-muted-foreground peer-focus:hidden">
          {label}
        </span>
      ) : null}
    </div>
  );
}
