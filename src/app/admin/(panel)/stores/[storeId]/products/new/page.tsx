import type { Metadata } from "next";

import { FormPage } from "@/components/form-page";
import { createProductAction } from "@/features/products/actions";
import { ProductForm } from "@/features/products/components/product-form";
import { listSupplierOptions } from "@/features/products/queries";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი პროდუქტი" };

export default async function NewProductPage({ params }: PageProps<"/admin/stores/[storeId]/products/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const suppliers = await listSupplierOptions(store.id);
  return (
    <FormPage
      back={{ href: storeHref(store.id, "products"), label: "პროდუქცია" }}
      eyebrow={store.name}
      title="ახალი პროდუქტი"
      description="მარაგი 0-ით იწყება — დაამატეთ საწყობში მიღებით."
    >
      <ProductForm action={createProductAction.bind(null, store.id)} suppliers={suppliers} submitLabel="დამატება" />
    </FormPage>
  );
}
