"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { dec, parseAmount } from "@/lib/money";

import { updateDeliveryAction, updateOrderAction } from "../actions";
import { computeFinalLines, leftoverValue, type PaymentMethod, totalOf } from "../logic";
import type { ProductOption } from "../queries";
import { lineHasValues, LinesEditor, type LinesState, parseQty } from "./lines-editor";
import { SummaryPanel, type SummaryValues } from "./summary-panel";

export interface EditableLine {
  productId: number;
  unitPrice: string;
  quantity: number;
  giftQty: number;
  leftoverQty: number;
}

/**
 * Edit an operation or an open order. Prices are final per line (old orders/edit);
 * products that are not on the document yet can be added with the document's discount.
 */
export function DocumentEditForm({
  storeId,
  kind,
  documentId,
  products,
  initialLines,
  discountFactor,
  initial,
  previousDebt,
}: {
  storeId: number;
  kind: "delivery" | "order";
  documentId: number;
  products: ProductOption[];
  initialLines: EditableLine[];
  discountFactor: string | null;
  initial: { paid: string; method: PaymentMethod; hasWaybill: boolean | null; uploadStatus: "pending" | "uploaded" | null; comment: string };
  /** Customer's debt right before this document (operations only). */
  previousDebt: string | null;
}) {
  const factor = discountFactor ?? "1";
  const byProduct = new Map(initialLines.map((l) => [l.productId, l]));
  const [lines, setLines] = useState<LinesState>(() =>
    Object.fromEntries(
      products.map((p) => {
        const existing = byProduct.get(p.id);
        return [
          p.id,
          existing
            ? {
                price: dec(existing.unitPrice).toString(),
                quantity: existing.quantity ? String(existing.quantity) : "",
                giftQty: existing.giftQty ? String(existing.giftQty) : "",
                leftoverQty: existing.leftoverQty ? String(existing.leftoverQty) : "",
              }
            : { price: dec(p.salePrice).times(factor).toDecimalPlaces(4).toString(), quantity: "", giftQty: "", leftoverQty: "" },
        ];
      }),
    ),
  );
  // Products already on the document first (old edit listed them by quantity), then the rest.
  const ordered = useMemo(
    () => [...products].sort((a, b) => Number(byProduct.has(b.id)) - Number(byProduct.has(a.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products],
  );
  const [summary, setSummary] = useState<SummaryValues>({
    discountFactor: factor,
    paid: dec(initial.paid).toString(),
    method: initial.method,
    hasWaybill: initial.hasWaybill ?? false,
    uploadStatus: initial.uploadStatus ?? "pending",
    comment: initial.comment,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const filled = ordered.filter((p) => lineHasValues(lines[p.id]));
  const computed = computeFinalLines(
    filled.map((p) => ({
      productId: p.id,
      unitPrice: parseAmount(lines[p.id].price) ?? 0,
      quantity: parseQty(lines[p.id].quantity) ?? 0,
      giftQty: parseQty(lines[p.id].giftQty) ?? 0,
      leftoverQty: parseQty(lines[p.id].leftoverQty) ?? 0,
    })),
  );
  const total = totalOf(computed);

  const save = () =>
    startTransition(async () => {
      const bad = ordered.find((p) => {
        const l = lines[p.id];
        return (
          [l.quantity, l.giftQty, l.leftoverQty].some((v) => parseQty(v) === null) ||
          (parseQty(l.giftQty) ?? 0) < 0 ||
          (parseQty(l.leftoverQty) ?? 0) < 0 ||
          (lineHasValues(l) && !parseAmount(l.price))
        );
      });
      if (bad) {
        setErrors({ _form: `შეასწორეთ ველები: ${bad.name}` });
        return;
      }
      if (summary.paid !== "" && !parseAmount(summary.paid)) {
        setErrors({ paidAmount: "არასწორი თანხა" });
        return;
      }
      const payload = {
        lines: filled.map((p) => ({
          productId: p.id,
          unitPrice: lines[p.id].price,
          quantity: lines[p.id].quantity || "0",
          giftQty: lines[p.id].giftQty || "0",
          leftoverQty: lines[p.id].leftoverQty || "0",
        })),
        paidAmount: summary.paid,
        paymentMethod: summary.method,
        hasWaybill: summary.hasWaybill,
        comment: summary.comment,
      };
      const result =
        kind === "delivery"
          ? await updateDeliveryAction(storeId, documentId, payload)
          : await updateOrderAction(storeId, documentId, { ...payload, uploadStatus: summary.uploadStatus });
      if (result && !result.ok) {
        setErrors(result.fieldErrors ?? { _form: result.error });
        toast.error(result.error);
        return;
      }
      setErrors({});
      if (result?.ok) toast.success(result.message ?? "შენახულია");
    });

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <LinesEditor
          products={ordered}
          lines={lines}
          onChange={(productId, field, value) =>
            setLines((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }))
          }
          mode="final"
          discountFactor={factor}
          stockMode={kind === "order" ? "warn" : "off"}
        />
      </div>
      <div className="xl:sticky xl:top-20">
        <SummaryPanel
          values={summary}
          onChange={(patch) => setSummary((s) => ({ ...s, ...patch }))}
          total={total}
          lineCount={computed.length}
          quantity={computed.reduce((a, l) => a + l.quantity, 0)}
          gifts={computed.reduce((a, l) => a + l.giftQty, 0)}
          leftoverValue={leftoverValue(computed)}
          previousDebt={previousDebt}
          discountEditable={false}
          showUploadStatus={kind === "order"}
          submitLabel="ცვლილებების შენახვა"
          onSubmit={save}
          pending={pending}
          errors={errors}
        />
      </div>
    </div>
  );
}
