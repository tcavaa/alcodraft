import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { updateCustomerAction } from "@/features/customers/actions";
import { CustomerForm } from "@/features/customers/components/customer-form";
import { getCustomer } from "@/features/customers/queries";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "კლიენტის რედაქტირება" };

export default async function EditCustomerPage({ params }: PageProps<"/admin/stores/[storeId]/customers/[customerId]/edit">) {
  const { storeId, customerId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getCustomer(store.id, Number(customerId));
  if (!data) notFound();
  const { customer } = data;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={{ href: storeHref(store.id, `customers/${customer.id}`), label: customer.name }}
        eyebrow={store.name}
        title="რედაქტირება"
      />
      <Card>
        <CardContent className="pt-6">
          <CustomerForm
            action={updateCustomerAction.bind(null, store.id, customer.id)}
            defaults={customer}
            submitLabel="შენახვა"
          />
        </CardContent>
      </Card>
    </div>
  );
}
