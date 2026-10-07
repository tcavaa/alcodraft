import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { updateSupplierAction } from "@/features/stock/actions";
import { SupplierForm } from "@/features/stock/components/supplier-components";
import { getSupplier } from "@/features/stock/queries";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომწოდებლის რედაქტირება" };

export default async function EditSupplierPage({ params }: PageProps<"/admin/stores/[storeId]/suppliers/[supplierId]/edit">) {
  const { storeId, supplierId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getSupplier(store.id, Number(supplierId));
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: storeHref(store.id, `suppliers/${data.supplier.id}`), label: data.supplier.name }}
        eyebrow={store.name}
        title="რედაქტირება"
      />
      <Card>
        <CardContent className="pt-6">
          <SupplierForm
            action={updateSupplierAction.bind(null, store.id, data.supplier.id)}
            defaults={data.supplier}
            submitLabel="შენახვა"
          />
        </CardContent>
      </Card>
    </div>
  );
}
