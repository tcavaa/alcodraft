import { Info } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { DocumentEditForm } from "@/features/sales/components/document-edit-form";
import { getOperation, listProductOptions } from "@/features/sales/queries";
import { formatDate } from "@/lib/dates";
import { dec } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ოპერაციის რედაქტირება" };

export default async function EditOperationPage({ params }: PageProps<"/admin/stores/[storeId]/operations/[deliveryId]/edit">) {
  const { storeId, deliveryId } = await params;
  const { store } = await requireStore(storeId);
  const op = await getOperation(store.id, Number(deliveryId));
  if (!op) notFound();
  const { delivery: d, customer, items } = op;
  if (d.kind !== "delivery") redirect(storeHref(store.id, `operations/${d.id}`));
  const products = await listProductOptions(
    store.id,
    items.map((i) => i.productId),
  );
  const debtBefore = dec(op.debtAfter).minus(d.totalAmount).plus(d.paidAmount).minus(d.adjustmentAmount);

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, `operations/${d.id}`), label: `ოპერაცია #${d.number}` }}
        eyebrow={`${store.name} · ${formatDate(d.deliveryDate)}`}
        title={`რედაქტირება — ${customer.name}`}
      />
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-gold/40 bg-accent/50 px-4 py-3 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-gold-strong" />
        <p>
          შენახვისას საწყობი, კლიენტის ვალი (ამ და შემდეგი ოპერაციების) და სალარო ავტომატურად გადაითვლება. ფასები
          აქ საბოლოოა — ფასდაკლება თავიდან აღარ გამოიყენება.
        </p>
      </div>
      <DocumentEditForm
        storeId={store.id}
        kind="delivery"
        documentId={d.id}
        products={products}
        initialLines={items.map((i) => ({
          productId: i.productId,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          giftQty: i.giftQty,
          leftoverQty: i.leftoverQty,
        }))}
        discountFactor={d.discountFactor}
        initial={{
          paid: d.paidAmount,
          method: d.paymentMethod ?? "cash",
          hasWaybill: d.hasWaybill,
          uploadStatus: d.uploadStatus,
          comment: d.comment,
        }}
        previousDebt={debtBefore.toString()}
      />
    </>
  );
}
