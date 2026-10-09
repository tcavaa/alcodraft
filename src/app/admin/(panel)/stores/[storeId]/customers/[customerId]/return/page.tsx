import { PackageMinus } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReturnForm } from "@/features/customers/components/return-form";
import { getCustomer, getCustomerShelf } from "@/features/customers/queries";
import { formatDate, todayIso } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "პროდუქციის გამოტანა" };

/** „პროდუქციის გამოტანა“: goods taken back from the customer (debt down, stock up). */
export default async function CustomerReturnPage({ params }: PageProps<"/admin/stores/[storeId]/customers/[customerId]/return">) {
  const { storeId, customerId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getCustomer(store.id, idParam(customerId));
  if (!data) notFound();
  const { customer, stats } = data;
  const back = storeHref(store.id, `customers/${customer.id}`);
  if (customer.isArchived) redirect(back);
  const shelf = await getCustomerShelf(customer.id);
  const delivered = shelf.products.filter((p) => p.delivered > 0);

  return (
    <>
      <PageHeader
        back={{ href: back, label: customer.name }}
        eyebrow={`${store.name} · ${formatDate(todayIso())}`}
        title={`პროდუქციის გამოტანა — ${customer.name}`}
        description="მხოლოდ კლიენტთან შეტანილი პროდუქცია. ფასი — ბოლოს მიწოდებული ფასი (შეგიძლიათ შეცვალოთ)."
      />
      {delivered.length === 0 ? (
        <EmptyState icon={PackageMinus} title="კლიენტს პროდუქცია ჯერ არ მიეწოდა" />
      ) : (
        <ReturnForm
          storeId={store.id}
          customerId={customer.id}
          currentDebt={stats.debt}
          products={delivered.map((p) => ({
            productId: p.productId,
            name: p.name,
            lastPrice: p.lastPrice,
            delivered: p.delivered,
            isActive: p.isActive && !p.isArchived,
          }))}
        />
      )}
    </>
  );
}
