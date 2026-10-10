import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DateRangeFilter } from "@/components/data/date-range-filter";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listStockAdjustments } from "@/features/products/queries";
import { formatDateTime } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { dateRangeParam, pageParam, param } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ინვენტარიზაციის ისტორია" };

const PAGE_SIZE = 100;

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatQty(Math.abs(n))}`;

/** „ინვენტარიზაციის ისტორია“: every stock correction of the store („შესწორება“ on a product page). */
export default async function InventoryHistoryPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/products/inventory">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const page = pageParam(sp);
  const list = await listStockAdjustments(store.id, { q: param(sp, "q"), ...dateRangeParam(sp), page, pageSize: PAGE_SIZE });
  const pathname = storeHref(store.id, "products/inventory");

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "products"), label: "პროდუქცია" }}
        eyebrow={store.name}
        title="ინვენტარიზაციის ისტორია"
        description="ყველა პროდუქტის მარაგის შესწორება ერთად: რომელ პროდუქტს, რამდენი დაემატა (+) ან ჩამოიწერა (−) და რატომ."
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput className="sm:w-72" placeholder="პროდუქტი ან მიზეზი…" />
        <DateRangeFilter />
      </div>

      {list.rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="შესწორებები არ არის" description="მარაგის შესწორება კეთდება პროდუქტის გვერდიდან — „ინვენტარიზაცია“." />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <TableHead>თარიღი</TableHead>
                <TableHead>პროდუქტი</TableHead>
                <TableHead className="text-right">შესწორება</TableHead>
                <TableHead className="hidden text-right sm:table-cell">მარაგი</TableHead>
                <TableHead>მიზეზი</TableHead>
                <TableHead className="hidden text-right lg:table-cell">ვინ</TableHead>
              </HeadRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="text-muted-foreground tabular-nums">{formatDateTime(a.createdAt)}</TableCell>
                  <TableCell>
                    <Link href={storeHref(store.id, `products/${a.productId}`)} className="font-medium hover:underline">
                      {a.productName}
                    </Link>
                  </TableCell>
                  <TableCell
                    className={cn("text-right font-semibold tabular-nums", a.delta > 0 ? "text-success" : a.delta < 0 ? "text-destructive" : "")}
                  >
                    {signed(a.delta)}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
                    {formatQty(a.stockBefore)} → {formatQty(a.stockBefore + a.delta)}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs text-sm whitespace-pre-line text-muted-foreground">{a.reason || "—"}</div>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground lg:table-cell">{a.by || a.byEmail || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2} className="text-muted-foreground">
                  სულ {formatQty(list.count)} შესწორება
                </TableCell>
                <TableCell className="text-right text-sm whitespace-nowrap tabular-nums">
                  <span className="text-success">{signed(list.added)}</span> / <span className="text-destructive">{signed(list.removed)}</span>
                </TableCell>
                <TableCell colSpan={3} className="hidden sm:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.count} pathname={pathname} searchParams={sp} />
    </>
  );
}
