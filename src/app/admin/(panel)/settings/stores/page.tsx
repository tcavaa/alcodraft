import { Plus, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listStoresAdmin } from "@/features/admin/queries";
import { formatDate } from "@/lib/dates";
import { formatQty } from "@/lib/money";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მაღაზიები" };

export default async function StoresAdminPage() {
  await requireSuperAdmin();
  const stores = await listStoresAdmin();
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
              <TableHead>დასახელება</TableHead>
              <TableHead className="text-right">მომხმარებელი</TableHead>
              <TableHead className="hidden text-right md:table-cell">კლიენტი</TableHead>
              <TableHead className="hidden text-right md:table-cell">პროდუქტი</TableHead>
              <TableHead className="text-right">ოპერაცია</TableHead>
              <TableHead className="hidden text-right lg:table-cell">ბოლო ოპერაცია</TableHead>
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
