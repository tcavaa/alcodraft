import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: storeHref(store.id, "products"), label: "პროდუქცია" }} eyebrow={store.name} title="ახალი პროდუქტი" description="მარაგი 0-ით იწყება — დაამატეთ საწყობში მიღებით." />
      <Card>
        <CardContent className="pt-6">
          <ProductForm action={createProductAction.bind(null, store.id)} suppliers={suppliers} submitLabel="დამატება" />
        </CardContent>
      </Card>
    </div>
  );
}
