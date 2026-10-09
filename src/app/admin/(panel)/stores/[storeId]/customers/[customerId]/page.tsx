import { Archive, ClipboardCheck, ClipboardList, IdCard, MapPin, PackageMinus, Pencil, Phone, Plus, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLinesTable, sortLineRows } from "@/components/data/document-lines-table";
import { FilterTabs } from "@/components/data/filter-tabs";
import { Pagination } from "@/components/data/pagination";
import { SortableHead } from "@/components/data/sortable-head";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { Money } from "@/components/money";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerColorPicker } from "@/features/customers/components/customer-color";
import { CustomerComment } from "@/features/customers/components/customer-comment";
import { CustomerRowMenu } from "@/features/customers/components/customer-row-menu";
import { DebtAdjustmentDialog } from "@/features/customers/components/debt-adjustment-dialog";
import {
  CUSTOMER_OPERATION_SORTS,
  getCustomer,
  getCustomerProductSummary,
  getCustomerShelf,
  listCustomerDeliveries,
} from "@/features/customers/queries";
import { hasNoPayment, OPERATION_KIND_LABEL, operationKind } from "@/features/sales/labels";
import { paymentLabel } from "@/features/sales/logic";
import { formatDate } from "@/lib/dates";
import { dec, formatQty, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { enumParam, idParam, pageParam, param, type SearchParams, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "კლიენტი" };

const PAGE_SIZE = 50;

export default async function CustomerPage({
  params,
  searchParams,
}: PageProps<"/admin/stores/[storeId]/customers/[customerId]">) {
  const { storeId, customerId } = await params;
  const { store, user } = await requireStore(storeId);
  const data = await getCustomer(store.id, idParam(customerId));
  if (!data) notFound();
  const { customer, stats, openOrders } = data;
  const sp = await searchParams;
  const tab = enumParam(sp, "tab", ["summary", "leftover"] as const) ?? "operations";
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
            {/* A customer in the trash can't get new operations or orders — restore first. */}
            {!customer.isArchived ? (
              <>
                <Button variant="outline" asChild>
                  <Link href={`${storeHref(store.id, "orders/new")}?customer=${customer.id}`}>
                    <ClipboardList />
                    შეკვეთა
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`${pathname}/count`}>
                    <ClipboardCheck />
                    განაშთვა
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`${pathname}/return`}>
                    <PackageMinus />
                    პროდუქციის გამოტანა
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`${storeHref(store.id, "operations/new")}?customer=${customer.id}`}>
                    <Plus />
                    ახალი ოპერაცია
                  </Link>
                </Button>
              </>
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
                  <Link href={`${storeHref(store.id, "orders")}?customer=${customer.id}`} className="underline-offset-4 hover:underline">
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
            { value: "leftover", label: "ნაშთი" },
          ]}
        />
      </div>

      {param(sp, "counted") ? <Notice>განაშთვა შენახულია.</Notice> : null}

      {tab === "operations" ? (
        <OperationsTable storeId={store.id} customerId={customer.id} page={page} pathname={pathname} sp={sp} stats={stats} />
      ) : tab === "summary" ? (
        <ProductSummary customerId={customer.id} sp={sp} />
      ) : (
        <LeftoverSummary storeId={store.id} customerId={customer.id} sp={sp} />
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
  sp: SearchParams;
  stats: { debt: string; total: string; paid: string };
}) {
  const { rows, total } = await listCustomerDeliveries(customerId, page, PAGE_SIZE, sortParam(sp, CUSTOMER_OPERATION_SORTS));
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">ოპერაციები ჯერ არ არის.</p>;
  }
  return (
    <>
      <TableCard>
        <Table>
          <TableHeader>
            <HeadRow>
              <SortableHead column="date" first="desc">
                თარიღი
              </SortableHead>
              <SortableHead column="number" first="desc">
                №
              </SortableHead>
              <SortableHead column="kind" className="hidden md:table-cell">
                ტიპი
              </SortableHead>
              <SortableHead column="total" className="text-right">
                სულ ჯამში
              </SortableHead>
              <SortableHead column="paid" className="text-right">
                აღებული თანხა
              </SortableHead>
              <SortableHead column="method" first="asc" className="hidden text-right sm:table-cell">
                მეთოდი
              </SortableHead>
              <SortableHead column="debt" className="text-right">
                დარჩენილი
              </SortableHead>
              <SortableHead column="comment" className="hidden xl:table-cell">
                კომენტარი
              </SortableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {rows.map((op) => {
              const kind = operationKind({ kind: op.kind, total: op.total, paid: op.paid });
              const href = storeHref(storeId, `operations/${op.id}`);
              return (
                <TableRow key={op.id}>
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
                    {hasNoPayment(kind) ? "—" : paymentLabel(op.method)}
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
      </TableCard>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} pathname={pathname} searchParams={sp} />
    </>
  );
}

/** Old company/viewsum: every product the customer ever got, added up over all operations. */
async function ProductSummary({ customerId, sp }: { customerId: number; sp: SearchParams }) {
  const all = await getCustomerProductSummary(customerId);
  if (all.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">მიწოდებული პროდუქცია არ არის.</p>;
  }
  const rows = sortLineRows(
    all.map((r) => ({
      key: r.productId,
      name: r.name,
      // Average price = Σ line totals ÷ Σ delivered (old viewsum).
      unitPrice: dec(r.total).div(r.quantity),
      quantity: r.quantity,
      leftover: r.leftover,
      gift: r.gift,
      total: r.total,
    })),
    sp,
    "ssort",
  );
  return <DocumentLinesTable rows={rows} total={sum(all.map((r) => r.total))} param="ssort" priceLabel="საშუალო ფასი" />;
}

const LEFTOVER_SORTS = ["name", "price", "quantity", "leftover"] as const;

/**
 * „ნაშთი“ (new): per product Σ delivered and average price (as „ყველა დღე ერთად“) next to what the
 * latest „განაშთვა“ found on the shelf.
 */
async function LeftoverSummary({ storeId, customerId, sp }: { storeId: number; customerId: number; sp: SearchParams }) {
  const { latestCount, products } = await getCustomerShelf(customerId);
  if (products.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">მიწოდებული პროდუქცია არ არის.</p>;
  }
  const avg = (p: (typeof products)[number]) => (p.delivered > 0 ? dec(p.total).div(p.delivered) : dec(p.lastPrice));
  const rows = sortRows(products, sortParam(sp, LEFTOVER_SORTS, "lsort"), {
    name: (p) => p.name,
    price: avg,
    quantity: (p) => p.delivered,
    leftover: (p) => p.leftover,
  });
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        {latestCount ? (
          <>
            ბოლო განაშთვა:{" "}
            <Link href={storeHref(storeId, `operations/${latestCount.id}`)} className="font-medium text-foreground hover:underline">
              {formatDate(latestCount.date)} (#{latestCount.number})
            </Link>
          </>
        ) : (
          "განაშთვა ჯერ არ ჩატარებულა — ნაშთი 0."
        )}
      </p>
      <TableCard>
        <Table>
          <TableHeader>
            <HeadRow>
              <SortableHead column="name" param="lsort">
                დასახელება
              </SortableHead>
              <SortableHead column="price" param="lsort" className="text-right">
                საშუალო ფასი
              </SortableHead>
              <SortableHead column="quantity" param="lsort" className="text-right">
                შეტანილი
              </SortableHead>
              <SortableHead column="leftover" param="lsort" className="text-right">
                ნაშთი
              </SortableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.productId}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right">
                  <Money value={avg(p)} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatQty(p.delivered)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {p.leftover ? formatQty(p.leftover) : <span className="text-muted-foreground">0</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={2}>სულ</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatQty(products.reduce((a, p) => a + p.delivered, 0))}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{formatQty(products.reduce((a, p) => a + p.leftover, 0))}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableCard>
    </>
  );
}
