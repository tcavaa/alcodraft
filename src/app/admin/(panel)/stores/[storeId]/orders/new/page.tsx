import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { OperationForm } from "@/features/sales/components/operation-form";
import { listCustomerOptionsWithDebt, listProductOptions } from "@/features/sales/queries";
import { formatDate, todayIso } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { intParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი შეკვეთა" };

export default async function NewOrderPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/orders/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const [products, customers] = await Promise.all([listProductOptions(store.id), listCustomerOptionsWithDebt(store.id)]);
  const requested = intParam(sp, "customer");
  const initialCustomerId = customers.some((c) => c.id === requested) ? requested! : null;
  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "orders"), label: "შეკვეთები" }}
        eyebrow={`${store.name} · ${formatDate(todayIso())}`}
        title="ახალი შეკვეთა"
        description="მარაგი და სალარო შეიცვლება მხოლოდ შეკვეთის დასრულებისას."
      />
      <OperationForm
        key={initialCustomerId ?? "none"}
        storeId={store.id}
        kind="order"
        products={products}
        customers={customers}
        initialCustomerId={initialCustomerId}
      />
    </>
  );
}
