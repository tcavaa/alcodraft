"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog, ConfirmFigures } from "@/components/confirm-dialog";
import { Money } from "@/components/money";
import { useRequestId } from "@/hooks/use-request-id";
import { useServerAction } from "@/hooks/use-server-action";
import { parseQty } from "@/lib/grid-nav";
import { dec, parseAmount } from "@/lib/money";

import { createDeliveryAction, createOrderAction } from "../actions";
import { computeLines, leftoverValue, paymentLabel, totalOf } from "../logic";
import type { CustomerOption, ProductOption } from "../queries";
import { CustomerPicker } from "./customer-picker";
import { firstInvalidLine, type LineState, lineHasValues, LinesEditor, useDocumentLines } from "./lines-editor";
import { SummaryPanel, type SummaryValues } from "./summary-panel";

const newLine = (p: ProductOption): LineState => ({
  price: dec(p.salePrice).toString(),
  quantity: "",
  giftQty: "",
  leftoverQty: "",
});

/**
 * New operation ("დღის ჩახურვა", old distribution/add) or new order (old orders/add).
 * Same form; an order only records the intent — stock and money move when it is completed.
 */
export function OperationForm({
  storeId,
  kind,
  products,
  customers,
  initialCustomerId,
}: {
  storeId: number;
  kind: "delivery" | "order";
  products: ProductOption[];
  customers: CustomerOption[];
  initialCustomerId: number | null;
}) {
  const [customerId, setCustomerId] = useState<number | null>(initialCustomerId);
  const { lineOf, setField } = useDocumentLines(products, newLine);
  const [summary, setSummary] = useState<SummaryValues>({
    discountFactor: "1",
    paid: "",
    method: "cash",
    hasWaybill: true,
    uploadStatus: "pending",
    comment: "",
  });
  const [confirming, setConfirming] = useState(false);
  const requestId = useRequestId();
  const { run, pending, errors, setErrors } = useServerAction();

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const filled = products.filter((p) => lineHasValues(lineOf(p)));
  const computed = computeLines(
    filled.map((p) => {
      const l = lineOf(p);
      return {
        productId: p.id,
        price: parseAmount(l.price) ?? 0,
        quantity: parseQty(l.quantity) ?? 0,
        giftQty: parseQty(l.giftQty) ?? 0,
        leftoverQty: parseQty(l.leftoverQty) ?? 0,
      };
    }),
    summary.discountFactor,
  );
  const total = totalOf(computed);
  const dirty = filled.length > 0 || summary.paid !== "";

  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const validate = () => {
    const next: Record<string, string> = {};
    if (!customer) next.customerId = "აირჩიეთ კლიენტი";
    const badLine = firstInvalidLine(products, lineOf);
    if (badLine) next._form = `შეასწორეთ ველები: ${badLine.name}`;
    if (summary.paid !== "" && !parseAmount(summary.paid)) next.paidAmount = "არასწორი თანხა";
    if (kind === "delivery") {
      const over = filled.find((p) => (parseQty(lineOf(p).quantity) ?? 0) > Math.max(p.stockQty, 0));
      if (over) next._form = `${over.name}: შეტანილი აღემატება მარაგს (${over.stockQty}).`;
      if (filled.length === 0 && (parseAmount(summary.paid || "0") ?? dec(0)).isZero()) {
        next._form = "შეიყვანეთ რაოდენობა ან აღებული თანხა.";
      }
    } else if (filled.length === 0) {
      next._form = "შეკვეთაში არცერთი პროდუქტი არ არის.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = () => {
    if (validate()) setConfirming(true);
    else toast.error("შეასწორეთ შეცდომები");
  };

  const save = () => {
    const payload = {
      requestId: requestId.current(),
      customerId: customerId!,
      lines: filled.map((p) => {
        const l = lineOf(p);
        return {
          productId: p.id,
          price: l.price,
          quantity: l.quantity || "0",
          giftQty: l.giftQty || "0",
          leftoverQty: l.leftoverQty || "0",
        };
      }),
      discountFactor: summary.discountFactor,
      paidAmount: summary.paid,
      paymentMethod: summary.method ?? "cash",
      hasWaybill: summary.hasWaybill ?? false,
      comment: summary.comment,
    };
    // Success redirects to the new document; a failure keeps the same request id for the retry.
    run(
      () =>
        kind === "delivery"
          ? createDeliveryAction(storeId, payload)
          : createOrderAction(storeId, { ...payload, uploadStatus: summary.uploadStatus ?? "pending" }),
      { onError: () => setConfirming(false) },
    );
  };

  const paid = parseAmount(summary.paid || "0") ?? dec(0);
  const debtAfter = customer ? dec(customer.debt).plus(total).minus(paid) : null;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
        <div className="max-w-xl">
          <CustomerPicker customers={customers} value={customerId} onChange={setCustomerId} invalid={Boolean(errors.customerId)} />
          {errors.customerId ? <p className="mt-1 text-sm text-destructive">{errors.customerId}</p> : null}
        </div>
        <LinesEditor
          products={products}
          lineOf={lineOf}
          onChange={setField}
          mode="entry"
          discountFactor={summary.discountFactor}
          stockMode={kind === "delivery" ? "block" : "warn"}
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
          previousDebt={customer?.debt ?? null}
          discountEditable
          showUploadStatus={kind === "order"}
          submitLabel={kind === "delivery" ? "დღის ჩახურვა" : "შეკვეთის შენახვა"}
          onSubmit={submit}
          pending={pending}
          errors={errors}
        />
      </div>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={kind === "delivery" ? "ნამდვილად გსურთ დღის ჩახურვა?" : "შეკვეთის შენახვა"}
        description={
          <>
            <div className="font-medium text-foreground">{customer?.name}</div>
            <ConfirmFigures
              rows={[
                { label: "სულ ჯამში", value: <Money value={total} currency /> },
                { label: `აღებული (${paymentLabel(summary.method)})`, value: <Money value={paid} currency /> },
                ...(kind === "delivery" && debtAfter
                  ? [{ label: "დარჩენილი ვალი", value: <Money value={debtAfter} currency tone="debt" />, strong: true }]
                  : []),
              ]}
            />
            {kind === "delivery" ? (
              <p className="text-xs">საწყობიდან ჩამოიწერება {computed.length} პროდუქტი.</p>
            ) : (
              <p className="text-xs">მარაგი და სალარო შეიცვლება მხოლოდ შეკვეთის დასრულებისას.</p>
            )}
          </>
        }
        cancelLabel="უკან"
        confirmLabel={kind === "delivery" ? "დიახ, ჩახურვა" : "შენახვა"}
        pending={pending}
        onConfirm={save}
      />
    </div>
  );
}
