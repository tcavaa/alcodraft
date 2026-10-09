"use client";

import { ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createCountAction } from "@/features/sales/actions";
import { useRequestId } from "@/hooks/use-request-id";
import { useServerAction } from "@/hooks/use-server-action";
import { gridCell, parseQty } from "@/lib/grid-nav";
import { dec, formatQty, sum } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface CountProduct {
  productId: number;
  name: string;
  /** Last price the customer was charged. */
  lastPrice: string;
  delivered: number;
  /** Leftover of the previous count. */
  leftover: number;
  isActive: boolean;
}

/**
 * „განაშთვა“: every product the customer has been delivered, with its price and Σ delivered;
 * the user types only what is left on the shelf. Empty = not counted (saved as no leftover).
 */
export function CountForm({
  storeId,
  customerId,
  products,
}: {
  storeId: number;
  customerId: number;
  products: CountProduct[];
}) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [comment, setComment] = useState("");
  const requestId = useRequestId();
  const { run, pending, errors, setErrors } = useServerAction();

  const qty = (p: CountProduct) => parseQty(values[p.productId]);
  const filled = products.filter((p) => (values[p.productId] ?? "").trim() !== "");
  const invalid = filled.find((p) => {
    const n = qty(p);
    return n === null || n < 0;
  });
  const totalQty = filled.reduce((a, p) => a + Math.max(qty(p) ?? 0, 0), 0);
  const totalValue = sum(filled.map((p) => dec(p.lastPrice).times(Math.max(qty(p) ?? 0, 0))));
  const dirty = filled.length > 0 || comment !== "";

  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const save = () => {
    if (invalid) {
      setErrors({ _form: `შეასწორეთ ნაშთი: ${invalid.name}` });
      toast.error("შეასწორეთ შეცდომები");
      return;
    }
    if (filled.length === 0) {
      setErrors({ _form: "შეიყვანეთ ნაშთი მინიმუმ ერთ პროდუქტზე (ცარიელ თაროზე — 0)." });
      return;
    }
    run(() =>
      createCountAction(storeId, {
        requestId: requestId.current(),
        customerId,
        lines: filled.map((p) => ({ productId: p.productId, unitPrice: p.lastPrice, leftoverQty: values[p.productId].trim() })),
        comment,
      }),
    );
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 shadow-[0_1px_0_var(--border)]">
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">დასახელება</th>
              <th className="w-24 px-3 py-2.5 text-right font-medium">ფასი</th>
              <th className="w-24 px-3 py-2.5 text-right font-medium">შეტანილი</th>
              <th className="w-28 px-3 py-2.5 text-right font-medium">ნაშთი</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, row) => {
              const raw = values[p.productId] ?? "";
              const n = qty(p);
              return (
                <tr
                  key={p.productId}
                  className={cn("border-b last:border-0", raw.trim() !== "" ? "bg-accent/50" : "hover:bg-muted/40", !p.isActive && "opacity-60")}
                >
                  <td className="px-3 py-1.5 font-medium">{p.name}</td>
                  <td className="px-3 py-1.5 text-right">
                    <Money value={p.lastPrice} />
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{formatQty(p.delivered)}</td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={raw}
                      onChange={(e) => setValues((v) => ({ ...v, [p.productId]: e.target.value }))}
                      {...gridCell("count", row, 0)}
                      inputMode="numeric"
                      placeholder="—"
                      aria-label={`${p.name} — ნაშთი`}
                      aria-invalid={n === null || (n ?? 0) < 0}
                      className="h-8 px-2 text-right tabular-nums placeholder:text-muted-foreground/40"
                    />
                    {p.leftover ? (
                      <div className="mt-0.5 text-right text-[0.7rem] text-muted-foreground tabular-nums">წინა: {formatQty(p.leftover)}</div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-5 rounded-xl border bg-card p-5 shadow-xs xl:sticky xl:top-20">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">ნაშთი</span>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{formatQty(totalQty)} ც.</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{filled.length} პროდუქტი დათვლილია</span>
            <span>
              ღირებულება: <Money value={totalValue} />
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">საწყობი, ვალი და სალარო არ იცვლება — ინახება მხოლოდ თაროზე დარჩენილი რაოდენობა.</p>
        <Field>
          <FieldLabel htmlFor="count-comment">კომენტარი</FieldLabel>
          <Textarea id="count-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="კომენტარის გარეშე" />
        </Field>
        {errors._form ? <p className="text-sm text-destructive">{errors._form}</p> : null}
        <Button size="lg" className="h-12 w-full text-base" onClick={save} disabled={pending}>
          {pending ? <Spinner /> : <ClipboardCheck />}
          განაშთვის შენახვა
        </Button>
      </div>
    </div>
  );
}
