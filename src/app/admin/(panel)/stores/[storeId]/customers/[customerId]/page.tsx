import { Archive, ClipboardList, IdCard, MapPin, Pencil, Phone, Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FilterTabs } from "@/components/data/filter-tabs";
import { Pagination } from "@/components/data/pagination";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerColorPicker } from "@/features/customers/components/customer-color";
import { CustomerComment } from "@/features/customers/components/customer-comment";
import { CustomerRowMenu } from "@/features/customers/components/customer-row-menu";
import { DebtAdjustmentDialog } from "@/features/customers/components/debt-adjustment-dialog";
import { getCustomer, getCustomerProductSummary, listCustomerDeliveries } from "@/features/customers/queries";
import { OPERATION_KIND_LABEL, operationKind } from "@/features/sales/labels";
import { paymentLabel } from "@/features/sales/logic";
import { formatDate } from "@/lib/dates";
import { dec, formatQty, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { pageParam, param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "კლიენტი" };

const PAGE_SIZE = 50;

export default async function CustomerPage({
  params,
  searchParams,
}: PageProps<"/admin/stores/[storeId]/customers/[customerId]">) {
  const { storeId, customerId } = await params;
  const { store, user } = await requireStore(storeId);
  const data = await getCustomer(store.id, Number(customerId));
  if (!data) notFound();
  const { customer, stats, openOrders } = data;
  const sp = await searchParams;
  const tab = param(sp, "tab") === "summary" ? "summary" : "operations";
  const page = pageParam(sp);
  const pathname = storeHref(store.id, `customers/${customer.id}`);

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "customers"), label: "კლიენტები" }}
        title={
          <span className="flex items-center gap-2">
            <CustomerColorPicker storeId={store.id} customerId={customer.id} color={customer.color} />
            {customer.name}
            {customer.isArchived ? (
              <Badge variant="secondary" className="gap-1">
                <Archive className="size-3" /> სანაგვეში
              </Badge>
            ) : null}
          </span>
        }
        description={
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {customer.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3.5" /> {customer.phone}
              </span>
            ) : null}
            {customer.contactPerson ? (
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" /> {customer.contactPerson}
              </span>
            ) : null}
            {customer.taxId ? (
              <span className="inline-flex items-center gap-1">
                <IdCard className="size-3.5" /> {customer.taxId}
              </span>
            ) : null}
            {customer.address ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" /> {customer.address}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <DebtAdjustmentDialog storeId={store.id} customerId={customer.id} currentDebt={stats.debt} />
            <Button variant="outline" asChild>
              <Link href={`${storeHref(store.id, "orders/new")}?customer=${customer.id}`}>
                <ClipboardList />
                შეკვეთა
              </Link>
            </Button>
            {!customer.isArchived ? (
              <Button asChild>
                <Link href={`${storeHref(store.id, "operations/new")}?customer=${customer.id}`}>
                  <Plus />
                  ახალი ოპერაცია
                </Link>
              </Button>
            ) : null}
            <Button variant="ghost" size="icon" asChild aria-label="რედაქტირება">
              <Link href={`${pathname}/edit`}>
                <Pencil />
              </Link>
            </Button>
            <CustomerRowMenu
              storeId={store.id}
              customerId={customer.id}
              name={customer.name}
              archived={customer.isArchived}
              canDelete={user.role === "super_admin"}
            />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          accent
          label="დარჩენილი ვალი"
          value={<Money value={stats.debt} currency tone="debt" />}
          hint={dec(stats.debt).lt(0) ? "კლიენტს ზედმეტად აქვს გადახდილი" : undefined}
        />
        <StatCard label="სულ მიწოდებული" value={<Money value={stats.total} currency />} hint={`${stats.operations} მიწოდება`} />
        <StatCard label="სულ აღებული" value={<Money value={stats.paid} currency />} />
        <StatCard
          label="პირველი / ბოლო ოპერაცია"
          value={<span className="text-lg">{stats.lastDate ? formatDate(stats.lastDate) : "—"}</span>}
          hint={
            <>
              {stats.firstDate ? `პირველი: ${formatDate(stats.firstDate)}` : "ოპერაციები ჯერ არ არის"}
              {openOrders ? (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`${storeHref(store.id, "orders")}?q=${encodeURIComponent(customer.name)}`} className="underline-offset-4 hover:underline">
                    {openOrders} ღია შეკვეთა
                  </Link>
                </>
              ) : null}
            </>
          }
        />
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">კომენტარი</CardTitle>
          <CustomerComment storeId={store.id} customerId={customer.id} comment={customer.comment} variant="card" />
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-line text-muted-foreground">{customer.comment || "კომენტარი არ არის."}</p>
        </CardContent>
      </Card>

      <div className="mt-8 mb-3 flex items-center justify-between gap-3">
        <FilterTabs
          pathname={pathname}
          searchParams={sp}
          param="tab"
          value={tab}
          options={[
            { value: "operations", label: "ოპერაციები" },
            { value: "summary", label: "ყველა დღე ერთად" },
          ]}
        />
      </div>

      {tab === "operations" ? (
        <OperationsTable storeId={store.id} customerId={customer.id} page={page} pathname={pathname} sp={sp} stats={stats} />
      ) : (
        <ProductSummary customerId={customer.id} />
      )}
    </>
  );
}

async function OperationsTable({
  storeId,
  customerId,
  page,
  pathname,
  sp,
  stats,
}: {
  storeId: number;
  customerId: number;
  page: number;
  pathname: string;
  sp: Record<string, string | string[] | undefined>;
  stats: { debt: string; total: string; paid: string };
}) {
  const { rows, total } = await listCustomerDeliveries(customerId, page, PAGE_SIZE);
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">ოპერაციები ჯერ არ არის.</p>;
  }
  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>თარიღი</TableHead>
              <TableHead>№</TableHead>
              <TableHead className="hidden md:table-cell">ტიპი</TableHead>
              <TableHead className="text-right">სულ ჯამში</TableHead>
              <TableHead className="text-right">აღებული თანხა</TableHead>
              <TableHead className="hidden text-right sm:table-cell">მეთოდი</TableHead>
              <TableHead className="text-right">დარჩენილი</TableHead>
              <TableHead className="hidden xl:table-cell">კომენტარი</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((op) => {
              const kind = operationKind({ kind: op.kind, total: op.total, paid: op.paid });
              const href = storeHref(storeId, `operations/${op.id}`);
              return (
                <TableRow key={op.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={href} className="font-medium hover:underline">
                      {formatDate(op.date)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">#{op.number}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {kind === "delivery" ? (
                      <span className="text-muted-foreground">{OPERATION_KIND_LABEL[kind]}</span>
                    ) : (
                      <Badge variant={kind === "adjustment" ? "outline" : "secondary"}>{OPERATION_KIND_LABEL[kind]}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {kind === "adjustment" ? (
                      <span className="text-muted-foreground">
                        კორ. <Money value={op.adjustment} />
                      </span>
                    ) : (
                      <Money value={op.total} tone="muted-zero" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={op.paid} tone="muted-zero" />
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                    {kind === "adjustment" ? "—" : paymentLabel(op.method)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={op.debtAfter} tone="debt" />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">
                    <div className="max-w-xs truncate" title={op.comment || undefined}>{op.comment}</div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="hidden md:table-cell">
                სულ
              </TableCell>
              <TableCell colSpan={2} className="md:hidden">
                სულ
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={stats.total} />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={stats.paid} />
              </TableCell>
              <TableCell className="hidden sm:table-cell" />
              <TableCell className="text-right text-base font-semibold">
                <Money value={stats.debt} tone="debt" />
              </TableCell>
              <TableCell className="hidden xl:table-cell" />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname={pathname} searchParams={sp} />
    </>
  );
}

async function ProductSummary({ customerId }: { customerId: number }) {
  const rows = await getCustomerProductSummary(customerId);
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">მიწოდებული პროდუქცია არ არის.</p>;
  }
  const totals = {
    quantity: rows.reduce((a, r) => a + r.quantity, 0),
    leftover: rows.reduce((a, r) => a + r.leftover, 0),
    gift: rows.reduce((a, r) => a + r.gift, 0),
    total: sum(rows.map((r) => r.total)),
  };
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead>დასახელება</TableHead>
            <TableHead className="text-right">საშუალო ფასი</TableHead>
            <TableHead className="text-right">შეტანილი</TableHead>
            <TableHead className="text-right">ნაშთი</TableHead>
            <TableHead className="text-right">დარჩენილი</TableHead>
            <TableHead className="text-right">საჩუქარი</TableHead>
            <TableHead className="text-right">ფასი ჯამში</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.productId}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">
                <Money value={dec(r.total).div(r.quantity)} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(r.quantity)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(r.leftover)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(r.quantity - r.leftover)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(r.gift)}</TableCell>
              <TableCell className="text-right font-medium">
                <Money value={r.total} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2}>ჯამში</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatQty(totals.quantity)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatQty(totals.leftover)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatQty(totals.quantity - totals.leftover)}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{formatQty(totals.gift)}</TableCell>
            <TableCell className="text-right font-semibold">
              <Money value={totals.total} currency />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
