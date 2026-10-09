"use client";

import { PackageMinus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog, ConfirmFigures } from "@/components/confirm-dialog";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { createReturnAction } from "@/features/sales/actions";
import { useRequestId } from "@/hooks/use-request-id";
import { useServerAction } from "@/hooks/use-server-action";
import { gridCell, parseQty } from "@/lib/grid-nav";
import { dec, formatQty, parseAmount, sum } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface ReturnProduct {
  productId: number;
  name: string;
  /** Last price the customer was charged — the default return price. */
  lastPrice: string;
  /** Σ delivered less earlier returns: the most that can come back. */
  delivered: number;
  isActive: boolean;
}

/**
 * „პროდუქციის გამოტანა“: only products the customer has been delivered. The price starts at the
 * one they were charged (editable); Σ price × quantity comes off the debt (not the cash book) and
 * the quantities go back into stock.
 */
export function ReturnForm({
  storeId,
  customerId,
  currentDebt,
  products,
}: {
  storeId: number;
  customerId: number;
  currentDebt: string;
  products: ReturnProduct[];
}) {
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(products.map((p) => [p.productId, dec(p.lastPrice).toString()])),
  );
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [comment, setComment] = useState("");
  const [confirming, setConfirming] = useState(false);
  const requestId = useRequestId();
  const { run, pending, errors, setErrors } = useServerAction();

  const qty = (p: ReturnProduct) => parseQty(quantities[p.productId]);
  const price = (p: ReturnProduct) => parseAmount(prices[p.productId] ?? "");
  const filled = products.filter((p) => (qty(p) ?? 0) !== 0 || (quantities[p.productId] ?? "").trim() !== "");
  const lines = filled.filter((p) => (qty(p) ?? 0) > 0);
  const lineTotal = (p: ReturnProduct) => (price(p) ?? dec(0)).times(Math.max(qty(p) ?? 0, 0));
  const total = sum(lines.map(lineTotal));
  const totalQty = lines.reduce((a, p) => a + (qty(p) ?? 0), 0);
  const debtAfter = dec(currentDebt).minus(total);
  const dirty = filled.length > 0 || comment !== "";

  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const validate = () => {
    const bad = filled.find((p) => {
      const n = qty(p);
      return n === null || n < 0 || (n > 0 && !price(p));
    });
    const tooMany = lines.find((p) => (qty(p) ?? 0) > p.delivered);
    const next: Record<string, string> = {};
    if (bad) next._form = `შეასწორეთ ველები: ${bad.name}`;
    else if (tooMany) next._form = `${tooMany.name}: გამოტანა აღემატება შეტანილს (${formatQty(tooMany.delivered)}).`;
    else if (lines.length === 0) next._form = "შეიყვანეთ გამოტანილი რაოდენობა მინიმუმ ერთ პროდუქტზე.";
    setErrors(next);
    if (next._form) toast.error(next._form);
    return !next._form;
  };

  const save = () =>
    run(
      () =>
        createReturnAction(storeId, {
          requestId: requestId.current(),
          customerId,
          lines: lines.map((p) => ({ productId: p.productId, unitPrice: prices[p.productId].trim(), quantity: String(qty(p)) })),
          comment,
        }),
      { onError: () => setConfirming(false) },
    );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 shadow-[0_1px_0_var(--border)]">
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">დასახელება</th>
              <th className="hidden w-24 px-3 py-2.5 text-right font-medium sm:table-cell">შეტანილი</th>
              <th className="w-28 px-1.5 py-2.5 text-right font-medium">ფასი</th>
              <th className="w-24 px-1.5 py-2.5 text-right font-medium">რაოდენობა</th>
              <th className="w-24 px-3 py-2.5 text-right font-medium">ჯამი</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, row) => {
              const n = qty(p);
              const active = (n ?? 0) > 0;
              return (
                <tr key={p.productId} className={cn("border-b last:border-0", active ? "bg-accent/50" : "hover:bg-muted/40", !p.isActive && "opacity-60")}>
                  <td className="px-3 py-1.5 font-medium">{p.name}</td>
                  <td className="hidden px-3 py-1.5 text-right text-muted-foreground tabular-nums sm:table-cell">{formatQty(p.delivered)}</td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      value={prices[p.productId] ?? ""}
                      onChange={(e) => setPrices((v) => ({ ...v, [p.productId]: e.target.value }))}
                      {...gridCell("return", row, 0)}
                      inputMode="decimal"
                      aria-label={`${p.name} — ფასი`}
                      aria-invalid={active && !price(p)}
                      className="h-8 px-2 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      value={quantities[p.productId] ?? ""}
                      onChange={(e) => setQuantities((v) => ({ ...v, [p.productId]: e.target.value }))}
                      {...gridCell("return", row, 1)}
                      inputMode="numeric"
                      placeholder="0"
                      aria-label={`${p.name} — რაოდენობა`}
                      aria-invalid={n === null || (n ?? 0) < 0 || (n ?? 0) > p.delivered}
                      className={cn(
                        "h-8 px-2 text-right tabular-nums placeholder:text-muted-foreground/40",
                        (n ?? 0) > p.delivered && "border-destructive text-destructive",
                      )}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {active && price(p) ? <Money value={lineTotal(p)} /> : <span className="text-muted-foreground/40">—</span>}
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
            <span className="text-sm text-muted-foreground">გამოტანა</span>
            <Money value={total} currency className="text-3xl font-semibold tracking-tight" />
          </div>
          <div className="text-xs text-muted-foreground">
            {lines.length} პროდუქტი · {formatQty(totalQty)} ცალი
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          ჯამი ჩამოაკლდება ობიექტის ვალს (სალაროში არ ჩაიწერება); რაოდენობა შევა საწყობში — მიღების ისტორიაში ჩანს როგორც „მაღაზიიდან გამოტანა“.
        </p>
        <Field>
          <FieldLabel htmlFor="return-comment">კომენტარი</FieldLabel>
          <Textarea id="return-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="კომენტარის გარეშე" />
        </Field>
        <div className="space-y-1.5 rounded-lg bg-muted/60 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">მიმდინარე ვალი</span>
            <Money value={currentDebt} tone="debt" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">− გამოტანა</span>
            <Money value={total} />
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>დარჩენილი</span>
            <Money value={debtAfter} currency tone="debt" />
          </div>
        </div>
        {errors._form ? <p className="text-sm text-destructive">{errors._form}</p> : null}
        <Button size="lg" className="h-12 w-full text-base" onClick={() => validate() && setConfirming(true)} disabled={pending}>
          {pending ? <Spinner /> : <PackageMinus />}
          გამოტანის შენახვა
        </Button>
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={(o) => !o && setConfirming(false)}
        title="პროდუქციის გამოტანა?"
        description={
          <>
            <ConfirmFigures
              rows={[
                { label: "საწყობში შევა", value: `${formatQty(totalQty)} ცალი` },
                { label: "ვალი შემცირდება", value: <Money value={total} currency /> },
                { label: "დარჩენილი ვალი", value: <Money value={debtAfter} currency tone="debt" />, strong: true },
              ]}
            />
            <p className="text-xs">სალარო არ იცვლება.</p>
          </>
        }
        confirmLabel="გამოტანა"
        cancelLabel="უკან"
        pending={pending}
        onConfirm={save}
      />
    </div>
  );
}
