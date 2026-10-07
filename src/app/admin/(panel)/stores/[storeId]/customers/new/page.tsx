import type { Metadata } from "next";

import { FormPage } from "@/components/form-page";
import { createCustomerAction } from "@/features/customers/actions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი კლიენტი" };

export default async function NewCustomerPage({ params }: PageProps<"/admin/stores/[storeId]/customers/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <FormPage back={{ href: storeHref(store.id, "customers"), label: "კლიენტები" }} eyebrow={store.name} title="ახალი კლიენტი">
      <CustomerForm action={createCustomerAction.bind(null, store.id)} submitLabel="დამატება" />
    </FormPage>
  );
}
