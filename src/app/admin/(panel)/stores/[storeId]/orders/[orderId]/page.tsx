import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentEditForm } from "@/features/sales/components/document-edit-form";
import { OrderActions } from "@/features/sales/components/order-actions";
import { ORDER_STATUS_LABEL, UPLOAD_STATUS_LABEL } from "@/features/sales/labels";
import { leftoverValue, paymentLabel } from "@/features/sales/logic";
import { getOrder, listProductOptions } from "@/features/sales/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatDiscount, formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "შეკვეთა" };

export default async function OrderPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/orders/[orderId]">) {
  const { storeId, orderId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getOrder(store.id, Number(orderId));
  if (!data) notFound();
  const sp = await searchParams;
  const { order: o, customer, items } = data;
  const isOpen = o.status === "open";

  const header = (
    <PageHeader
      back={{ href: storeHref(store.id, isOpen ? "orders" : "orders?view=history"), label: "შეკვეთები" }}
      eyebrow={store.name}
      title={
        <span className="flex items-center gap-3">
          შეკვეთა #{o.number}
          <Badge variant={o.status === "cancelled" ? "destructive" : isOpen ? "default" : "secondary"}>{ORDER_STATUS_LABEL[o.status]}</Badge>
        </span>
      }
      description={
        <>
          {formatDate(o.orderDate)} ·{" "}
          <Link href={storeHref(store.id, `customers/${customer.id}`)} className="font-medium text-foreground hover:underline">
            {customer.name}
          </Link>
          {customer.address ? ` · ${customer.address}` : ""}
        </>
      }
      actions={
        isOpen ? (
          <OrderActions
            storeId={store.id}
            orderId={o.id}
            number={o.number}
            shortStock={items.filter((i) => i.quantity + i.giftQty > i.stockQty).map((i) => i.name)}
          />
        ) : (
          <>
            <PrintButton />
            {data.delivery ? (
              <Button asChild>
                <Link href={storeHref(store.id, `operations/${data.delivery.id}`)}>
                  ოპერაცია #{data.delivery.number} <ArrowRight />
                </Link>
              </Button>
            ) : null}
          </>
        )
      }
    />
  );

  if (isOpen) {
    const products = await listProductOptions(
      store.id,
      items.map((i) => i.productId),
    );
    return (
      <>
        {header}
        {param(sp, "created") ? (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-4" />
            შეკვეთა შენახულია. როცა მიიტანთ — დააჭირეთ „შეკვეთის დასრულება“.
          </div>
        ) : null}
        <DocumentEditForm
          storeId={store.id}
          kind="order"
          documentId={o.id}
          products={products}
          initialLines={items.map((i) => ({
            productId: i.productId,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            giftQty: i.giftQty,
            leftoverQty: i.leftoverQty,
          }))}
          discountFactor={o.discountFactor}
          initial={{
            paid: o.paidAmount,
            method: o.paymentMethod ?? "cash",
            hasWaybill: o.hasWaybill,
            uploadStatus: o.uploadStatus,
            comment: o.comment,
          }}
          previousDebt={data.currentDebt}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>დასახელება</TableHead>
                <TableHead className="text-right">ფასი</TableHead>
                <TableHead className="text-right">შეტანილი</TableHead>
                <TableHead className="text-right">ნაშთი</TableHead>
                <TableHead className="text-right">დარჩენილი</TableHead>
                <TableHead className="text-right">საჩუქარი</TableHead>
                <TableHead className="text-right">ფასი ჯამში</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-right">
                    <Money value={i.unitPrice} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(i.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(i.leftoverQty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(i.quantity - i.leftoverQty)}</TableCell>
                  <TableCell className="text-right tabular-nums">{i.giftQty ? formatQty(i.giftQty) : "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={i.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6}>ჯამში</TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={o.totalAmount} currency />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ინფორმაცია</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5 text-sm">
              <Info label="სულ ჯამში">
                <Money value={o.totalAmount} currency className="font-semibold" />
              </Info>
              <Info label="აღებული თანხა">
                <Money value={o.paidAmount} currency />
              </Info>
              <Info label="დარჩენილი (შეკვეთისას)">
                <Money value={o.debtSnapshot} tone="debt" />
              </Info>
              <Info label="გადახდის მეთოდი">{paymentLabel(o.paymentMethod)}</Info>
              <Info label="ზედნადები">{o.hasWaybill === null ? "—" : o.hasWaybill ? "კი" : "არა"}</Info>
              <Info label="ფასდაკლება">{formatDiscount(o.discountFactor) || "არა"}</Info>
              {o.uploadStatus ? <Info label="სტატუსი (RS)">{UPLOAD_STATUS_LABEL[o.uploadStatus]}</Info> : null}
              <Info label="ნაშთი (ღირებულება)">
                <Money value={leftoverValue(items)} />
              </Info>
              {o.completedAt ? <Info label="დასრულდა">{formatDateTime(o.completedAt)}</Info> : null}
              {o.cancelledAt ? <Info label="გაუქმდა">{formatDateTime(o.cancelledAt)}</Info> : null}
            </dl>
            {o.comment ? <p className="mt-4 border-t pt-4 text-sm whitespace-pre-line text-muted-foreground">{o.comment}</p> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
