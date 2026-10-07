import { Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableHead } from "@/components/data/sortable-head";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeRowMenu, WageForm } from "@/features/finance/components/finance-components";
import { getEmployee } from "@/features/finance/queries";
import { formatDate } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "თანამშრომელი" };

/** Old employees/historywages. */
const SORTS = ["date", "amount", "comment"] as const;

export default async function EmployeePage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/employees/[employeeId]">) {
  const { storeId, employeeId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getEmployee(store.id, Number(employeeId));
  if (!data) notFound();
  const { employee: e } = data;
  const sp = await searchParams;
  const payments = sortRows(data.payments, sortParam(sp, SORTS, "psort"), {
    date: (p) => p.date,
    amount: (p) => dec(p.amountOut).minus(p.amountIn),
    comment: (p) => p.note,
  });
  const accruals = sortRows(data.accruals, sortParam(sp, SORTS, "asort"), {
    date: (a) => a.date,
    amount: (a) => dec(a.amount),
    comment: (a) => a.comment,
  });
  const paid = sum(payments.map((p) => dec(p.amountOut).minus(p.amountIn)));
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
              <WageForm storeId={store.id} employeeId={e.id} mode="pay" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">დარიცხვა</CardTitle>
              <CardDescription>ზრდის გასაცემ ხელფასს.</CardDescription>
            </CardHeader>
            <CardContent>
              <WageForm storeId={store.id} employeeId={e.id} mode="accrue" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">მიცემული</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {payments.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">გადახდები არ არის.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead param="psort" column="date" first="desc" className="pl-6">
                      თარიღი
                    </SortableHead>
                    <SortableHead param="psort" column="amount" className="text-right">
                      თანხა
                    </SortableHead>
                    <SortableHead param="psort" column="comment" className="pr-6">
                      კომენტარი
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6">{formatDate(p.date)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={dec(p.amountOut).minus(p.amountIn)} />
                      </TableCell>
                      <TableCell className="pr-6 text-muted-foreground">
                        <div className="max-w-[14rem] truncate" title={p.note || undefined}>{p.note}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ხელფასი (დარიცხვები)</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {accruals.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">დარიცხვები არ არის.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead param="asort" column="date" first="desc" className="pl-6">
                      თარიღი
                    </SortableHead>
                    <SortableHead param="asort" column="amount" className="text-right">
                      ხელფასი
                    </SortableHead>
                    <SortableHead param="asort" column="comment" className="pr-6">
                      კომენტარი
                    </SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accruals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6">{formatDate(a.date)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={a.amount} />
                      </TableCell>
                      <TableCell className="pr-6 text-muted-foreground">
                        <div className="max-w-[14rem] truncate" title={a.comment || undefined}>{a.comment}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
