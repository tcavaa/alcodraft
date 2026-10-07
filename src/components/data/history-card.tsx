import { SortableHead } from "@/components/data/sortable-head";
import { Money } from "@/components/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { dec, type Numeric } from "@/lib/money";
import { type SearchParams, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";

/** One dated money record: a receipt, a payment, a wage accrual. */
export interface HistoryRow {
  id: number;
  date: string;
  /** Custom date cell (e.g. a link to the document). */
  dateCell?: React.ReactNode;
  amount: Numeric;
  comment: string;
}

const HISTORY_SORTS = ["date", "amount", "comment"] as const;

export function sortHistory(rows: HistoryRow[], sp: SearchParams, param: string): HistoryRow[] {
  return sortRows(rows, sortParam(sp, HISTORY_SORTS, param), {
    date: (r) => r.date,
    amount: (r) => dec(r.amount),
    comment: (r) => r.comment,
  });
}

/**
 * Date / amount / comment card of the supplier and employee pages. `narrow` hides the comment
 * column where the page shows three cards side by side.
 */
export function HistoryCard({
  title,
  description,
  param,
  rows,
  amountLabel,
  emptyText,
  narrow = false,
}: {
  title: string;
  description?: string;
  /** Sort query param of this table (two tables on one page need different ones). */
  param: string;
  rows: HistoryRow[];
  amountLabel: string;
  emptyText: string;
  narrow?: boolean;
}) {
  const commentClass = narrow ? "hidden pr-6 sm:table-cell xl:hidden 2xl:table-cell" : "pr-6";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-6 text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead param={param} column="date" first="desc" className="pl-6">
                  თარიღი
                </SortableHead>
                <SortableHead param={param} column="amount" className="text-right">
                  {amountLabel}
                </SortableHead>
                <SortableHead param={param} column="comment" className={commentClass}>
                  კომენტარი
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-6">{r.dateCell ?? formatDate(r.date)}</TableCell>
                  <TableCell className="text-right">
                    <Money value={r.amount} />
                  </TableCell>
                  <TableCell className={cn(commentClass, "text-muted-foreground")}>
                    <div className={cn("truncate", narrow ? "max-w-[12rem]" : "max-w-[14rem]")} title={r.comment || undefined}>
                      {r.comment}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
