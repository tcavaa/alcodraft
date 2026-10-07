import { Banknote, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/data/filter-tabs";
import { SortableHead } from "@/components/data/sortable-head";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeRowMenu } from "@/features/finance/components/finance-components";
import { countEmployees, listEmployees } from "@/features/finance/queries";
import { formatDate } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { param, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ხელფასები" };

const SORTS = ["name", "balance", "paid", "last"] as const;

export default async function EmployeesPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/employees">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const archived = param(sp, "archived") === "1";
  const [list, counts] = await Promise.all([listEmployees(store.id, archived), countEmployees(store.id)]);
  const rows = sortRows(list, sortParam(sp, SORTS), {
    name: (e) => e.name,
    balance: (e) => dec(e.wageBalance),
    paid: (e) => dec(e.paid),
    last: (e) => e.lastPaid,
  });

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="ხელფასები"
        description="თანამშრომლები, დარიცხული და გაცემული ხელფასი."
        actions={
          <Button asChild>
            <Link href={storeHref(store.id, "employees/new")}>
              <Plus />
              ახალი თანამშრომელი
            </Link>
          </Button>
        }
      />
      <div className="mb-3">
        <FilterTabs
          pathname={storeHref(store.id, "employees")}
          searchParams={sp}
          param="archived"
          value={archived ? "1" : "0"}
          options={[
            { value: "0", label: "აქტიური", count: counts.active },
            { value: "1", label: "სანაგვე", count: counts.archived },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Banknote} title="თანამშრომლები არ არის" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <SortableHead column="name">სახელი</SortableHead>
                <SortableHead column="balance" className="text-right">
                  გასაცემი ხელფასი
                </SortableHead>
                <SortableHead column="paid" className="text-right">
                  სულ გაცემული
                </SortableHead>
                <SortableHead column="last" className="hidden text-right md:table-cell">
                  ბოლო გაცემა
                </SortableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={storeHref(store.id, `employees/${e.id}`)} className="font-medium hover:underline">
                      {e.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={e.wageBalance} tone="debt" />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Money value={e.paid} />
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground md:table-cell">{e.lastPaid ? formatDate(e.lastPaid) : "—"}</TableCell>
                  <TableCell>
                    <EmployeeRowMenu storeId={store.id} employeeId={e.id} name={e.name} archived={archived} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>სულ</TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={sum(rows.map((r) => r.wageBalance))} currency tone="debt" />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={sum(rows.map((r) => r.paid))} currency />
                </TableCell>
                <TableCell colSpan={2} className="hidden md:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </>
  );
}
