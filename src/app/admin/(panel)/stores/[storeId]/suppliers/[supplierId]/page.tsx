import { PackagePlus, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaySupplierForm, SupplierRowMenu } from "@/features/stock/components/supplier-components";
import { getSupplier } from "@/features/stock/queries";
import { formatDate } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომწოდებელი" };

/** Old drinks/historylistmomw: receipts to pay, payments made, what is left. */
export default async function SupplierPage({ params }: PageProps<"/admin/stores/[storeId]/suppliers/[supplierId]">) {
  const { storeId, supplierId } = await params;
  const { store, user } = await requireStore(storeId);
  const data = await getSupplier(store.id, Number(supplierId));
  if (!data) notFound();
  const { supplier, receipts, payments } = data;
  const payable = sum(receipts.map((r) => r.cost));
  const paid = sum(payments.map((p) => dec(p.amountOut).minus(p.amountIn)));
  const remaining = payable.minus(paid);

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "suppliers"), label: "მომწოდებლები" }}
        eyebrow={store.name}
        title={
          <span className="flex items-center gap-2">
            {supplier.name}
            {supplier.isReturns ? <Badge variant="outline">დაბრუნებული</Badge> : null}
            {supplier.isArchived ? <Badge variant="secondary">სანაგვეში</Badge> : null}
          </span>
        }
        actions={
          <>
            <Button asChild>
              <Link href={`${storeHref(store.id, "stock/receive")}?supplier=${supplier.id}`}>
                <PackagePlus />
                მიღება
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="რედაქტირება">
              <Link href={storeHref(store.id, `suppliers/${supplier.id}/edit`)}>
                <Pencil />
              </Link>
            </Button>
            <SupplierRowMenu storeId={store.id} supplierId={supplier.id} name={supplier.name} archived={supplier.isArchived} canDelete={user.role === "super_admin"} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="სულ გადასახდელი" value={<Money value={payable} currency />} hint={`${receipts.length} მიღება`} />
        <StatCard label="გადახდილი" value={<Money value={paid} currency />} hint={`${payments.length} გადახდა`} />
        <StatCard accent label="დარჩა" value={<Money value={remaining} currency tone="debt" />} />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">მიღებები</CardTitle>
            <CardDescription>ჯამში მისაცემი თითოეული მიღებისთვის</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {receipts.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">მიღებები არ არის.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">თარიღი</TableHead>
                    <TableHead className="text-right">ჯამში</TableHead>
                    <TableHead className="hidden pr-6 sm:table-cell xl:hidden 2xl:table-cell">კომენტარი</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6">
                        <Link href={storeHref(store.id, `stock/${r.id}`)} className="hover:underline">
                          {formatDate(r.date)}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground">#{r.number}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Money value={r.cost} />
                      </TableCell>
                      <TableCell className="hidden pr-6 text-muted-foreground sm:table-cell xl:hidden 2xl:table-cell">
                        <div className="max-w-[12rem] truncate" title={r.comment || undefined}>{r.comment}</div>
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
            <CardTitle className="text-base">გადახდები</CardTitle>
            <CardDescription>ჩაწერილია სალაროში</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {payments.length === 0 ? (
              <p className="px-6 text-sm text-muted-foreground">გადახდები არ არის.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">თარიღი</TableHead>
                    <TableHead className="text-right">თანხა</TableHead>
                    <TableHead className="hidden pr-6 sm:table-cell xl:hidden 2xl:table-cell">კომენტარი</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6">{formatDate(p.date)}</TableCell>
                      <TableCell className="text-right">
                        <Money value={dec(p.amountOut).minus(p.amountIn)} />
                      </TableCell>
                      <TableCell className="hidden pr-6 text-muted-foreground sm:table-cell xl:hidden 2xl:table-cell">
                        <div className="max-w-[12rem] truncate" title={p.note || undefined}>{p.note}</div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="text-base">გადახდა</CardTitle>
            <CardDescription>ჩაიწერება სალაროში ხარჯად.</CardDescription>
          </CardHeader>
          <CardContent>
            <PaySupplierForm storeId={store.id} supplierId={supplier.id} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
