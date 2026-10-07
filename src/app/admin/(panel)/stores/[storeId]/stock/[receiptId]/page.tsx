import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SortableHead } from "@/components/data/sortable-head";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteReceiptButton } from "@/features/stock/components/supplier-components";
import { getReceipt } from "@/features/stock/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { dec, formatAmount, formatQty, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { param, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მიღება" };

const SORTS = ["name", "before", "cost", "added", "after", "value"] as const;

/** Old drinks/history/{id}: stock before, price paid (red if it differs from today's), added, after. */
export default async function ReceiptPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/stock/[receiptId]">) {
  const { storeId, receiptId } = await params;
  const { store, user } = await requireStore(storeId);
  const data = await getReceipt(store.id, Number(receiptId));
  if (!data) notFound();
  const sp = await searchParams;
  const { receipt: r } = data;
  const items = sortRows(data.items, sortParam(sp, SORTS), {
    name: (i) => i.name,
    before: (i) => i.stockBefore,
    cost: (i) => dec(i.unitCost),
    added: (i) => i.quantity,
    after: (i) => (i.stockBefore === null ? null : i.stockBefore + i.quantity),
    value: (i) => dec(i.unitCost).times(i.quantity),
  });
  const total = sum(items.map((i) => dec(i.unitCost).times(i.quantity)));

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "stock"), label: "მიღების ისტორია" }}
        eyebrow={store.name}
        title={`მიღება #${r.number}`}
        description={
          <>
            {formatDate(r.receiptDate)}
            {r.supplierId ? (
              <>
                {" · "}
                <Link href={storeHref(store.id, `suppliers/${r.supplierId}`)} className="font-medium text-foreground hover:underline">
                  {data.supplierName}
                </Link>
              </>
            ) : null}
          </>
        }
        actions={
          <>
            <PrintButton />
            {user.role === "super_admin" ? <DeleteReceiptButton storeId={store.id} receiptId={r.id} number={r.number} /> : null}
          </>
        }
      />
      {param(sp, "created") ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4" />
          მიღება შენახულია — მარაგი განახლდა.
        </div>
      ) : null}
      {r.comment ? <p className="mb-4 text-sm text-muted-foreground">კომენტარი: {r.comment}</p> : null}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SortableHead column="name">დასახელება</SortableHead>
              <SortableHead column="before" className="text-right">
                რაოდენობა
              </SortableHead>
              <SortableHead column="cost" className="text-right">
                შემოტანის ფასი
              </SortableHead>
              <SortableHead column="added" className="text-right">
                დამატებული
              </SortableHead>
              <SortableHead column="after" className="text-right">
                დღის ბოლოს
              </SortableHead>
              <SortableHead column="value" className="text-right">
                ღირებულება
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((i) => {
              const differs = !dec(i.unitCost).equals(i.currentPurchasePrice);
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    <Link href={storeHref(store.id, `products/${i.productId}`)} className="hover:underline">
                      {i.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{i.stockBefore === null ? "—" : formatQty(i.stockBefore)}</TableCell>
                  <TableCell className="text-right">
                    {differs ? (
                      <Tooltip>
                        <TooltipTrigger className="cursor-help text-warning underline decoration-dotted underline-offset-4">
                          {formatAmount(i.unitCost)}
                        </TooltipTrigger>
                        <TooltipContent>ახლანდელი შემოტანის ფასი: {formatAmount(i.currentPurchasePrice)} ₾</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Money value={i.unitCost} />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatQty(i.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.stockBefore === null ? "—" : formatQty(i.stockBefore + i.quantity)}</TableCell>
                  <TableCell className="text-right">
                    <Money value={dec(i.unitCost).times(i.quantity)} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3}>სულ</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatQty(items.reduce((a, i) => a + i.quantity, 0))}</TableCell>
              <TableCell />
              <TableCell className="text-right font-semibold">
                <Money value={total} currency />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {r.createdById ? `${data.createdBy ?? "მომხმარებელი"} · ${formatDateTime(r.createdAt)}` : "გადმოტანილია ძველი სისტემიდან"}
      </p>
    </>
  );
}
