"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface ComboOption {
  value: string;
  label: string;
  /** Second line in the list (address, store…). */
  hint?: string;
  /** Shown dimmed, e.g. archived customers. */
  muted?: boolean;
}

/** A searchable select bound to one query param — for long lists such as customers. */
export function ParamCombobox({
  param,
  options,
  value,
  label,
  allLabel = "ყველა",
  placeholder = "ძებნა…",
  emptyText = "ვერ მოიძებნა.",
  className,
}: {
  param: string;
  options: ComboOption[];
  /** Current value from the URL; undefined = all. */
  value: string | undefined;
  label: string;
  allLabel?: string;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const selected = value ? options.find((o) => o.value === value) : undefined;

  const apply = (next: string | undefined) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(param, next);
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={label}
            className={cn(
              "h-9 w-full justify-start gap-1.5 bg-card px-3 font-normal shadow-none",
              selected && "pr-14",
              pending && "opacity-70",
            )}
          >
            <span className="shrink-0 text-muted-foreground">{label}:</span>
            <span className={cn("truncate", !selected && "text-foreground")}>{selected?.label ?? allLabel}</span>
            <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="end">
          <Command>
            <CommandInput placeholder={placeholder} />
            <CommandList className="max-h-80">
              <CommandEmpty>{emptyText}</CommandEmpty>
              <CommandGroup>
                <CommandItem value={`__all__ ${allLabel}`} onSelect={() => apply(undefined)} className="gap-2">
                  <Check className={cn("size-4", !selected ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
                {options.map((o) => (
                  <CommandItem
                    key={o.value}
                    value={`${o.label} ${o.hint ?? ""} #${o.value}`}
                    onSelect={() => apply(o.value)}
                    className={cn("gap-2", o.muted && "text-muted-foreground")}
                  >
                    <Check className={cn("size-4 shrink-0", selected?.value === o.value ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{o.label}</span>
                      {o.hint ? <span className="block truncate text-xs text-muted-foreground">{o.hint}</span> : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected ? (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="ფილტრის მოხსნა"
          onClick={() => apply(undefined)}
          className="absolute top-1/2 right-8 -translate-y-1/2"
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}
