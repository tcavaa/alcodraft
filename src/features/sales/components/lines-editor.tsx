"use client";

import { ListFilter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { dec, formatAmount, formatQty, parseAmount } from "@/lib/money";
import { cn } from "@/lib/utils";

import type { ProductOption } from "../queries";

export interface LineState {
  price: string;
  quantity: string;
  giftQty: string;
  leftoverQty: string;
}

export type LinesState = Record<number, LineState>;

const QTY_FIELDS = ["quantity", "giftQty", "leftoverQty"] as const;
type Field = "price" | (typeof QTY_FIELDS)[number];

export function parseQty(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return 0;
  return /^-?\d+$/.test(t) ? Number(t) : null;
}

export function lineHasValues(l: LineState | undefined): boolean {
  if (!l) return false;
  return QTY_FIELDS.some((f) => {
    const n = parseQty(l[f]);
    return n !== null && n !== 0;
  });
}

/** Unit price shown/charged for a line: entry mode applies the discount, final mode doesn't. */
export function unitPriceOf(l: LineState, factor: string, mode: "entry" | "final") {
  const price = parseAmount(l.price);
  if (!price) return null;
  return mode === "entry" ? price.times(dec(factor)).toDecimalPlaces(4) : price;
}

export function LinesEditor({
  products,
  lines,
  onChange,
  mode,
  discountFactor,
  stockMode,
}: {
  products: ProductOption[];
  lines: LinesState;
  onChange: (productId: number, field: Field, value: string) => void;
  /** entry = price before discount (new documents); final = unit price as charged (edits). */
  mode: "entry" | "final";
  discountFactor: string;
  /** block: quantity may not exceed stock (old add form); warn: highlight only; off: no stock column. */
  stockMode: "block" | "warn" | "off";
}) {
  const [query, setQuery] = useState("");
  const [onlyFilled, setOnlyFilled] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) => (!q || p.name.toLowerCase().includes(q)) && (!onlyFilled || lineHasValues(lines[p.id])),
    );
  }, [products, query, onlyFilled, lines]);

  const filledCount = useMemo(() => products.filter((p) => lineHasValues(lines[p.id])).length, [products, lines]);

  const moveFocus = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    const delta = e.key === "ArrowDown" || e.key === "Enter" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = document.querySelector<HTMLInputElement>(`[data-line-row="${row + delta}"][data-line-col="${col}"]`);
    next?.focus();
    next?.select();
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="h-9 bg-card sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ჩაწერე დასახელება…" />
          {query ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={() => setQuery("")} aria-label="გასუფთავება">
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListFilter className="size-4" />
          მხოლოდ შევსებული
          <Badge variant="secondary" className="tabular-nums">
            {filledCount}
          </Badge>
          <Switch checked={onlyFilled} onCheckedChange={setOnlyFilled} />
        </label>
      </div>

      <div className="max-h-[calc(100dvh-16rem)] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
            <tr className="text-xs text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">დასახელება</th>
              <th className="w-[4.75rem] px-1.5 py-2.5 text-right font-medium">{mode === "entry" ? "ფასი" : "ერთ. ფასი"}</th>
              {stockMode !== "off" ? <th className="w-14 px-1.5 py-2.5 text-right font-medium">მარაგი</th> : null}
              <th className="w-[4.25rem] px-1.5 py-2.5 text-right font-medium">შეტანილი</th>
              <th className="w-[4.25rem] px-1.5 py-2.5 text-right font-medium">საჩუქარი</th>
              <th className="w-[4.25rem] px-1.5 py-2.5 text-right font-medium">ნაშთი</th>
              <th className="w-24 px-3 py-2.5 text-right font-medium">ჯამი</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, rowIndex) => {
              const l = lines[p.id] ?? { price: "", quantity: "", giftQty: "", leftoverQty: "" };
              const qty = parseQty(l.quantity);
              const unit = unitPriceOf(l, discountFactor, mode);
              const total = unit && qty !== null ? unit.times(qty) : null;
              const filled = lineHasValues(l);
              const overStock = stockMode !== "off" && qty !== null && qty > 0 && qty > p.stockQty;
              const priceChanged = mode === "entry" && l.price !== "" && parseAmount(l.price)?.equals(p.salePrice) === false;
              return (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b transition-colors last:border-0",
                    filled ? "bg-accent/50" : "hover:bg-muted/40",
                    p.isArchived && "opacity-60",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <div className="font-medium">{p.name}</div>
                    {p.supplierName ? <div className="text-xs text-muted-foreground">{p.supplierName}</div> : null}
                  </td>
                    <td className="px-1.5 py-1.5">
                      <Input
                        value={l.price}
                        onChange={(e) => onChange(p.id, "price", e.target.value)}
                        onKeyDown={(e) => moveFocus(e, rowIndex, 0)}
                        onFocus={(e) => e.target.select()}
                        data-line-row={rowIndex}
                        data-line-col={0}
                        inputMode="decimal"
                        aria-label={`${p.name} — ფასი`}
                        aria-invalid={l.price !== "" && !parseAmount(l.price)}
                        className={cn("h-8 px-2 text-right tabular-nums", priceChanged && "border-warning text-warning")}
                      />
                      {mode === "entry" && unit && discountFactor !== "1" && filled ? (
                        <div className="mt-0.5 text-right text-[0.7rem] text-muted-foreground tabular-nums">
                          {formatAmount(unit)}
                        </div>
                      ) : null}
                    </td>
                  {stockMode !== "off" ? (
                    <td
                      className={cn(
                        "px-1.5 py-1.5 text-right tabular-nums",
                        p.stockQty <= 0 ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {formatQty(p.stockQty)}
                    </td>
                  ) : null}
                  {QTY_FIELDS.map((field, i) => (
                    <td key={field} className="px-1.5 py-1.5">
                      <Input
                        value={l[field]}
                        onChange={(e) => onChange(p.id, field, e.target.value)}
                        onKeyDown={(e) => moveFocus(e, rowIndex, i + 1)}
                        onFocus={(e) => e.target.select()}
                        data-line-row={rowIndex}
                        data-line-col={i + 1}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`${p.name} — ${field}`}
                        aria-invalid={parseQty(l[field]) === null || (field === "quantity" && overStock && stockMode === "block")}
                        className={cn(
                          "h-8 px-2 text-right tabular-nums placeholder:text-muted-foreground/40",
                          field === "quantity" && overStock && "border-destructive text-destructive",
                        )}
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {total && !total.isZero() ? formatAmount(total) : <span className="text-muted-foreground/40">—</span>}
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                  პროდუქტი ვერ მოიძებნა.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

