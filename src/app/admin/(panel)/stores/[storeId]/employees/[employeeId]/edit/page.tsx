import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { updateEmployeeAction } from "@/features/finance/actions";
import { EmployeeForm } from "@/features/finance/components/finance-components";
import { getEmployee } from "@/features/finance/queries";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "თანამშრომლის რედაქტირება" };

export default async function EditEmployeePage({ params }: PageProps<"/admin/stores/[storeId]/employees/[employeeId]/edit">) {
  const { storeId, employeeId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getEmployee(store.id, Number(employeeId));
  if (!data) notFound();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader back={{ href: storeHref(store.id, `employees/${data.employee.id}`), label: data.employee.name }} eyebrow={store.name} title="რედაქტირება" />
      <Card>
        <CardContent className="pt-6">
          <EmployeeForm action={updateEmployeeAction.bind(null, store.id, data.employee.id)} defaults={data.employee} submitLabel="შენახვა" />
        </CardContent>
      </Card>
    </div>
  );
}
