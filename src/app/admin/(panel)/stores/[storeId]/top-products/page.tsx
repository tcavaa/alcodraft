import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/data/filter-tabs";
import { SortableHead } from "@/components/data/sortable-head";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTopProducts } from "@/features/dashboard/queries";
import { TOP_PERIOD_VALUES, TOP_PERIODS, topPeriodStart } from "@/features/dashboard/top-periods";
import { formatDate, todayIso } from "@/lib/dates";
import { dec, formatQty, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { enumParam, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ყველაზე გაყიდვადი პროდუქცია" };

const SORTS = ["rank", "name", "quantity", "gifts", "total", "stock"] as const;

/** Every product sold in the period, ranked by units delivered (the dashboard card shows the top 8). */
export default async function TopProductsPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/top-products">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const period = enumParam(sp, "period", TOP_PERIOD_VALUES) ?? "30d";
  const today = todayIso();
  const list = await getTopProducts(store.id, today, period);
  const ranked = list.map((p, i) => ({ ...p, rank: i + 1 }));
  const rows = sortRows(ranked, sortParam(sp, SORTS), {
    rank: (p) => p.rank,
    name: (p) => p.name,
    quantity: (p) => p.quantity,
    gifts: (p) => p.gifts,
    total: (p) => dec(p.total),
    stock: (p) => p.stock,
  });
  const totalQty = list.reduce((a, p) => a + p.quantity, 0);
  const totalGifts = list.reduce((a, p) => a + p.gifts, 0);
  const totalMoney = sum(list.map((p) => p.total));
  const periodInfo = TOP_PERIODS.find((p) => p.value === period)!;

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id), label: "დაფა" }}
        eyebrow={store.name}
        title="ყველაზე გაყიდვადი პროდუქცია"
        description={`${periodInfo.description} (${formatDate(topPeriodStart(today, period))} — ${formatDate(today)}), შეტანილი რაოდენობით.`}
      />

      <div className="mb-3">
        <FilterTabs
          pathname={storeHref(store.id, "top-products")}
          searchParams={sp}
          param="period"
          value={period}
          options={TOP_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="ამ პერიოდში გაყიდვა არ ყოფილა" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <SortableHead column="rank" className="w-14">
                  #
                </SortableHead>
                <SortableHead column="name">პროდუქტი</SortableHead>
                <SortableHead column="quantity" className="text-right">
                  შეტანილი
                </SortableHead>
                <TableHead className="hidden w-24 text-right md:table-cell">წილი</TableHead>
                <SortableHead column="gifts" className="hidden text-right md:table-cell">
                  საჩუქარი
                </SortableHead>
                <SortableHead column="total" className="text-right">
                  თანხა
                </SortableHead>
                <SortableHead column="stock" className="hidden text-right sm:table-cell">
                  მარაგი
                </SortableHead>
              </HeadRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        p.rank <= 3 ? "bg-gold/20 text-gold-strong" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.rank}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Link href={storeHref(store.id, `products/${p.id}`)} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.isArchived ? (
                      <Badge variant="outline" className="ml-2 align-middle text-[0.7rem]">
                        არქივში
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatQty(p.quantity)}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {totalQty ? `${((p.quantity / totalQty) * 100).toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {p.gifts ? formatQty(p.gifts) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={p.total} />
                  </TableCell>
                  <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", p.stock <= 0 && "text-destructive")}>
                    {formatQty(p.stock)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell />
                <TableCell className="text-muted-foreground">სულ {formatQty(list.length)} პროდუქტი</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatQty(totalQty)}</TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatQty(totalGifts)}</TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={totalMoney} currency />
                </TableCell>
                <TableCell className="hidden sm:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}
    </>
  );
}
