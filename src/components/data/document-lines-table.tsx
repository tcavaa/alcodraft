import { HeadRow, TableCard } from "@/components/data/table-card";
import { SortableHead } from "@/components/data/sortable-head";
import { Money } from "@/components/money";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { dec, formatQty, type Numeric } from "@/lib/money";
import { type SearchParams, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";

/** One product line of an operation / order (or a product's totals in a customer summary). */
export interface LineRow {
  key: number | string;
  name: string;
  /** Shown after the name, e.g. "(არქივი)". */
  nameExtra?: React.ReactNode;
  unitPrice: Numeric;
  /** Custom price cell (e.g. highlighted when it differs from the current price). */
  priceCell?: React.ReactNode;
  quantity: number;
  leftover: number;
  gift: number;
  total: Numeric;
}

const LINE_SORTS = ["name", "price", "quantity", "leftover", "remaining", "gift", "total"] as const;

/** Rows in the order the table header asks for (`?sort=…`, or `param` for a second table). */
export function sortLineRows(rows: LineRow[], sp: SearchParams, param = "sort"): LineRow[] {
  return sortRows(rows, sortParam(sp, LINE_SORTS, param), {
    name: (r) => r.name,
    price: (r) => dec(r.unitPrice),
    quantity: (r) => r.quantity,
    leftover: (r) => r.leftover,
    remaining: (r) => r.quantity - r.leftover,
    gift: (r) => r.gift,
    total: (r) => dec(r.total),
  });
}

/**
 * Old view tables: price, delivered („შეტანილი“), leftover („ნაშთი“), delivered − leftover
 * („დარჩენილი“), gift and line total, with column sums. `total` is the document's own total
 * (it can differ from Σ lines on imported documents).
 */
export function DocumentLinesTable({
  rows,
  total,
  param = "sort",
  priceLabel = "ფასი",
  empty,
}: {
  rows: LineRow[];
  total: Numeric;
  param?: string;
  priceLabel?: string;
  empty?: React.ReactNode;
}) {
  const sumOf = (pick: (r: LineRow) => number) => formatQty(rows.reduce((a, r) => a + pick(r), 0));
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <HeadRow>
            <SortableHead param={param} column="name">
              დასახელება
            </SortableHead>
            <SortableHead param={param} column="price" className="text-right">
              {priceLabel}
            </SortableHead>
            <SortableHead param={param} column="quantity" className="text-right">
              შეტანილი
            </SortableHead>
            <SortableHead param={param} column="leftover" className="text-right">
              ნაშთი
            </SortableHead>
            <SortableHead param={param} column="remaining" className="text-right">
              დარჩენილი
            </SortableHead>
            <SortableHead param={param} column="gift" className="text-right">
              საჩუქარი
            </SortableHead>
            <SortableHead param={param} column="total" className="text-right">
              ფასი ჯამში
            </SortableHead>
          </HeadRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                {empty ?? "პროდუქცია არ არის."}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">
                  {r.name}
                  {r.nameExtra}
                </TableCell>
                <TableCell className="text-right">{r.priceCell ?? <Money value={r.unitPrice} />}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQty(r.quantity)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQty(r.leftover)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQty(r.quantity - r.leftover)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.gift ? formatQty(r.gift) : "—"}</TableCell>
                <TableCell className="text-right font-medium">
                  <Money value={r.total} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
        {rows.length ? (
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={2}>ჯამში</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sumOf((r) => r.quantity)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sumOf((r) => r.leftover)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sumOf((r) => r.quantity - r.leftover)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sumOf((r) => r.gift)}</TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={total} currency />
              </TableCell>
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </TableCard>
  );
}
