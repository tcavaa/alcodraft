import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { OperationForm } from "@/features/sales/components/operation-form";
import { listCustomerOptionsWithDebt, listProductOptions } from "@/features/sales/queries";
import { formatDate, todayIso } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { intParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი ოპერაცია" };

export default async function NewOperationPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/operations/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const [products, customers] = await Promise.all([listProductOptions(store.id), listCustomerOptionsWithDebt(store.id)]);
  const requested = intParam(sp, "customer");
  const initialCustomerId = customers.some((c) => c.id === requested) ? requested! : null;

  return (
    <>
      <PageHeader
        back={{
          href: initialCustomerId ? storeHref(store.id, `customers/${initialCustomerId}`) : storeHref(store.id, "operations"),
          label: initialCustomerId ? "კლიენტი" : "ოპერაციები",
        }}
        eyebrow={`${store.name} · ${formatDate(todayIso())}`}
        title="ახალი ოპერაცია"
        description="შეიყვანეთ შეტანილი, საჩუქარი და ნაშთი; ბოლოს — აღებული თანხა."
      />
      <OperationForm
        key={initialCustomerId ?? "none"}
        storeId={store.id}
        kind="delivery"
        products={products}
        customers={customers}
        initialCustomerId={initialCustomerId}
      />
    </>
  );
}
