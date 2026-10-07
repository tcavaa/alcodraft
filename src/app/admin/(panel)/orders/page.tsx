import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { Pagination } from "@/components/data/pagination";
import { ParamCombobox } from "@/components/data/param-combobox";
import { SearchInput } from "@/components/data/search-input";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { OrdersTable } from "@/features/sales/components/orders-table";
import { listCustomerFilterOptions, listOrders, ORDER_SORTS } from "@/features/sales/queries";
import { intParam, pageParam, param, sortParam } from "@/lib/search-params";
import { getMyStores } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ყველა შეკვეთა" };

const PAGE_SIZE = 50;

/** Old orders/all: open orders of every store the user can open, newest first. */
export default async function AllOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const stores = (await getMyStores()).filter((s) => !s.isArchived);
  const sp = await searchParams;
  const page = pageParam(sp);
  const storeIds = stores.map((s) => s.id);
  const customerId = intParam(sp, "customer");
  const [list, customerOptions] = await Promise.all([
    listOrders(storeIds, {
      status: "open",
      q: param(sp, "q"),
      customerId,
      sort: sortParam(sp, ORDER_SORTS),
      page,
      pageSize: PAGE_SIZE,
    }),
    listCustomerFilterOptions(storeIds, "open-orders"),
  ]);
  return (
    <>
      <PageHeader title="ყველა შეკვეთა" description="ყველა მაღაზიის ღია შეკვეთები ერთ სიაში." />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput className="sm:w-72" placeholder="კლიენტი, მისამართი, კომენტარი ან №…" />
        <ParamCombobox
          param="customer"
          value={customerId ? String(customerId) : undefined}
          label="კლიენტი"
          placeholder="კლიენტის ძებნა…"
          emptyText="კლიენტი ვერ მოიძებნა."
          className="w-72 sm:ml-auto"
          options={customerOptions.map((c) => ({
            value: String(c.id),
            label: c.name,
            hint: [c.storeName, c.address].filter(Boolean).join(" · "),
            muted: c.isArchived,
          }))}
        />
      </div>
      {list.rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="ღია შეკვეთები არ არის" />
      ) : (
        <OrdersTable rows={list.rows} totals={list} showStore />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.count} pathname="/admin/orders" searchParams={sp} />
    </>
  );
}
