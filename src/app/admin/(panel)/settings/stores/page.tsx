import { Plus, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SortableHead } from "@/components/data/sortable-head";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { listStoresAdmin } from "@/features/admin/queries";
import { formatDate } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import { sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მაღაზიები" };

const SORTS = ["name", "users", "customers", "products", "operations", "last"] as const;

export default async function StoresAdminPage({ searchParams }: PageProps<"/admin/settings/stores">) {
  await requireSuperAdmin();
  const stores = sortRows(await listStoresAdmin(), sortParam(await searchParams, SORTS), {
    name: (s) => s.name,
    users: (s) => s.users,
    customers: (s) => s.customers,
    products: (s) => s.products,
    operations: (s) => s.operations,
    last: (s) => s.lastOperation,
  });
  return (
    <>
      <PageHeader
        eyebrow="ადმინისტრირება"
        title="მაღაზიები"
        description="ყოველ მაღაზიას აქვს ყველა ფუნქცია: პროდუქცია, კლიენტები, ოპერაციები, შეკვეთები, საწყობი, სალარო, ხელფასები."
        actions={
          <Button asChild>
            <Link href="/admin/settings/stores/new">
              <Plus />
              ახალი მაღაზია
            </Link>
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SortableHead column="name">დასახელება</SortableHead>
              <SortableHead column="users" className="text-right">
                მომხმარებელი
              </SortableHead>
              <SortableHead column="customers" className="hidden text-right md:table-cell">
                კლიენტი
              </SortableHead>
              <SortableHead column="products" className="hidden text-right md:table-cell">
                პროდუქტი
              </SortableHead>
              <SortableHead column="operations" className="text-right">
                ოპერაცია
              </SortableHead>
              <SortableHead column="last" className="hidden text-right lg:table-cell">
                ბოლო ოპერაცია
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link href={`/admin/settings/stores/${s.id}`} className="inline-flex items-center gap-2 font-medium hover:underline">
                    <Store className="size-4 text-muted-foreground" />
                    {s.name}
                  </Link>
                  {s.isArchived ? (
                    <Badge variant="secondary" className="ml-2">
                      არქივი
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.users}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatQty(s.customers)}</TableCell>
                <TableCell className="hidden text-right tabular-nums md:table-cell">{formatQty(s.products)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatQty(s.operations)}</TableCell>
                <TableCell className="hidden text-right text-muted-foreground lg:table-cell">{s.lastOperation ? formatDate(s.lastOperation) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
