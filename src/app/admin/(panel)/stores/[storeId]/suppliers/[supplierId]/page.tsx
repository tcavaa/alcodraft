import { PackagePlus, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HistoryCard, sortHistory } from "@/components/data/history-card";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaySupplierForm, SupplierRowMenu } from "@/features/stock/components/supplier-components";
import { getSupplier } from "@/features/stock/queries";
import { formatDate } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { idParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომწოდებელი" };

/** Old drinks/historylistmomw: receipts to pay, payments made, what is left. */
export default async function SupplierPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/suppliers/[supplierId]">) {
  const { storeId, supplierId } = await params;
  const { store, user } = await requireStore(storeId);
  const data = await getSupplier(store.id, idParam(supplierId));
  if (!data) notFound();
  const { supplier } = data;
  const sp = await searchParams;
  const receipts = sortHistory(
    data.receipts.map((r) => ({
      id: r.id,
      date: r.date,
      dateCell: (
        <>
          <Link href={storeHref(store.id, `stock/${r.id}`)} className="hover:underline">
            {formatDate(r.date)}
          </Link>
          <span className="ml-2 text-xs text-muted-foreground">#{r.number}</span>
        </>
      ),
      amount: r.cost,
      comment: r.comment,
    })),
    sp,
    "rsort",
  );
  const payments = sortHistory(
    data.payments.map((p) => ({ id: p.id, date: p.date, amount: p.amountOut, comment: p.note })),
    sp,
    "psort",
  );
  // Same rule as the supplier list: goods taken back from customers are not owed.
  const payable = sum(data.receipts.filter((r) => !r.fromCustomer).map((r) => r.cost));
  const remaining = payable.minus(dec(data.paid));

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "suppliers"), label: "მომწოდებლები" }}
        eyebrow={store.name}
        title={
          <span className="flex items-center gap-2">
            {supplier.name}
            {supplier.isReturns ? <Badge variant="outline">დაბრუნებული</Badge> : null}
            {supplier.isCustomerReturns ? <Badge variant="outline">მაღაზიიდან გამოტანა</Badge> : null}
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
        <StatCard label="გადახდილი" value={<Money value={data.paid} currency />} hint={`${payments.length} გადახდა`} />
        <StatCard accent label="დარჩა" value={<Money value={remaining} currency tone="debt" />} />
      </div>

      <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_18rem]">
        <HistoryCard
          title="მიღებები"
          description="ჯამში მისაცემი თითოეული მიღებისთვის"
          param="rsort"
          rows={receipts}
          amountLabel="ჯამში"
          emptyText="მიღებები არ არის."
          narrow
        />
        <HistoryCard
          title="გადახდები"
          description="ჩაწერილია სალაროში"
          param="psort"
          rows={payments}
          amountLabel="თანხა"
          emptyText="გადახდები არ არის."
          narrow
        />
        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="text-base">გადახდა</CardTitle>
            <CardDescription>ჩაიწერება სალაროში ხარჯად.</CardDescription>
          </CardHeader>
          <CardContent>
            <PaySupplierForm storeId={store.id} supplierId={supplier.id} supplierName={supplier.name} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
