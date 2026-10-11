import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormPage } from "@/components/form-page";
import { updateCustomerAction } from "@/features/customers/actions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { parseLegacyPhone } from "@/features/customers/phones";
import { getCustomer } from "@/features/customers/queries";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ობიექტის რედაქტირება" };

export default async function EditCustomerPage({ params }: PageProps<"/admin/stores/[storeId]/customers/[customerId]/edit">) {
  const { storeId, customerId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getCustomer(store.id, idParam(customerId));
  if (!data) notFound();
  const { customer } = data;
  // Not edited since the phone list: start from the numbers read from the old free text.
  const legacy = customer.phones.length > 0 ? null : parseLegacyPhone(customer.phone, customer.contactPerson);
  const defaults = {
    ...customer,
    phones: legacy ? legacy.phones : customer.phones,
    legacyPhoneRest: legacy?.rest,
  };
  return (
    <FormPage back={{ href: storeHref(store.id, `customers/${customer.id}`), label: customer.name }} eyebrow={store.name} title="რედაქტირება">
      <CustomerForm action={updateCustomerAction.bind(null, store.id, customer.id)} defaults={defaults} submitLabel="შენახვა" />
    </FormPage>
  );
}
