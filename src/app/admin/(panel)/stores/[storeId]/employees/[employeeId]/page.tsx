import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HistoryCard, sortHistory } from "@/components/data/history-card";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeRowMenu, WageForm } from "@/features/finance/components/finance-components";
import { getEmployee } from "@/features/finance/queries";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "თანამშრომელი" };

/** Old employees/historywages. */
export default async function EmployeePage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/employees/[employeeId]">) {
  const { storeId, employeeId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getEmployee(store.id, idParam(employeeId));
  if (!data) notFound();
  const { employee: e } = data;
  const sp = await searchParams;
  const payments = sortHistory(
    data.payments.map((p) => ({ id: p.id, date: p.date, amount: dec(p.amountOut).minus(p.amountIn), comment: p.note })),
    sp,
    "psort",
  );
  const accruals = sortHistory(
    data.accruals.map((a) => ({ id: a.id, date: a.date, amount: a.amount, comment: a.comment })),
    sp,
    "asort",
  );
  const paid = sum(payments.map((p) => p.amount));
  const accrued = sum(accruals.map((a) => a.amount));

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "employees"), label: "ხელფასები" }}
        eyebrow={store.name}
        title={e.name}
        actions={
          <>
            <Button variant="ghost" size="icon" asChild aria-label="რედაქტირება">
              <Link href={storeHref(store.id, `employees/${e.id}/edit`)}>
                <Pencil />
              </Link>
            </Button>
            <EmployeeRowMenu storeId={store.id} employeeId={e.id} name={e.name} archived={e.isArchived} />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard accent label="გასაცემი ხელფასი" value={<Money value={e.wageBalance} currency tone="debt" />} />
        <StatCard label="სულ დარიცხული" value={<Money value={accrued} currency />} hint={`${accruals.length} ჩანაწერი`} />
        <StatCard label="სულ გაცემული" value={<Money value={paid} currency />} hint={`${payments.length} გადახდა`} />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">გაცემა</CardTitle>
              <CardDescription>ჩაიწერება სალაროში და შეამცირებს გასაცემს.</CardDescription>
            </CardHeader>
            <CardContent>
              <WageForm storeId={store.id} employeeId={e.id} employeeName={e.name} mode="pay" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">დარიცხვა</CardTitle>
              <CardDescription>ზრდის გასაცემ ხელფასს.</CardDescription>
            </CardHeader>
            <CardContent>
              <WageForm storeId={store.id} employeeId={e.id} employeeName={e.name} mode="accrue" />
            </CardContent>
          </Card>
        </div>
        <HistoryCard title="მიცემული" param="psort" rows={payments} amountLabel="თანხა" emptyText="გადახდები არ არის." />
        <HistoryCard title="ხელფასი (დარიცხვები)" param="asort" rows={accruals} amountLabel="ხელფასი" emptyText="დარიცხვები არ არის." />
      </div>
    </>
  );
}
