"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A select bound to one query param (first option = default, removed from the URL). */
export function ParamSelect({
  param,
  options,
  value,
  className,
  label,
}: {
  param: string;
  options: { value: string; label: string }[];
  value: string;
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const onChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === options[0]?.value) params.delete(param);
    else params.set(param, next);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn("h-9 bg-card", pending && "opacity-70", className)} aria-label={label}>
        {/* Label and value stay together on the left; the trigger pushes only the chevron right. */}
        <span className="flex min-w-0 items-center gap-1.5">
          {label ? <span className="shrink-0 text-muted-foreground">{label}:</span> : null}
          <SelectValue className="truncate">{options.find((o) => o.value === value)?.label}</SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
