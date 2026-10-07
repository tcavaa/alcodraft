import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FormPage } from "@/components/form-page";
import { updateEmployeeAction } from "@/features/finance/actions";
import { EmployeeForm } from "@/features/finance/components/finance-components";
import { getEmployee } from "@/features/finance/queries";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "თანამშრომლის რედაქტირება" };

export default async function EditEmployeePage({ params }: PageProps<"/admin/stores/[storeId]/employees/[employeeId]/edit">) {
  const { storeId, employeeId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getEmployee(store.id, idParam(employeeId));
  if (!data) notFound();
  return (
    <FormPage
      width="xl"
      back={{ href: storeHref(store.id, `employees/${data.employee.id}`), label: data.employee.name }}
      eyebrow={store.name}
      title="რედაქტირება"
    >
      {/* Keyed on the balance: if a wage is paid or accrued meanwhile, the form starts over from the
          new balance instead of saving the old one back. */}
      <EmployeeForm
        key={data.employee.wageBalance}
        action={updateEmployeeAction.bind(null, store.id, data.employee.id)}
        defaults={data.employee}
        submitLabel="შენახვა"
      />
    </FormPage>
  );
}
