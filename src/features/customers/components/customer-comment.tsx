"use client";

import { CalendarPlus, MessageSquareText, Pencil } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";

import { setCustomerCommentAction } from "../actions";

/** "07-10-2026 - " — the old app stamped the date in front of every note. */
function datePrefix() {
  const [y, m, d] = todayIso().split("-");
  return `${d}-${m}-${y} - `;
}

/**
 * Old "კომენტარის ჩანიშვნა": an inline note per customer.
 * `variant="inline"` for list rows, `"card"` for the customer page.
 */
export function CustomerComment({
  storeId,
  customerId,
  comment,
  variant = "inline",
}: {
  storeId: number;
  customerId: number;
  comment: string;
  variant?: "inline" | "card";
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(comment);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  const save = () =>
    startTransition(async () => {
      const result = await setCustomerCommentAction(storeId, customerId, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("კომენტარი შენახულია");
      setOpen(false);
    });

  const stamp = () => {
    const next = datePrefix() + value;
    setValue(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(datePrefix().length, datePrefix().length);
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(comment);
      }}
    >
      <PopoverTrigger asChild>
        {variant === "inline" ? (
          <button
            type="button"
            className={cn(
              "group flex w-full max-w-md items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted",
              !comment && "text-muted-foreground/60",
            )}
          >
            <span className="line-clamp-2 flex-1 whitespace-pre-line">{comment || "კომენტარის დამატება"}</span>
            <Pencil className="mt-0.5 size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
          </button>
        ) : (
          <Button variant="outline" size="sm">
            <MessageSquareText />
            კომენტარის შეცვლა
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,90vw)]" align="start">
        <div className="space-y-3">
          <Textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            placeholder="კომენტარი…"
            className="resize-y"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={stamp}>
              <CalendarPlus />
              თარიღის ჩასმა
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                გაუქმება
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={pending}>
                {pending ? <Spinner /> : null}
                შენახვა
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
