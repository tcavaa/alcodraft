import {
  ArrowRight,
  Banknote,
  CalendarDays,
  ClipboardList,
  HandCoins,
  PackageX,
  Plus,
  ReceiptText,
  Trophy,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { storeHref } from "@/components/layout/nav";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FilterTabs } from "@/components/data/filter-tabs";
import { MonthlyBars } from "@/features/dashboard/monthly-bars";
import { RankBadge } from "@/features/dashboard/rank-badge";
import {
  getMonthlySales,
  getOutOfStock,
  getRecentDeliveries,
  getStoreKpis,
  getTopCustomers,
  getTopProducts,
} from "@/features/dashboard/queries";
import { TOP_PERIOD_VALUES, TOP_PERIODS } from "@/features/dashboard/top-periods";
import { OPERATION_KIND_LABEL, operationKind } from "@/features/sales/labels";
import { formatDate, formatMonth, todayIso } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import { enumParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "დაფა" };

export default async function StoreDashboardPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const topPeriod = enumParam(sp, "top", TOP_PERIOD_VALUES) ?? "30d";
  const clientsPeriod = enumParam(sp, "clients", TOP_PERIOD_VALUES) ?? "30d";
  const today = todayIso();
  const [kpisMap, monthly, recent, topCustomers, outOfStock, topProducts] = await Promise.all([
    getStoreKpis([store.id], today),
    getMonthlySales(store.id, today),
    getRecentDeliveries(store.id),
    getTopCustomers(store.id, today, clientsPeriod, 8),
    getOutOfStock(store.id),
    getTopProducts(store.id, today, topPeriod, 8),
  ]);
  const kpis = kpisMap.get(store.id)!;
  const href = (segment: string) => storeHref(store.id, segment);
  const withPeriod = (path: string, period: string) => `${href(path)}${period === "30d" ? "" : `?period=${period}`}`;
  const topHref = withPeriod("top-products", topPeriod);
  const clientsHref = withPeriod("top-customers", clientsPeriod);
  const periodTabs = TOP_PERIODS.map((p) => ({ value: p.value, label: p.label }));

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="დაფა"
        description={`${formatDate(today)} · ${formatMonth(today)}`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={href("orders/new")}>
                <ClipboardList />
                ახალი შეკვეთა
              </Link>
            </Button>
            <Button asChild>
              <Link href={href("operations/new")}>
                <Plus />
                ახალი ოპერაცია
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          label="დღევანდელი გაყიდვა"
          icon={ReceiptText}
          value={<Money value={kpis.todayTotal} currency />}
          hint={
            <>
              {kpis.todayCount} ოპერაცია · აღებული <Money value={kpis.todayPaid} currency />
            </>
          }
        />
        <StatCard
          label="ამ თვის გაყიდვა"
          icon={CalendarDays}
          value={<Money value={kpis.monthTotal} currency />}
          hint={
            <>
              აღებული <Money value={kpis.monthPaid} currency />
            </>
          }
        />
        <StatCard
          label="მისაღები (ობიექტების ვალი)"
          icon={HandCoins}
          value={<Money value={kpis.receivable} currency tone="debt" />}
          hint={
            <>
              ზედმეტად გადახდილი: <Money value={kpis.credit} currency />
            </>
          }
        />
        <StatCard
          label="სალაროს ნაშთი"
          icon={Wallet}
          value={<Money value={kpis.cashBalance} currency />}
          hint={
            <Link href={href("finance")} className="underline-offset-4 hover:underline">
              სალაროს ნახვა
            </Link>
          }
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>გაყიდვები თვეების მიხედვით</CardTitle>
            <CardDescription>ბოლო 12 თვე — გაყიდვა და აღებული თანხა</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBars data={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-4 text-gold-strong" />
                ყველაზე გაყიდვადი პროდუქცია
              </CardTitle>
              <CardDescription>შეტანილი რაოდენობით</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={topHref}>
                ყველა <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="mb-2">
              <FilterTabs
                pathname={href("")}
                searchParams={sp}
                param="top"
                value={topPeriod}
                options={periodTabs}
              />
            </div>
            {topProducts.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">ამ პერიოდში გაყიდვა არ ყოფილა.</p>
            ) : (
              topProducts.map((p, i) => (
                <Link
                  key={p.id}
                  href={href(`products/${p.id}`)}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <RankBadge rank={i + 1} />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="font-medium">{formatQty(p.quantity)} ც.</span>
                    <Money value={p.total} currency className="ml-2 hidden text-xs text-muted-foreground sm:inline" />
                  </span>
                </Link>
              ))
            )}
            {topProducts.length === 8 ? (
              <Link
                href={topHref}
                className="block rounded-lg px-2 py-1.5 text-center text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                სრული სია
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <HandCoins className="size-4 text-gold-strong" />
                ობიექტები — ანალიტიკა
              </CardTitle>
              <CardDescription>ვისგან მივიღეთ ყველაზე მეტი თანხა</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href={clientsHref}>
                ყველას ნახვა <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="mb-2">
              <FilterTabs pathname={href("")} searchParams={sp} param="clients" value={clientsPeriod} options={periodTabs} />
            </div>
            {topCustomers.length === 0 ? (
              <p className="px-2 text-sm text-muted-foreground">ამ პერიოდში თანხა არ მიგვიღია.</p>
            ) : (
              topCustomers.map((c, i) => (
                <Link
                  key={c.id}
                  href={href(`customers/${c.id}`)}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <RankBadge rank={i + 1} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  <Money value={c.received} currency className="shrink-0 font-medium" />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PackageX className="size-4 text-destructive" />
              მარაგი ამოწურულია
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`${href("products")}?status=active&stock=out&sort=stock`}>
                ყველა <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {outOfStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">ყველა პროდუქტი მარაგშია.</p>
            ) : (
              outOfStock.map((p) => (
                <Link
                  key={p.id}
                  href={href(`products/${p.id}`)}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="tabular-nums text-destructive">{formatQty(p.stock)}</span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>ბოლო ოპერაციები</CardTitle>
            <CardDescription>
              {kpis.openOrders ? (
                <Link href={href("orders")} className="hover:underline">
                  {kpis.openOrders} ღია შეკვეთა ელოდება დასრულებას
                </Link>
              ) : (
                "ღია შეკვეთები არ არის"
              )}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href={href("operations")}>
              ყველა ოპერაცია <ArrowRight />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <div className="divide-y">
            {recent.map((op) => {
              const kind = operationKind({ kind: op.kind, total: op.total, paid: op.paid });
              return (
                <Link
                  key={op.id}
                  href={href(`operations/${op.id}`)}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-6 py-3 text-sm hover:bg-muted/60 md:grid-cols-[110px_1fr_140px_140px]"
                >
                  <span className="text-muted-foreground tabular-nums">
                    #{op.number} · {formatDate(op.date)}
                  </span>
                  <span className="truncate font-medium md:order-none">
                    {op.customerName}
                    {kind !== "delivery" ? (
                      <Badge variant="outline" className="ml-2 align-middle text-[0.7rem]">
                        {OPERATION_KIND_LABEL[kind]}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-right">
                    <Money value={kind === "adjustment" ? op.adjustment : op.total} currency />
                  </span>
                  <span className="hidden text-right text-muted-foreground md:block">
                    <Banknote className="mr-1 inline size-3.5" />
                    <Money value={op.paid} currency />
                  </span>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
