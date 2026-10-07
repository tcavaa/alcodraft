"use client";

import { ListFilter, PackagePlus, Search } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { dec, formatQty, parseAmount, sum } from "@/lib/money";
import { cn } from "@/lib/utils";

import { createReceiptAction } from "../actions";
import type { ReceiveProduct } from "../queries";

interface Line {
  cost: string;
  quantity: string;
}

const parseQty = (raw: string) => (raw.trim() === "" ? 0 : /^-?\d+$/.test(raw.trim()) ? Number(raw) : null);

/** Old drinks/stock: received quantity + purchase price per product of the supplier. */
export function ReceiptForm({
  storeId,
  supplier,
  products,
}: {
  storeId: number;
  supplier: { id: number; name: string; isReturns: boolean } | null;
  products: ReceiveProduct[];
}) {
  const [showAll, setShowAll] = useState(!supplier || supplier.isReturns);
  const [query, setQuery] = useState("");
  const [comment, setComment] = useState("");
  const [lines, setLines] = useState<Record<number, Line>>(() =>
    Object.fromEntries(products.map((p) => [p.id, { cost: dec(p.purchasePrice).toString(), quantity: "" }])),
  );
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) =>
        (showAll || p.supplierId === supplier?.id || (parseQty(lines[p.id].quantity) ?? 0) !== 0) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [products, showAll, supplier, query, lines]);

  const filled = products.filter((p) => (parseQty(lines[p.id].quantity) ?? 0) !== 0);
  const total = sum(filled.map((p) => (parseAmount(lines[p.id].cost) ?? dec(0)).times(parseQty(lines[p.id].quantity) ?? 0)));
  const invalid = products.some((p) => parseQty(lines[p.id].quantity) === null || (lines[p.id].cost !== "" && !parseAmount(lines[p.id].cost)));

  const set = (id: number, patch: Partial<Line>) => setLines((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const submit = () =>
    startTransition(async () => {
      if (invalid) {
        toast.error("შეასწორეთ არასწორი ველები");
        return;
      }
      if (filled.length === 0) {
        toast.error("შეიყვანეთ მიღებული რაოდენობა");
        return;
      }
      const result = await createReceiptAction(storeId, {
        supplierId: supplier?.id ?? null,
        lines: filled.map((p) => ({ productId: p.id, quantity: lines[p.id].quantity, unitCost: lines[p.id].cost })),
        comment,
      });
      if (result && !result.ok) toast.error(result.error);
    });

  const move = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const delta = e.key === "ArrowDown" || e.key === "Enter" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[data-r-row="${row + delta}"][data-r-col="${col}"]`);
    next?.focus();
    next?.select();
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
          <InputGroup className="h-9 bg-card sm:max-w-xs">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ჩაწერე დასახელება…" />
          </InputGroup>
          {supplier && !supplier.isReturns ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <ListFilter className="size-4" />
              ყველა პროდუქტი
              <Switch checked={showAll} onCheckedChange={setShowAll} />
            </label>
          ) : null}
        </div>
        <div className="max-h-[calc(100dvh-16rem)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
              <tr className="text-xs text-muted-foreground">
                <th className="px-3 py-2.5 text-left font-medium">დასახელება</th>
                <th className="w-24 px-2 py-2.5 text-right font-medium">რაოდენობა</th>
                <th className="w-32 px-2 py-2.5 text-right font-medium">შემოტანის ფასი</th>
                <th className="w-28 px-2 py-2.5 text-right font-medium">დამატება</th>
                <th className="w-28 px-3 py-2.5 text-right font-medium">დღის ბოლოს</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p, row) => {
                const qty = parseQty(lines[p.id].quantity);
                const costChanged = lines[p.id].cost !== "" && parseAmount(lines[p.id].cost)?.equals(p.purchasePrice) === false;
                return (
                  <tr key={p.id} className={cn("border-b last:border-0", qty ? "bg-accent/50" : "hover:bg-muted/40")}>
                    <td className="px-3 py-1.5 font-medium">{p.name}</td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{formatQty(p.stockQty)}</td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={lines[p.id].cost}
                        onChange={(e) => set(p.id, { cost: e.target.value })}
                        onKeyDown={(e) => move(e, row, 0)}
                        onFocus={(e) => e.target.select()}
                        data-r-row={row}
                        data-r-col={0}
                        inputMode="decimal"
                        className={cn("h-8 text-right tabular-nums", costChanged && "border-warning text-warning")}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={lines[p.id].quantity}
                        onChange={(e) => set(p.id, { quantity: e.target.value })}
                        onKeyDown={(e) => move(e, row, 1)}
                        onFocus={(e) => e.target.select()}
                        data-r-row={row}
                        data-r-col={1}
                        inputMode="numeric"
                        placeholder="0"
                        aria-invalid={qty === null}
                        className="h-8 text-right tabular-nums placeholder:text-muted-foreground/40"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                      {qty ? formatQty(p.stockQty + qty) : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    ამ მომწოდებელს პროდუქტი არ აქვს — ჩართეთ „ყველა პროდუქტი“.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-5 rounded-xl border bg-card p-5 shadow-xs xl:sticky xl:top-20">
        <div>
          <div className="text-sm text-muted-foreground">მიღების ღირებულება</div>
          <Money value={total} currency className="text-3xl font-semibold tracking-tight" />
          <div className="mt-1 text-xs text-muted-foreground">
            {filled.length} პროდუქტი · {formatQty(filled.reduce((a, p) => a + (parseQty(lines[p.id].quantity) ?? 0), 0))} ცალი
          </div>
        </div>
        <Field>
          <FieldLabel htmlFor="receipt-comment">კომენტარი</FieldLabel>
          <Textarea id="receipt-comment" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="მაგ.: ზედნადების №" />
        </Field>
        <p className="text-xs text-muted-foreground">
          {supplier ? `მომწოდებელი: ${supplier.name}. ` : ""}მიღების ღირებულება ემატება მომწოდებლის „სულ გადასახდელს“.
        </p>
        <Button size="lg" className="h-12 w-full text-base" onClick={submit} disabled={pending}>
          {pending ? <Spinner /> : <PackagePlus />}
          საწყობში მიღება
        </Button>
      </div>
    </div>
  );
}
