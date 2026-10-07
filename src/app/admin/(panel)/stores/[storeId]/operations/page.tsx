import { Plus, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DateRangeFilter } from "@/components/data/date-range-filter";
import { Pagination } from "@/components/data/pagination";
import { ParamCombobox } from "@/components/data/param-combobox";
import { ParamSelect } from "@/components/data/param-select";
import { SearchInput } from "@/components/data/search-input";
import { SortableHead } from "@/components/data/sortable-head";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableRow } from "@/components/ui/table";
import { OPERATION_KIND_LABEL, operationKind } from "@/features/sales/labels";
import { paymentLabel } from "@/features/sales/logic";
import { listCustomerFilterOptions, listOperations, OPERATION_SORTS } from "@/features/sales/queries";
import { formatDate, isIsoDate } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { intParam, pageParam, param, sortParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ოპერაციები" };

const PAGE_SIZE = 50;

export default async function OperationsPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/operations">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const page = pageParam(sp);
  const from = param(sp, "from");
  const to = param(sp, "to");
  const methodParam = param(sp, "method");
  const kindParam = param(sp, "kind");
  const method = methodParam === "cash" || methodParam === "card" || methodParam === "back" ? methodParam : undefined;
  const kind = kindParam === "delivery" || kindParam === "payment" || kindParam === "adjustment" ? kindParam : undefined;

  const customerId = intParam(sp, "customer");

  const [list, customerOptions] = await Promise.all([
    listOperations(store.id, {
      q: param(sp, "q"),
      customerId,
      from: from && isIsoDate(from) ? from : undefined,
      to: to && isIsoDate(to) ? to : undefined,
      method,
      kind,
      sort: sortParam(sp, OPERATION_SORTS),
      page,
      pageSize: PAGE_SIZE,
    }),
    listCustomerFilterOptions([store.id], "deliveries"),
  ]);
  const pathname = storeHref(store.id, "operations");

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="ყველა ოპერაცია"
        description="მიწოდებები, გადახდები და კორექტირებები — უახლესი პირველია."
        actions={
          <Button asChild>
            <Link href={storeHref(store.id, "operations/new")}>
              <Plus />
              ახალი ოპერაცია
            </Link>
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput className="sm:w-72" placeholder="კლიენტი, კომენტარი ან №…" />
        <DateRangeFilter />
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <ParamCombobox
            param="customer"
            value={customerId ? String(customerId) : undefined}
            label="კლიენტი"
            placeholder="კლიენტის ძებნა…"
            emptyText="კლიენტი ვერ მოიძებნა."
            className="w-64"
            options={customerOptions.map((c) => ({
              value: String(c.id),
              label: c.name,
              hint: [c.address, c.isArchived ? "სანაგვე" : ""].filter(Boolean).join(" · ") || undefined,
              muted: c.isArchived,
            }))}
          />
          <ParamSelect
            param="kind"
            value={kind ?? "all"}
            label="ტიპი"
            className="w-48"
            options={[
              { value: "all", label: "ყველა" },
              { value: "delivery", label: "მიწოდება" },
              { value: "payment", label: "გადახდა" },
              { value: "adjustment", label: "კორექტირება" },
            ]}
          />
          <ParamSelect
            param="method"
            value={method ?? "all"}
            label="მეთოდი"
            className="w-48"
            options={[
              { value: "all", label: "ყველა" },
              { value: "cash", label: "ნაღდი" },
              { value: "card", label: "ბარათი" },
              { value: "back", label: "დაბრუნება" },
            ]}
          />
        </div>
      </div>

      {list.rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="ოპერაციები ვერ მოიძებნა" description="შეცვალეთ ფილტრები ან ძებნა." />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <SortableHead column="date" first="desc">
                  თარიღი
                </SortableHead>
                <SortableHead column="customer">დასახელება</SortableHead>
                <SortableHead column="paid" className="text-right">
                  აღებული თანხა
                </SortableHead>
                <SortableHead column="method" first="asc" className="hidden text-right lg:table-cell">
                  მეთოდი
                </SortableHead>
                <SortableHead column="debt" className="text-right">
                  დარჩენილი
                </SortableHead>
                <SortableHead column="total" className="text-right">
                  სულ ჯამში
                </SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((op) => {
                const k = operationKind({ kind: op.kind, total: op.total, paid: op.paid });
                return (
                  <TableRow key={op.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={storeHref(store.id, `operations/${op.id}`)} className="font-medium hover:underline">
                        {formatDate(op.date)}
                      </Link>
                      <div className="text-xs text-muted-foreground tabular-nums">#{op.number}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[22rem] items-center gap-2">
                        <Link href={storeHref(store.id, `customers/${op.customerId}`)} className="truncate hover:underline" title={op.customerName}>
                          {op.customerName}
                        </Link>
                        {k !== "delivery" ? (
                          <Badge variant={k === "adjustment" ? "outline" : "secondary"} className="shrink-0">
                            {OPERATION_KIND_LABEL[k]}
                          </Badge>
                        ) : null}
                      </div>
                      {op.comment ? <div className="max-w-[22rem] truncate text-xs text-muted-foreground">{op.comment}</div> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={op.paid} tone="muted-zero" />
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                      {k === "adjustment" ? "—" : paymentLabel(op.method)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={op.debtAfter} tone="debt" />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {k === "adjustment" ? (
                        <span className="text-muted-foreground">
                          კორ. <Money value={op.adjustment} />
                        </span>
                      ) : (
                        <Money value={op.total} tone="muted-zero" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2}>სულ ({list.count} ოპერაცია)</TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={list.paid} currency />
                </TableCell>
                <TableCell className="hidden lg:table-cell" />
                <TableCell />
                <TableCell className="text-right font-semibold">
                  <Money value={list.total} currency />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.count} pathname={pathname} searchParams={sp} />
    </>
  );
}
