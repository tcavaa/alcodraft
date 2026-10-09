import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/data/filter-tabs";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CustomerFilter } from "@/features/sales/components/customer-filter";
import { OrdersTable } from "@/features/sales/components/orders-table";
import { listCustomerFilterOptions, listOrders, ORDER_SORTS } from "@/features/sales/queries";
import { storeHref } from "@/lib/routes";
import { enumParam, intParam, pageParam, param, sortParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "შეკვეთები" };

const PAGE_SIZE = 50;

export default async function OrdersPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/orders">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const view = param(sp, "view") === "history" ? "history" : "open";
  const historyStatus = view === "history" ? enumParam(sp, "status", ["completed", "cancelled"] as const) : undefined;
  const page = pageParam(sp);
  const customerId = intParam(sp, "customer");
  const [list, customerOptions] = await Promise.all([
    listOrders([store.id], {
      status: historyStatus ?? view,
      q: param(sp, "q"),
      customerId,
      sort: sortParam(sp, ORDER_SORTS),
      page,
      pageSize: PAGE_SIZE,
    }),
    listCustomerFilterOptions([store.id], "orders"),
  ]);
  const pathname = storeHref(store.id, "orders");

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="შეკვეთები"
        description="შეკვეთა მარაგს და სალაროს არ ცვლის, სანამ არ დასრულდება."
        actions={
          <Button asChild>
            <Link href={storeHref(store.id, "orders/new")}>
              <Plus />
              ახალი შეკვეთა
            </Link>
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput className="sm:w-72" placeholder="კლიენტი, მისამართი, კომენტარი ან №…" />
        <FilterTabs
          pathname={pathname}
          searchParams={sp}
          param="view"
          value={view}
          options={[
            { value: "open", label: "ღია" },
            { value: "history", label: "ჩახურული შეკვეთები" },
          ]}
        />
        {view === "history" ? (
          <FilterTabs
            pathname={pathname}
            searchParams={sp}
            param="status"
            value={historyStatus ?? "all"}
            options={[
              { value: "all", label: "ყველა" },
              { value: "completed", label: "დასრულებული" },
              { value: "cancelled", label: "გაუქმებული" },
            ]}
          />
        ) : null}
        <CustomerFilter options={customerOptions} value={customerId} className="w-64 sm:ml-auto" />
      </div>
      {list.rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            view === "open"
              ? "ღია შეკვეთები არ არის"
              : historyStatus === "completed"
                ? "დასრულებული შეკვეთები არ არის"
                : historyStatus === "cancelled"
                  ? "გაუქმებული შეკვეთები არ არის"
                  : "ისტორია ცარიელია"
          }
          action={
            view === "open" ? (
              <Button asChild>
                <Link href={storeHref(store.id, "orders/new")}>
                  <Plus /> ახალი შეკვეთა
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <OrdersTable rows={list.rows} totals={list} showStore={false} />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.count} pathname={pathname} searchParams={sp} />
    </>
  );
}
