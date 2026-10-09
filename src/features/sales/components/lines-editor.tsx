"use client";

import { ListFilter, Search, X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { gridCell, parseQty } from "@/lib/grid-nav";
import { type Decimal, dec, formatAmount, formatQty, parseAmount } from "@/lib/money";
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
export type LineField = "price" | (typeof QTY_FIELDS)[number];

const FIELD_LABEL: Record<LineField, string> = {
  price: "ფასი",
  quantity: "შეტანილი",
  giftQty: "საჩუქარი",
  leftoverQty: "ნაშთი",
};

export function lineHasValues(l: LineState | undefined): boolean {
  if (!l) return false;
  return QTY_FIELDS.some((f) => {
    const n = parseQty(l[f]);
    return n !== null && n !== 0;
  });
}

/** The first product whose line can't be saved (bad number, negative gift/leftover, missing price). */
export function firstInvalidLine(products: ProductOption[], lineOf: (p: ProductOption) => LineState) {
  return products.find((p) => {
    const l = lineOf(p);
    return (
      QTY_FIELDS.some((f) => parseQty(l[f]) === null) ||
      (parseQty(l.giftQty) ?? 0) < 0 ||
      (parseQty(l.leftoverQty) ?? 0) < 0 ||
      (lineHasValues(l) && !parseAmount(l.price))
    );
  });
}

/** Unit price shown/charged for a line: entry mode applies the discount, final mode doesn't. */
function unitPriceOf(l: LineState, factor: string, mode: "entry" | "final") {
  const price = parseAmount(l.price);
  if (!price) return null;
  return mode === "entry" ? price.times(dec(factor)).toDecimalPlaces(4) : price;
}

/**
 * Line state per product with a fallback for products the state doesn't know yet: the product
 * list can grow while a form is kept alive (Next keeps recent pages mounted), and a missing line
 * must not crash the form.
 */
export function useDocumentLines(products: ProductOption[], initial: (p: ProductOption) => LineState) {
  const [lines, setLines] = useState<LinesState>(() => Object.fromEntries(products.map((p) => [p.id, initial(p)])));
  const lineOf = (p: ProductOption): LineState => lines[p.id] ?? initial(p);
  const setField = (product: ProductOption, field: LineField, value: string) =>
    setLines((prev) => ({ ...prev, [product.id]: { ...(prev[product.id] ?? initial(product)), [field]: value } }));
  /** Changes every line at once (e.g. all prices when an open order's discount changes). */
  const mapLines = (fn: (line: LineState) => LineState) =>
    setLines((prev) => Object.fromEntries(products.map((p) => [p.id, fn(prev[p.id] ?? initial(p))])));
  return { lineOf, setField, mapLines };
}

export function LinesEditor({
  products,
  lineOf,
  onChange,
  mode,
  discountFactor,
  stockMode,
  savedTotals,
  leftover = true,
}: {
  products: ProductOption[];
  lineOf: (p: ProductOption) => LineState;
  onChange: (product: ProductOption, field: LineField, value: string) => void;
  /** entry = price before discount (new documents); final = unit price as charged (edits). */
  mode: "entry" | "final";
  discountFactor: string;
  /** block: quantity may not exceed stock (old add form); warn: highlight only; off: no stock column. */
  stockMode: "block" | "warn" | "off";
  /** Edits: line totals as saved for products not changed yet (they are kept exactly). */
  savedTotals?: Map<number, Decimal>;
  /** „ნაშთი“ column; a new operation leaves it out (leftovers are counted with „განაშთვა“). */
  leftover?: boolean;
}) {
  const qtyFields = leftover ? QTY_FIELDS : QTY_FIELDS.filter((f) => f !== "leftoverQty");
  const [query, setQuery] = useState("");
  // "Only filled": rows filled when it was switched on stay visible while being edited.
  const [shown, setShown] = useState<Set<number> | null>(null);

  const q = query.trim().toLowerCase();
  const visible = products.filter(
    (p) => (!q || p.name.toLowerCase().includes(q)) && (!shown || shown.has(p.id) || lineHasValues(lineOf(p))),
  );

  const filledCount = products.filter((p) => lineHasValues(lineOf(p))).length;
  const toggleOnlyFilled = (on: boolean) =>
    setShown(on ? new Set(products.filter((p) => lineHasValues(lineOf(p))).map((p) => p.id)) : null);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
        <InputGroup className="h-9 bg-card sm:max-w-xs">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ჩაწერე დასახელება…"
            aria-label="პროდუქტის ძებნა"
          />
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
            {formatQty(filledCount)}
          </Badge>
          <Switch checked={shown !== null} onCheckedChange={toggleOnlyFilled} />
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
              {leftover ? <th className="w-[4.25rem] px-1.5 py-2.5 text-right font-medium">ნაშთი</th> : null}
              <th className="w-24 px-3 py-2.5 text-right font-medium">ჯამი</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, rowIndex) => {
              const l = lineOf(p);
              const qty = parseQty(l.quantity);
              const unit = unitPriceOf(l, discountFactor, mode);
              const total = savedTotals?.get(p.id) ?? (unit && qty !== null ? unit.times(qty) : null);
              const filled = lineHasValues(l);
              const overStock = stockMode !== "off" && qty !== null && qty > 0 && qty > p.stockQty;
              const priceChanged = mode === "entry" && l.price !== "" && parseAmount(l.price)?.equals(p.salePrice) === false;
              return (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b transition-colors last:border-0",
                    filled ? "bg-accent/50" : "hover:bg-muted/40",
                    (p.isArchived || !p.isActive) && "opacity-60",
                  )}
                >
                  <td className="px-3 py-1.5">
                    <div className="font-medium">{p.name}</div>
                    {p.supplierName ? <div className="text-xs text-muted-foreground">{p.supplierName}</div> : null}
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      value={l.price}
                      onChange={(e) => onChange(p, "price", e.target.value)}
                      {...gridCell("lines", rowIndex, 0)}
                      inputMode="decimal"
                      aria-label={`${p.name} — ${FIELD_LABEL.price}`}
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
                  {qtyFields.map((field, i) => (
                    <td key={field} className="px-1.5 py-1.5">
                      <Input
                        value={l[field]}
                        onChange={(e) => onChange(p, field, e.target.value)}
                        {...gridCell("lines", rowIndex, i + 1)}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`${p.name} — ${FIELD_LABEL[field]}`}
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
                <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
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
