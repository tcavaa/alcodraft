import type { Metadata } from "next";

import { FormPage } from "@/components/form-page";
import { createEmployeeAction } from "@/features/finance/actions";
import { EmployeeForm } from "@/features/finance/components/finance-components";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი თანამშრომელი" };

export default async function NewEmployeePage({ params }: PageProps<"/admin/stores/[storeId]/employees/new">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  return (
    <FormPage width="xl" back={{ href: storeHref(store.id, "employees"), label: "ხელფასები" }} eyebrow={store.name} title="ახალი თანამშრომელი">
      <EmployeeForm action={createEmployeeAction.bind(null, store.id)} submitLabel="დამატება" />
    </FormPage>
  );
}
