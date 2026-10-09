import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { CountForm } from "@/features/customers/components/count-form";
import { getCustomer, getCustomerShelf } from "@/features/customers/queries";
import { formatDate, todayIso } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "განაშთვა" };

/** „განაშთვა“: count what is left on the customer's shelf. */
export default async function CustomerCountPage({ params }: PageProps<"/admin/stores/[storeId]/customers/[customerId]/count">) {
  const { storeId, customerId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getCustomer(store.id, idParam(customerId));
  if (!data) notFound();
  const { customer } = data;
  const back = storeHref(store.id, `customers/${customer.id}`);
  if (customer.isArchived) redirect(back);
  const shelf = await getCustomerShelf(customer.id);

  return (
    <>
      <PageHeader
        back={{ href: back, label: customer.name }}
        eyebrow={`${store.name} · ${formatDate(todayIso())}`}
        title={`განაშთვა — ${customer.name}`}
        description={
          shelf.latestCount
            ? `შეიყვანეთ თაროზე დარჩენილი რაოდენობა. წინა განაშთვა: ${formatDate(shelf.latestCount.date)}.`
            : "შეიყვანეთ თაროზე დარჩენილი რაოდენობა."
        }
      />
      {shelf.products.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="ობიექტს პროდუქცია ჯერ არ მიეწოდა" />
      ) : (
        <CountForm
          storeId={store.id}
          customerId={customer.id}
          products={shelf.products.map((p) => ({
            productId: p.productId,
            name: p.name,
            lastPrice: p.lastPrice,
            delivered: p.delivered,
            leftover: p.leftover,
            isActive: p.isActive && !p.isArchived,
          }))}
        />
      )}
    </>
  );
}
