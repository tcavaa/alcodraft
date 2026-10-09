import { HandCoins } from "lucide-react";
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
import { getTopCustomers } from "@/features/dashboard/queries";
import { RankBadge } from "@/features/dashboard/rank-badge";
import { TOP_PERIOD_VALUES, TOP_PERIODS, topPeriodStart } from "@/features/dashboard/top-periods";
import { formatDate, todayIso } from "@/lib/dates";
import { dec, formatQty, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { enumParam, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "კლიენტები — ანალიტიკა" };

const SORTS = ["rank", "name", "received", "sales", "operations", "debt"] as const;

/** Every customer who paid in the period, most money first (the dashboard card shows the top 8). */
export default async function TopCustomersPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/top-customers">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const period = enumParam(sp, "period", TOP_PERIOD_VALUES) ?? "30d";
  const today = todayIso();
  const list = await getTopCustomers(store.id, today, period);
  const ranked = list.map((c, i) => ({ ...c, rank: i + 1 }));
  const rows = sortRows(ranked, sortParam(sp, SORTS), {
    rank: (c) => c.rank,
    name: (c) => c.name,
    received: (c) => dec(c.received),
    sales: (c) => dec(c.sales),
    operations: (c) => c.operations,
    debt: (c) => dec(c.debt),
  });
  const totalReceived = sum(list.map((c) => c.received));
  const totalSales = sum(list.map((c) => c.sales));
  const periodInfo = TOP_PERIODS.find((p) => p.value === period)!;

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id), label: "დაფა" }}
        eyebrow={store.name}
        title="კლიენტები — ანალიტიკა"
        description={`${periodInfo.description} (${formatDate(topPeriodStart(today, period))} — ${formatDate(today)}): აღებული თანხა (ნაღდი და ბარათი), ყველაზე მეტიდან.`}
      />

      <div className="mb-3">
        <FilterTabs
          pathname={storeHref(store.id, "top-customers")}
          searchParams={sp}
          param="period"
          value={period}
          options={TOP_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={HandCoins} title="ამ პერიოდში თანხა არ მიგვიღია" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <SortableHead column="rank" className="w-14">
                  #
                </SortableHead>
                <SortableHead column="name">კლიენტი</SortableHead>
                <SortableHead column="received" className="text-right">
                  აღებული თანხა
                </SortableHead>
                <TableHead className="hidden w-24 text-right md:table-cell">წილი</TableHead>
                <SortableHead column="sales" className="hidden text-right sm:table-cell">
                  გაყიდვა
                </SortableHead>
                <SortableHead column="operations" className="hidden text-right lg:table-cell">
                  მიწოდება
                </SortableHead>
                <SortableHead column="debt" className="hidden text-right md:table-cell">
                  დარჩენილი (ვალი)
                </SortableHead>
              </HeadRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <RankBadge rank={c.rank} className="size-6 text-xs" />
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[22rem]">
                      <Link href={storeHref(store.id, `customers/${c.id}`)} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      {c.isArchived ? (
                        <Badge variant="outline" className="ml-2 align-middle text-[0.7rem]">
                          სანაგვე
                        </Badge>
                      ) : null}
                      {c.address ? <div className="truncate text-xs text-muted-foreground">{c.address}</div> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={c.received} />
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                    {totalReceived.isZero() ? "—" : `${dec(c.received).div(totalReceived).times(100).toFixed(1)}%`}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                    <Money value={c.sales} />
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums lg:table-cell">
                    {formatQty(c.operations)}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    <Money value={c.debt} tone="debt" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell />
                <TableCell className="text-muted-foreground">სულ {formatQty(list.length)} კლიენტი</TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={totalReceived} currency />
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="hidden text-right sm:table-cell">
                  <Money value={totalSales} currency />
                </TableCell>
                <TableCell className="hidden lg:table-cell" />
                <TableCell className="hidden md:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}
    </>
  );
}
