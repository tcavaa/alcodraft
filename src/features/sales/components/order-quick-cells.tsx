"use client";

import { Check, CloudUpload, Pencil } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { setOrderQuickAction } from "../actions";

/** Old "სტატუსი" select (ასატვირთი / ატვირთული) as a one-click toggle. */
export function UploadStatusToggle({
  storeId,
  orderId,
  status,
}: {
  storeId: number;
  orderId: number;
  status: "pending" | "uploaded" | null;
}) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [, startTransition] = useTransition();
  const uploaded = optimistic === "uploaded";

  const toggle = () =>
    startTransition(async () => {
      const next = uploaded ? "pending" : "uploaded";
      setOptimistic(next);
      const result = await setOrderQuickAction(storeId, orderId, { uploadStatus: next });
      if (!result.ok) toast.error(result.error);
    });

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap transition-colors",
        uploaded
          ? "border-success/30 bg-success/10 text-success hover:bg-success/15"
          : "border-warning/40 bg-warning/10 text-warning hover:bg-warning/20",
      )}
      title="დააწკაპუნეთ სტატუსის შესაცვლელად"
    >
      {uploaded ? <Check className="size-3" /> : <CloudUpload className="size-3" />}
      {uploaded ? "ატვირთული" : "ასატვირთი"}
    </button>
  );
}

/** Old "კომენტარის ჩანიშვნა" on order rows. */
export function OrderCommentCell({ storeId, orderId, comment }: { storeId: number; orderId: number; comment: string }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(comment);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const result = await setOrderQuickAction(storeId, orderId, { comment: value });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
    });

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValue(comment);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group relative flex w-full max-w-sm items-start rounded-md px-1.5 py-1 text-left text-sm hover:bg-muted",
            !comment && "text-muted-foreground/60",
          )}
        >
          <span className="line-clamp-2 flex-1 whitespace-pre-line">{comment || "კომენტარი"}</span>
          {/* Overlays on hover instead of reserving width in a tight table. */}
          <Pencil className="absolute top-1.5 right-1 size-3.5 rounded-sm bg-muted opacity-0 group-hover:opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,90vw)]" align="start">
        <div className="space-y-3">
          <Textarea value={value} onChange={(e) => setValue(e.target.value)} rows={4} autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              გაუქმება
            </Button>
            <Button size="sm" onClick={save} disabled={pending}>
              {pending ? <Spinner /> : null}
              შენახვა
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
