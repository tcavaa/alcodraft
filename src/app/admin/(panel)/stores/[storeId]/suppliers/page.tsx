import { Plus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ArchivedTabs } from "@/components/data/archived-tabs";
import { SortableHead } from "@/components/data/sortable-head";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SupplierRowMenu } from "@/features/stock/components/supplier-components";
import { countSuppliers, listSuppliers } from "@/features/stock/queries";
import { formatDate } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { param, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომწოდებლები" };

const SORTS = ["name", "last", "payable", "paid", "remaining"] as const;

export default async function SuppliersPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/suppliers">) {
  const { storeId } = await params;
  const { store, user } = await requireStore(storeId);
  const sp = await searchParams;
  const archived = param(sp, "archived") === "1";
  const [list, counts] = await Promise.all([listSuppliers(store.id, archived), countSuppliers(store.id)]);
  const rows = sortRows(list, sortParam(sp, SORTS), {
    name: (s) => s.name,
    last: (s) => s.lastDate,
    payable: (s) => dec(s.payable),
    paid: (s) => dec(s.paid),
    remaining: (s) => dec(s.payable).minus(s.paid),
  });
  const pathname = storeHref(store.id, "suppliers");
  const remaining = sum(rows.map((r) => dec(r.payable).minus(r.paid)));

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="მომწოდებლები"
        description="რამდენი უნდა გადაუხადოთ თითოეულს — მიღებები მინუს გადახდები."
        actions={
          <Button asChild>
            <Link href={storeHref(store.id, "suppliers/new")}>
              <Plus />
              ახალი მომწოდებელი
            </Link>
          </Button>
        }
      />
      <div className="mb-3">
        <ArchivedTabs pathname={pathname} searchParams={sp} archived={archived} counts={counts} />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Truck} title="მომწოდებლები არ არის" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <SortableHead column="name">დასახელება</SortableHead>
                <SortableHead column="last" className="hidden text-right md:table-cell">
                  ბოლო მიღება
                </SortableHead>
                <SortableHead column="payable" className="text-right">
                  სულ გადასახდელი
                </SortableHead>
                <SortableHead column="paid" className="text-right">
                  გადახდილი
                </SortableHead>
                <SortableHead column="remaining" className="text-right">
                  დარჩა
                </SortableHead>
                <TableHead className="w-10" />
              </HeadRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={storeHref(store.id, `suppliers/${s.id}`)} className="font-medium hover:underline">
                      {s.name}
                    </Link>
                    {s.isReturns ? (
                      <Badge variant="outline" className="ml-2">
                        დაბრუნებული
                      </Badge>
                    ) : null}
                    {s.isCustomerReturns ? (
                      <Badge variant="outline" className="ml-2">
                        მაღაზიიდან გამოტანა
                      </Badge>
                    ) : null}
                    <div className="text-xs text-muted-foreground">{s.receipts} მიღება</div>
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground md:table-cell">{s.lastDate ? formatDate(s.lastDate) : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Money value={s.payable} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Money value={s.paid} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={dec(s.payable).minus(s.paid)} tone="debt" />
                  </TableCell>
                  <TableCell>
                    <SupplierRowMenu storeId={store.id} supplierId={s.id} name={s.name} archived={archived} canDelete={user.role === "super_admin"} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="max-md:hidden">
                  სულ დარჩენილი გადასახდელი
                </TableCell>
                <TableCell colSpan={3} className="md:hidden">
                  სულ დარჩენილი
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={remaining} currency tone="debt" />
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}
    </>
  );
}
