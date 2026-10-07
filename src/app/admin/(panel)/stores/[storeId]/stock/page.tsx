import { PackageOpen, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DateRangeFilter } from "@/components/data/date-range-filter";
import { Pagination } from "@/components/data/pagination";
import { ParamSelect } from "@/components/data/param-select";
import { SearchInput } from "@/components/data/search-input";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSupplierOptions } from "@/features/products/queries";
import { listReceipts } from "@/features/stock/queries";
import { formatDate, isIsoDate } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { intParam, pageParam, param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "საწყობი — მიღებები" };

const PAGE_SIZE = 50;

export default async function StockPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/stock">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const page = pageParam(sp);
  const supplierId = intParam(sp, "supplier");
  const from = param(sp, "from");
  const to = param(sp, "to");
  const [list, suppliers] = await Promise.all([
    listReceipts(store.id, {
      supplierId,
      from: from && isIsoDate(from) ? from : undefined,
      to: to && isIsoDate(to) ? to : undefined,
      q: param(sp, "q"),
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
      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput placeholder="კომენტარი, მომწოდებელი ან №…" />
          <DateRangeFilter />
        </div>
        <ParamSelect
          param="supplier"
          value={supplierId ? String(supplierId) : "all"}
          label="მომწოდებელი"
          className="w-64"
          options={[{ value: "all", label: "ყველა" }, ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]}
        />
      </div>
      {list.rows.length === 0 ? (
        <EmptyState icon={PackageOpen} title="მიღებები ვერ მოიძებნა" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>თარიღი</TableHead>
                <TableHead>მომწოდებელი</TableHead>
                <TableHead className="hidden lg:table-cell">კომენტარი</TableHead>
                <TableHead className="text-right">პროდუქტი</TableHead>
                <TableHead className="text-right">ცალი</TableHead>
                <TableHead className="text-right">ღირებულება</TableHead>
              </TableRow>
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
                      <Link href={storeHref(store.id, `suppliers/${r.supplierId}`)} className="hover:underline">
                        {r.supplierName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-sm truncate text-muted-foreground lg:table-cell">{r.comment}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.lines ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(r.quantity ?? 0)}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={r.cost} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} pathname={pathname} searchParams={sp} />
    </>
  );
}
