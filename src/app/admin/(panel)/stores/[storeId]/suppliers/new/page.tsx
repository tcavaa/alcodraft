import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createSupplierAction } from "@/features/stock/actions";
import { SupplierForm } from "@/features/stock/components/supplier-components";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი მომწოდებელი" };

export default async function NewSupplierPage({ params }: PageProps<"/admin/stores/[storeId]/suppliers/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: storeHref(store.id, "suppliers"), label: "მომწოდებლები" }} eyebrow={store.name} title="ახალი მომწოდებელი" />
      <Card>
        <CardContent className="pt-6">
          <SupplierForm action={createSupplierAction.bind(null, store.id)} submitLabel="დამატება" />
        </CardContent>
      </Card>
    </div>
  );
}
