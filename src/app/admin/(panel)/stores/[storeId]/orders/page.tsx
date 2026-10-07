import { ClipboardList, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/data/filter-tabs";
import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { OrdersTable } from "@/features/sales/components/orders-table";
import { listOrders } from "@/features/sales/queries";
import { storeHref } from "@/lib/routes";
import { pageParam, param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "შეკვეთები" };

const PAGE_SIZE = 50;

export default async function OrdersPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/orders">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const view = param(sp, "view") === "history" ? "history" : "open";
  const page = pageParam(sp);
  const list = await listOrders([store.id], { status: view, q: param(sp, "q"), page, pageSize: PAGE_SIZE });
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
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput placeholder="კლიენტი, მისამართი, კომენტარი ან №…" />
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
      </div>
      {list.rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={view === "open" ? "ღია შეკვეთები არ არის" : "ისტორია ცარიელია"}
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
