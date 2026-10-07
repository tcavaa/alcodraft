import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createCustomerAction } from "@/features/customers/actions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი კლიენტი" };

export default async function NewCustomerPage({ params }: PageProps<"/admin/stores/[storeId]/customers/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: storeHref(store.id, "customers"), label: "კლიენტები" }} eyebrow={store.name} title="ახალი კლიენტი" />
      <Card>
        <CardContent className="pt-6">
          <CustomerForm action={createCustomerAction.bind(null, store.id)} submitLabel="დამატება" />
        </CardContent>
      </Card>
    </div>
  );
}
