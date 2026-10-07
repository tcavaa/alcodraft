import Link from "next/link";

import { SortableHead } from "@/components/data/sortable-head";
import { Money } from "@/components/money";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { cn } from "@/lib/utils";

import { ORDER_STATUS_LABEL } from "../labels";
import { OrderCommentCell, UploadStatusToggle } from "./order-quick-cells";

export interface OrderRow {
  id: number;
  storeId: number;
  storeName: string;
  number: number;
  date: string;
  status: "open" | "completed" | "cancelled";
  total: string;
  paid: string;
  hasWaybill: boolean | null;
  uploadStatus: "pending" | "uploaded" | null;
  comment: string;
  deliveryId: number | null;
  customerId: number;
  customerName: string;
  customerAddress: string;
  currentDebt: string;
}

/**
 * Old orders/index, orders/ordershistory and orders/all in one table. Kept compact so all columns fit
 * next to the sidebar at 1280px: the store (all-stores view) sits under the customer instead of in a
 * column of its own, and cells use slightly tighter padding.
 */
export function OrdersTable({
  rows,
  totals,
  showStore,
}: {
  rows: OrderRow[];
  totals: { count: number; total: string; paid: string };
  showStore: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card [&_td]:px-1.5 [&_th]:px-1.5 [&_tr>*:first-child]:pl-3 [&_tr>*:last-child]:pr-3">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <SortableHead column="date" first="desc">
              თარიღი
            </SortableHead>
            <SortableHead column="customer">{showStore ? "დასახელება · მაღაზია" : "დასახელება"}</SortableHead>
            <SortableHead column="paid" className="text-right">
              აღებული თანხა
            </SortableHead>
            <SortableHead column="debt" className="hidden text-right md:table-cell">
              დარჩენილი
            </SortableHead>
            <SortableHead column="total" className="text-right">
              სულ ჯამში
            </SortableHead>
            <SortableHead column="comment" className="hidden xl:table-cell">
              კომენტარი
            </SortableHead>
            <SortableHead column="status">სტატუსი</SortableHead>
            <SortableHead column="waybill" first="desc" className="hidden text-center sm:table-cell">
              RS
            </SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => {
            const href = storeHref(o.storeId, `orders/${o.id}`);
            return (
              <TableRow key={o.id} className={cn(o.status === "cancelled" && "bg-destructive/[0.06] hover:bg-destructive/10")}>
                <TableCell className="whitespace-nowrap">
                  <Link href={href} className="font-medium hover:underline">
                    {formatDate(o.date)}
                  </Link>
                  <div className="text-xs text-muted-foreground tabular-nums">#{o.number}</div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[13rem]">
                    <Link href={storeHref(o.storeId, `customers/${o.customerId}`)} className="block truncate hover:underline" title={o.customerName}>
                      {o.customerName}
                    </Link>
                    {showStore || o.customerAddress ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {showStore ? <span className="font-medium text-foreground/70">{o.storeName}</span> : null}
                        {showStore && o.customerAddress ? " · " : null}
                        {o.customerAddress}
                      </div>
                    ) : null}
                    {o.status !== "open" ? (
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={o.status === "cancelled" ? "destructive" : "secondary"}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                        {o.deliveryId ? (
                          <Link href={storeHref(o.storeId, `operations/${o.deliveryId}`)} className="text-xs text-muted-foreground hover:underline">
                            ოპერაცია →
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Money value={o.paid} tone="muted-zero" />
                </TableCell>
                <TableCell className="hidden text-right md:table-cell">
                  <Money value={o.currentDebt} tone="debt" />
                </TableCell>
                <TableCell className="text-right font-medium">
                  <Money value={o.total} />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <OrderCommentCell storeId={o.storeId} orderId={o.id} comment={o.comment} />
                </TableCell>
                <TableCell>
                  <UploadStatusToggle storeId={o.storeId} orderId={o.id} status={o.uploadStatus} />
                </TableCell>
                <TableCell className="hidden text-center sm:table-cell">
                  {o.hasWaybill === null ? "—" : o.hasWaybill ? <span className="font-medium">yes</span> : <span className="text-muted-foreground">no</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2}>სულ ({totals.count})</TableCell>
            <TableCell className="text-right font-semibold">
              <Money value={totals.paid} />
            </TableCell>
            <TableCell className="hidden md:table-cell" />
            <TableCell className="text-right font-semibold">
              <Money value={totals.total} currency />
            </TableCell>
            <TableCell className="hidden xl:table-cell" />
            <TableCell />
            <TableCell className="hidden sm:table-cell" />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
