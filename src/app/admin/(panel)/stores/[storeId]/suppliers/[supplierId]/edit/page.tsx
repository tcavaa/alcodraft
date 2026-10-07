import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormPage } from "@/components/form-page";
import { updateSupplierAction } from "@/features/stock/actions";
import { SupplierForm } from "@/features/stock/components/supplier-components";
import { getSupplier } from "@/features/stock/queries";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომწოდებლის რედაქტირება" };

export default async function EditSupplierPage({ params }: PageProps<"/admin/stores/[storeId]/suppliers/[supplierId]/edit">) {
  const { storeId, supplierId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getSupplier(store.id, idParam(supplierId));
  if (!data) notFound();
  return (
    <FormPage
      width="xl"
      back={{ href: storeHref(store.id, `suppliers/${data.supplier.id}`), label: data.supplier.name }}
      eyebrow={store.name}
      title="რედაქტირება"
    >
      <SupplierForm action={updateSupplierAction.bind(null, store.id, data.supplier.id)} defaults={data.supplier} submitLabel="შენახვა" />
    </FormPage>
  );
}
