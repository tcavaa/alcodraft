import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLinesTable, sortLineRows } from "@/components/data/document-lines-table";
import { InfoList, InfoRow } from "@/components/info-list";
import { Money } from "@/components/money";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentEditForm } from "@/features/sales/components/document-edit-form";
import { ORDER_STATUS_LABEL, UPLOAD_STATUS_LABEL } from "@/features/sales/labels";
import { leftoverValue, paymentLabel } from "@/features/sales/logic";
import { getOrder, listProductOptions } from "@/features/sales/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatDiscount } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { idParam, param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "შეკვეთა" };

export default async function OrderPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/orders/[orderId]">) {
  const { storeId, orderId } = await params;
  const { store } = await requireStore(storeId);
  const data = await getOrder(store.id, idParam(orderId));
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
        isOpen ? null : (
          <>
            <PrintButton />
            {data.delivery ? (
              <Button asChild className="print:hidden">
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
    // Editing, completing and cancelling all happen in one form, so completion uses what is on screen.
    const products = await listProductOptions(
      store.id,
      items.map((i) => i.productId),
    );
    return (
      <>
        {header}
        {param(sp, "created") ? <Notice>შეკვეთა შენახულია. როცა მიიტანთ — დააჭირეთ „შეკვეთის დასრულება“.</Notice> : null}
        <DocumentEditForm
          storeId={store.id}
          kind="order"
          documentId={o.id}
          products={products}
          storedLines={items.map((i) => ({
            id: i.id,
            productId: i.productId,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            giftQty: i.giftQty,
            leftoverQty: i.leftoverQty,
            lineTotal: i.lineTotal,
          }))}
          storedTotal={o.totalAmount}
          discountFactor={o.discountFactor}
          initial={{
            paid: o.paidAmount,
            method: o.paymentMethod,
            hasWaybill: o.hasWaybill,
            uploadStatus: o.uploadStatus,
            comment: o.comment,
          }}
          previousDebt={data.currentDebt}
          order={{ number: o.number }}
        />
      </>
    );
  }

  const rows = sortLineRows(
    items.map((i) => ({
      key: i.id,
      name: i.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      leftover: i.leftoverQty,
      gift: i.giftQty,
      total: i.lineTotal,
    })),
    sp,
  );

  return (
    <>
      {header}
      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <DocumentLinesTable rows={rows} total={o.totalAmount} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ინფორმაცია</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoList>
              <InfoRow label="სულ ჯამში">
                <Money value={o.totalAmount} currency className="font-semibold" />
              </InfoRow>
              <InfoRow label="აღებული თანხა">
                <Money value={o.paidAmount} currency />
              </InfoRow>
              <InfoRow label="დარჩენილი (შეკვეთისას)">
                <Money value={o.debtSnapshot} tone="debt" />
              </InfoRow>
              <InfoRow label="გადახდის მეთოდი">{paymentLabel(o.paymentMethod)}</InfoRow>
              <InfoRow label="ზედნადები">{o.hasWaybill === null ? "—" : o.hasWaybill ? "კი" : "არა"}</InfoRow>
              <InfoRow label="ფასდაკლება">{formatDiscount(o.discountFactor) || "არა"}</InfoRow>
              {o.uploadStatus ? <InfoRow label="სტატუსი (RS)">{UPLOAD_STATUS_LABEL[o.uploadStatus]}</InfoRow> : null}
              <InfoRow label="ნაშთი (ღირებულება)">
                <Money value={leftoverValue(items)} />
              </InfoRow>
              {o.completedAt ? <InfoRow label="დასრულდა">{formatDateTime(o.completedAt)}</InfoRow> : null}
              {o.cancelledAt ? <InfoRow label="გაუქმდა">{formatDateTime(o.cancelledAt)}</InfoRow> : null}
            </InfoList>
            {o.comment ? <p className="mt-4 border-t pt-4 text-sm whitespace-pre-line text-muted-foreground">{o.comment}</p> : null}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
