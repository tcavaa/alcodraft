import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createEmployeeAction } from "@/features/finance/actions";
import { EmployeeForm } from "@/features/finance/components/finance-components";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი თანამშრომელი" };

export default async function NewEmployeePage({ params }: PageProps<"/admin/stores/[storeId]/employees/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: storeHref(store.id, "employees"), label: "ხელფასები" }} eyebrow={store.name} title="ახალი თანამშრომელი" />
      <Card>
        <CardContent className="pt-6">
          <EmployeeForm action={createEmployeeAction.bind(null, store.id)} submitLabel="დამატება" />
        </CardContent>
      </Card>
    </div>
  );
}
