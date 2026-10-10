"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useRef, useState } from "react";

import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { CustomerOption } from "../queries";

export function CustomerPicker({
  customers,
  value,
  onChange,
  invalid,
}: {
  customers: CustomerOption[];
  value: number | null;
  onChange: (id: number) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = customers.find((c) => c.id === value) ?? null;

  const changeOpen = (next: boolean) => {
    // On a phone the keyboard takes the space under the field; bring the field to the top so the
    // list (always opened downwards) has room to show.
    if (next && window.matchMedia("(max-width: 767px)").matches) {
      triggerRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          className={cn(
            "h-auto min-h-11 w-full scroll-mt-20 justify-between bg-card px-3 py-2 text-left font-normal",
            invalid && "border-destructive",
          )}
        >
          {selected ? (
            <span className="min-w-0">
              <span className="block truncate font-medium">{selected.name}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[selected.address, selected.phone].filter(Boolean).join(" · ") || "—"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">აირჩიეთ ობიექტი…</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* Always below the field: flipping up (keyboard open on a phone) covered the page above it. */}
      <PopoverContent
        className="w-(--radix-popover-trigger-width) min-w-80 p-0"
        align="start"
        side="bottom"
        avoidCollisions={false}
      >
        <Command>
          <CommandInput placeholder="ძებნა: სახელი, მისამართი, ტელეფონი…" />
          <CommandList className="max-h-80">
            <CommandEmpty>ობიექტი ვერ მოიძებნა.</CommandEmpty>
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.name} ${c.address} ${c.phone} #${c.id}`}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <Check className={cn("size-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.name}</span>
                    {c.address ? <span className="block truncate text-xs text-muted-foreground">{c.address}</span> : null}
                  </span>
                  <Money value={c.debt} tone="debt" className="text-xs" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
