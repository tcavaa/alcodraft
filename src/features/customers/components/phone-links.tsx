"use client";

import { Copy, Phone, PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { type CustomerPhone, formatPhone, telHref } from "../phones";

/** A customer's numbers; clicking one opens „დარეკვა“ (tel: link) and „კოპირება“. */
export function PhoneLinks({
  phones,
  rest,
  className,
  compact,
  empty = null,
}: {
  phones: CustomerPhone[];
  /** Old free text that isn't a number, shown as is. */
  rest?: string;
  className?: string;
  /** List rows: smaller, no icon, laid out by the parent (a wrapping flex row). */
  compact?: boolean;
  /** Shown when there is nothing to show. */
  empty?: React.ReactNode;
}) {
  if (phones.length === 0 && !rest) return empty;
  return (
    // Compact: the numbers become items of the parent's wrapping flex row (customer list).
    <span className={cn(compact ? "contents" : "inline-flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {phones.map((p, i) => (
        <PhoneLink key={i} phone={p} compact={compact} />
      ))}
      {rest ? (
        <span className="inline-flex items-center gap-1">
          {compact ? null : <Phone className="size-3.5 shrink-0" />}
          {rest}
        </span>
      ) : null}
    </span>
  );
}

function PhoneLink({ phone, compact }: { phone: CustomerPhone; compact?: boolean }) {
  if (!phone.number) {
    return <span className="inline-flex items-center gap-1">{phone.name}</span>;
  }
  const number = formatPhone(phone.number);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 rounded-sm text-left underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2",
            compact ? "text-xs" : "",
          )}
        >
          {compact ? null : <Phone className="size-3.5 shrink-0" />}
          <span className="tabular-nums whitespace-nowrap">{number}</span>
          {phone.name ? <span className="text-muted-foreground">({phone.name})</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <div>
          <div className="font-medium tabular-nums">{number}</div>
          {phone.name ? <div className="text-sm text-muted-foreground">{phone.name}</div> : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="sm">
            <a href={telHref(phone.number)}>
              <PhoneCall />
              დარეკვა
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(`+995${phone.number}`)
                .then(() => toast.success("ნომერი დაკოპირდა"))
                .catch(() => toast.error("ვერ დაკოპირდა"))
            }
          >
            <Copy />
            კოპირება
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
