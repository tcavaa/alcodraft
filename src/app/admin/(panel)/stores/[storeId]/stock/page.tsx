import { PackageOpen, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CommentLine } from "@/components/data/comment-line";
import { DateRangeFilter } from "@/components/data/date-range-filter";
import { Pagination } from "@/components/data/pagination";
import { ParamSelect } from "@/components/data/param-select";
import { SearchInput } from "@/components/data/search-input";
import { SortableHead } from "@/components/data/sortable-head";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { listSupplierOptions } from "@/features/products/queries";
import { listReceipts, RECEIPT_SORTS } from "@/features/stock/queries";
import { formatDate } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { dateRangeParam, intParam, pageParam, param, sortParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "საწყობი — მიღებები" };

const PAGE_SIZE = 50;

export default async function StockPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/stock">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const page = pageParam(sp);
  const supplierId = intParam(sp, "supplier");
  const [list, suppliers] = await Promise.all([
    listReceipts(store.id, {
      supplierId,
      ...dateRangeParam(sp),
      q: param(sp, "q"),
      sort: sortParam(sp, RECEIPT_SORTS),
      page,
      pageSize: PAGE_SIZE,
    }),
    listSupplierOptions(store.id),
  ]);
  const pathname = storeHref(store.id, "stock");

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="საწყობი — მიღების ისტორია"
        description="ყოველი მიღება ზრდის მარაგს და მომწოდებლის გადასახდელს."
        actions={
          <Button asChild>
            <Link href={storeHref(store.id, "stock/receive")}>
              <Plus />
              ახალი მიღება
            </Link>
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput className="sm:w-72" placeholder="კომენტარი, მომწოდებელი ან №…" />
        <DateRangeFilter />
        <div className="flex flex-wrap gap-2">
          <ParamSelect
            param="supplier"
            value={supplierId ? String(supplierId) : "all"}
            label="მომწოდებელი"
            className="w-64"
            options={[{ value: "all", label: "ყველა" }, ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]}
          />
        </div>
      </div>
      {list.rows.length === 0 ? (
        <EmptyState icon={PackageOpen} title="მიღებები ვერ მოიძებნა" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <SortableHead column="date" first="desc">
                  თარიღი
                </SortableHead>
                <SortableHead column="supplier">მომწოდებელი</SortableHead>
                <SortableHead column="comment" className="hidden lg:table-cell">
                  კომენტარი
                </SortableHead>
                <SortableHead column="lines" className="text-right">
                  პროდუქტი
                </SortableHead>
                <SortableHead column="quantity" className="text-right">
                  ცალი
                </SortableHead>
                <SortableHead column="cost" className="text-right">
                  ღირებულება
                </SortableHead>
              </HeadRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={storeHref(store.id, `stock/${r.id}`)} className="font-medium hover:underline">
                      {formatDate(r.date)}
                    </Link>
                    <div className="text-xs text-muted-foreground tabular-nums">#{r.number}</div>
                  </TableCell>
                  <TableCell>
                    {r.supplierId ? (
                      <Link href={storeHref(store.id, `suppliers/${r.supplierId}`)} className="block max-w-[16rem] truncate hover:underline" title={r.supplierName ?? undefined}>
                        {r.supplierName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {r.customerId ? (
                      <Link
                        href={storeHref(store.id, `customers/${r.customerId}`)}
                        className="block max-w-[16rem] truncate text-xs text-muted-foreground hover:underline"
                        title={r.customerName ?? undefined}
                      >
                        მაღაზიიდან გამოტანა: {r.customerName}
                      </Link>
                    ) : null}
                    <CommentLine comment={r.comment} className="lg:hidden" />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    <div className="max-w-[14rem] truncate" title={r.comment || undefined}>{r.comment}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.lines ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(r.quantity ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={r.cost} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} pathname={pathname} searchParams={sp} />
    </>
  );
}
