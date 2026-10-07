import { PageHeader } from "@/components/page-header";
import { formatDate, todayIso } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { intParam, type SearchParams } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

import { listCustomerOptionsWithDebt, listProductOptions } from "../queries";
import { OperationForm } from "./operation-form";

/** "ახალი ოპერაცია" / "ახალი შეკვეთა" — the same form; `?customer=<id>` preselects the customer. */
export async function NewDocumentPage({
  kind,
  storeId,
  searchParams,
}: {
  kind: "delivery" | "order";
  storeId: string;
  searchParams: SearchParams;
}) {
  const { store } = await requireStore(storeId);
  const [products, customers] = await Promise.all([listProductOptions(store.id), listCustomerOptionsWithDebt(store.id)]);
  const requested = intParam(searchParams, "customer");
  const initialCustomerId = customers.some((c) => c.id === requested) ? requested! : null;
  const list = kind === "delivery" ? "operations" : "orders";

  return (
    <>
      <PageHeader
        back={
          initialCustomerId
            ? { href: storeHref(store.id, `customers/${initialCustomerId}`), label: "კლიენტი" }
            : { href: storeHref(store.id, list), label: kind === "delivery" ? "ოპერაციები" : "შეკვეთები" }
        }
        eyebrow={`${store.name} · ${formatDate(todayIso())}`}
        title={kind === "delivery" ? "ახალი ოპერაცია" : "ახალი შეკვეთა"}
        description={
          kind === "delivery"
            ? "შეიყვანეთ შეტანილი, საჩუქარი და ნაშთი; ბოლოს — აღებული თანხა."
            : "მარაგი და სალარო შეიცვლება მხოლოდ შეკვეთის დასრულებისას."
        }
      />
      <OperationForm
        key={initialCustomerId ?? "none"}
        storeId={store.id}
        kind={kind}
        products={products}
        customers={customers}
        initialCustomerId={initialCustomerId}
      />
    </>
  );
}
