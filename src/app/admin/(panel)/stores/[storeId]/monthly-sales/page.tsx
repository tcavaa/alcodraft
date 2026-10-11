import type { Metadata } from "next";
import { Fragment } from "react";

import { HeadRow, TableCard } from "@/components/data/table-card";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonthlyBars } from "@/features/dashboard/monthly-bars";
import { getAllMonthlySales } from "@/features/dashboard/queries";
import { formatMonth, todayIso } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "გაყიდვები თვეების მიხედვით" };

/** The dashboard's monthly chart over the store's whole history, plus a table per year. */
export default async function MonthlySalesPage({ params }: PageProps<"/admin/stores/[storeId]/monthly-sales">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const months = await getAllMonthlySales(store.id, todayIso());

  // Newest year first; inside a year newest month first.
  const years = [...new Set(months.map((m) => m.month.slice(0, 4)))].reverse().map((year) => {
    const rows = months.filter((m) => m.month.startsWith(year)).reverse();
    return { year, rows, total: sum(rows.map((r) => r.total)), paid: sum(rows.map((r) => r.paid)) };
  });
  const total = sum(months.map((m) => m.total));
  const paid = sum(months.map((m) => m.paid));

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id), label: "დაფა" }}
        eyebrow={store.name}
        title="გაყიდვები თვეების მიხედვით"
        description={`ყველა თვე (${months.length}) — გაყიდვა და აღებული თანხა`}
      />

      <Card className="mb-6">
        <CardContent>
          <MonthlyBars data={months} scroll />
        </CardContent>
      </Card>

      <TableCard>
        <Table>
          <TableHeader>
            <HeadRow>
              <TableHead>თვე</TableHead>
              <TableHead className="text-right">გაყიდვა</TableHead>
              <TableHead className="text-right">აღებული</TableHead>
              <TableHead className="hidden text-right sm:table-cell">სხვაობა</TableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {years.map((y) => (
              <Fragment key={y.year}>
                <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                  <TableCell>{y.year}</TableCell>
                  <TableCell className="text-right">
                    <Money value={y.total} currency />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={y.paid} currency />
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <Money value={dec(y.total).minus(y.paid)} currency />
                  </TableCell>
                </TableRow>
                {y.rows.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="pl-6">{formatMonth(m.month)}</TableCell>
                    <TableCell className="text-right">
                      <Money value={m.total} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={m.paid} />
                    </TableCell>
                    <TableCell className="hidden text-right text-muted-foreground sm:table-cell">
                      <Money value={dec(m.total).minus(m.paid)} />
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="font-semibold">სულ</TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={total} currency />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={paid} currency />
              </TableCell>
              <TableCell className="hidden text-right sm:table-cell">
                <Money value={total.minus(paid)} currency />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableCard>
    </>
  );
}
