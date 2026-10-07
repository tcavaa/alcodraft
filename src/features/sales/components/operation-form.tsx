"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Money } from "@/components/money";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { dec, parseAmount } from "@/lib/money";

import { createDeliveryAction, createOrderAction } from "../actions";
import { computeLines, leftoverValue, paymentLabel, totalOf } from "../logic";
import type { CustomerOption, ProductOption } from "../queries";
import { CustomerPicker } from "./customer-picker";
import { lineHasValues, LinesEditor, type LinesState, parseQty } from "./lines-editor";
import { SummaryPanel, type SummaryValues } from "./summary-panel";

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
  const [lines, setLines] = useState<LinesState>(() =>
    Object.fromEntries(
      products.map((p) => [p.id, { price: dec(p.salePrice).toString(), quantity: "", giftQty: "", leftoverQty: "" }]),
    ),
  );
  const [summary, setSummary] = useState<SummaryValues>({
    discountFactor: "1",
    paid: "",
    method: "cash",
    hasWaybill: true,
    uploadStatus: "pending",
    comment: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const filled = useMemo(() => products.filter((p) => lineHasValues(lines[p.id])), [products, lines]);

  const computed = useMemo(
    () =>
      computeLines(
        filled.map((p) => ({
          productId: p.id,
          price: parseAmount(lines[p.id].price) ?? 0,
          quantity: parseQty(lines[p.id].quantity) ?? 0,
          giftQty: parseQty(lines[p.id].giftQty) ?? 0,
          leftoverQty: parseQty(lines[p.id].leftoverQty) ?? 0,
        })),
        summary.discountFactor,
      ),
    [filled, lines, summary.discountFactor],
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
    const badLine = products.find((p) => {
      const l = lines[p.id];
      return (
        parseQty(l.quantity) === null ||
        parseQty(l.giftQty) === null ||
        parseQty(l.leftoverQty) === null ||
        (parseQty(l.giftQty) ?? 0) < 0 ||
        (parseQty(l.leftoverQty) ?? 0) < 0 ||
        (lineHasValues(l) && !parseAmount(l.price))
      );
    });
    if (badLine) next._form = `შეასწორეთ ველები: ${badLine.name}`;
    if (summary.paid !== "" && !parseAmount(summary.paid)) next.paidAmount = "არასწორი თანხა";
    if (kind === "delivery") {
      const over = filled.find((p) => (parseQty(lines[p.id].quantity) ?? 0) > Math.max(p.stockQty, 0));
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

  const save = () =>
    startTransition(async () => {
      const payload = {
        customerId: customerId!,
        lines: filled.map((p) => ({
          productId: p.id,
          price: lines[p.id].price,
          quantity: lines[p.id].quantity || "0",
          giftQty: lines[p.id].giftQty || "0",
          leftoverQty: lines[p.id].leftoverQty || "0",
        })),
        discountFactor: summary.discountFactor,
        paidAmount: summary.paid,
        paymentMethod: summary.method,
        hasWaybill: summary.hasWaybill,
        comment: summary.comment,
      };
      const result =
        kind === "delivery"
          ? await createDeliveryAction(storeId, payload)
          : await createOrderAction(storeId, { ...payload, uploadStatus: summary.uploadStatus });
      if (result && !result.ok) {
        setErrors(result.fieldErrors ?? { _form: result.error });
        toast.error(result.error);
        setConfirming(false);
      }
    });

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
          lines={lines}
          onChange={(productId, field, value) =>
            setLines((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }))
          }
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

      <AlertDialog open={confirming} onOpenChange={(o) => !pending && setConfirming(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{kind === "delivery" ? "ნამდვილად გსურთ დღის ჩახურვა?" : "შეკვეთის შენახვა"}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="font-medium text-foreground">{customer?.name}</div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <dt>სულ ჯამში</dt>
                  <dd className="text-right">
                    <Money value={total} currency />
                  </dd>
                  <dt>აღებული ({paymentLabel(summary.method)})</dt>
                  <dd className="text-right">
                    <Money value={paid} currency />
                  </dd>
                  {kind === "delivery" && debtAfter ? (
                    <>
                      <dt>დარჩენილი ვალი</dt>
                      <dd className="text-right font-semibold text-foreground">
                        <Money value={debtAfter} currency tone="debt" />
                      </dd>
                    </>
                  ) : null}
                </dl>
                {kind === "delivery" ? (
                  <p className="text-xs">საწყობიდან ჩამოიწერება {computed.length} პროდუქტი.</p>
                ) : (
                  <p className="text-xs">მარაგი და სალარო შეიცვლება მხოლოდ შეკვეთის დასრულებისას.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>უკან</AlertDialogCancel>
            <Button onClick={save} disabled={pending}>
              {pending ? <Spinner /> : null}
              {kind === "delivery" ? "დიახ, ჩახურვა" : "შენახვა"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
