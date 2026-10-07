import { ClipboardList } from "lucide-react";
import type { Metadata } from "next";

import { Pagination } from "@/components/data/pagination";
import { SearchInput } from "@/components/data/search-input";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { OrdersTable } from "@/features/sales/components/orders-table";
import { listOrders } from "@/features/sales/queries";
import { pageParam, param } from "@/lib/search-params";
import { getMyStores } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ყველა შეკვეთა" };

const PAGE_SIZE = 50;

/** Old orders/all: open orders of every store the user can open, newest first. */
export default async function AllOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  const stores = (await getMyStores()).filter((s) => !s.isArchived);
  const sp = await searchParams;
  const page = pageParam(sp);
  const list = await listOrders(
    stores.map((s) => s.id),
    { status: "open", q: param(sp, "q"), page, pageSize: PAGE_SIZE },
  );
  return (
    <>
      <PageHeader title="ყველა შეკვეთა" description="ყველა მაღაზიის ღია შეკვეთები ერთ სიაში." />
      <div className="mb-3">
        <SearchInput placeholder="კლიენტი, მისამართი, კომენტარი ან №…" />
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
