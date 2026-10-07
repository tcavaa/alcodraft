import type { Metadata } from "next";

import { FormPage } from "@/components/form-page";
import { createSupplierAction } from "@/features/stock/actions";
import { SupplierForm } from "@/features/stock/components/supplier-components";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი მომწოდებელი" };

export default async function NewSupplierPage({ params }: PageProps<"/admin/stores/[storeId]/suppliers/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <FormPage width="xl" back={{ href: storeHref(store.id, "suppliers"), label: "მომწოდებლები" }} eyebrow={store.name} title="ახალი მომწოდებელი">
      <SupplierForm action={createSupplierAction.bind(null, store.id)} submitLabel="დამატება" />
    </FormPage>
  );
}
