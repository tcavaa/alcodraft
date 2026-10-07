import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormPage } from "@/components/form-page";
import { updateCustomerAction } from "@/features/customers/actions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { getCustomer } from "@/features/customers/queries";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "კლიენტის რედაქტირება" };

export default async function EditCustomerPage({ params }: PageProps<"/admin/stores/[storeId]/customers/[customerId]/edit">) {
  const { storeId, customerId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getCustomer(store.id, idParam(customerId));
  if (!data) notFound();
  const { customer } = data;
  return (
    <FormPage back={{ href: storeHref(store.id, `customers/${customer.id}`), label: customer.name }} eyebrow={store.name} title="რედაქტირება">
      <CustomerForm action={updateCustomerAction.bind(null, store.id, customer.id)} defaults={customer} submitLabel="შენახვა" />
    </FormPage>
  );
}
