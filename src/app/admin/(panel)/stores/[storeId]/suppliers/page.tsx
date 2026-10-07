import { Plus, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/data/filter-tabs";
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
import { param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომწოდებლები" };

export default async function SuppliersPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/suppliers">) {
  const { storeId } = await params;
  const { store, user } = await requireStore(storeId);
  const sp = await searchParams;
  const archived = param(sp, "archived") === "1";
  const [rows, counts] = await Promise.all([listSuppliers(store.id, archived), countSuppliers(store.id)]);
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
        <FilterTabs
          pathname={pathname}
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
        <EmptyState icon={Truck} title="მომწოდებლები არ არის" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>დასახელება</TableHead>
                <TableHead className="hidden text-right md:table-cell">ბოლო მიღება</TableHead>
                <TableHead className="text-right">სულ გადასახდელი</TableHead>
                <TableHead className="text-right">გადახდილი</TableHead>
                <TableHead className="text-right">დარჩა</TableHead>
                <TableHead className="w-10" />
              </TableRow>
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
        </div>
      )}
    </>
  );
}
