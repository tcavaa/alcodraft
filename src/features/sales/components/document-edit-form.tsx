"use client";

import { Ban, PackageCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog, ConfirmFigures } from "@/components/confirm-dialog";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/hooks/use-server-action";
import { parseQty } from "@/lib/grid-nav";
import { type Decimal, dec, formatAmount, formatDiscount, parseAmount } from "@/lib/money";

import { cancelOrderAction, completeOrderAction, updateDeliveryAction, updateOrderAction } from "../actions";
import {
  type EditedLine,
  groupStoredLines,
  leftoverValue,
  type PaymentMethod,
  paymentLabel,
  planLineEdit,
  type StoredLine,
  rediscountPrice,
  totalOf,
} from "../logic";
import type { ProductOption } from "../queries";
import { firstInvalidLine, type LineState, lineHasValues, LinesEditor, useDocumentLines } from "./lines-editor";
import { SummaryPanel, type SummaryValues } from "./summary-panel";

type Confirming = "save" | "complete" | "cancel" | null;

/**
 * Edit an operation or an open order. Prices are final per line (old orders/edit); products that
 * are not on the document yet can be added with the document's discount. An open order's discount
 * can be changed: every line's price moves to the new discount (`rediscountPrice`). Products the user
 * doesn't touch keep their saved rows (see `planLineEdit`), so the total shown here is exactly
 * what will be saved. An open order is also completed or cancelled from here, so completion
 * always uses what is on the screen.
 */
export function DocumentEditForm({
  storeId,
  kind,
  documentId,
  products,
  storedLines,
  storedTotal,
  discountFactor,
  initial,
  previousDebt,
  adjustment,
  order,
}: {
  storeId: number;
  kind: "delivery" | "order";
  documentId: number;
  products: ProductOption[];
  /** The document's saved rows (several rows per product are possible in imported data). */
  storedLines: StoredLine[];
  storedTotal: string;
  discountFactor: string | null;
  initial: {
    paid: string;
    method: PaymentMethod | null;
    hasWaybill: boolean | null;
    uploadStatus: "pending" | "uploaded" | null;
    comment: string;
  };
  /** Operations: the customer's debt right before this document. Orders: the current debt. */
  previousDebt: string | null;
  /** Operations: an imported operation's old manual debt correction (stays as it is). */
  adjustment?: string;
  /** Open orders only. */
  order?: { number: number };
}) {
  // numeric(6,4) comes back as "0.8500"; normalise so it matches the discount options ("0.85").
  const factor = discountFactor ? dec(discountFactor).toString() : "1";
  const views = groupStoredLines(storedLines);

  const initialSummary: SummaryValues = {
    discountFactor: factor,
    paid: dec(initial.paid).toString(),
    method: initial.method,
    hasWaybill: initial.hasWaybill,
    uploadStatus: initial.uploadStatus,
    comment: initial.comment,
  };
  const [summary, setSummary] = useState<SummaryValues>(initialSummary);
  const discountEditable = kind === "order" && !dec(factor).isZero();

  const initialLine = (p: ProductOption): LineState => {
    const v = views.get(p.id);
    if (!v) {
      const price = dec(p.salePrice).times(summary.discountFactor).toDecimalPlaces(4).toString();
      return { price, quantity: "", giftQty: "", leftoverQty: "" };
    }
    const qty = (n: number) => (n ? String(n) : "");
    return { price: v.unitPrice.toString(), quantity: qty(v.quantity), giftQty: qty(v.giftQty), leftoverQty: qty(v.leftoverQty) };
  };
  const { lineOf, setField, mapLines } = useDocumentLines(products, initialLine);
  // Products already on the document first (old edit listed them by quantity), then the rest.
  const ordered = [...products].sort((a, b) => Number(views.has(b.id)) - Number(views.has(a.id)));

  const changeSummary = (patch: Partial<SummaryValues>) => {
    const from = summary.discountFactor;
    const to = patch.discountFactor;
    if (to !== undefined && to !== from) {
      // A price that isn't a number yet stays as typed; validation points at it.
      mapLines((l) => {
        const price = parseAmount(l.price);
        return price ? { ...l, price: rediscountPrice(price, from, to).toString() } : l;
      });
    }
    setSummary((s) => ({ ...s, ...patch }));
  };
  const [confirming, setConfirming] = useState<Confirming>(null);
  const { run, pending, errors, setErrors } = useServerAction();

  // Everything on the document plus everything filled: what the form saves.
  const editedProducts = ordered.filter((p) => views.has(p.id) || lineHasValues(lineOf(p)));
  const edited: EditedLine[] = editedProducts.map((p) => {
    const l = lineOf(p);
    return {
      productId: p.id,
      unitPrice: parseAmount(l.price) ?? views.get(p.id)?.unitPrice ?? 0,
      quantity: parseQty(l.quantity) ?? 0,
      giftQty: parseQty(l.giftQty) ?? 0,
      leftoverQty: parseQty(l.leftoverQty) ?? 0,
    };
  });
  const plan = planLineEdit(storedLines, edited, storedTotal);
  const resulting = [...plan.keep, ...plan.add];
  // Untouched products show their saved line totals (imported ones may differ from price × qty).
  const savedTotals = new Map<number, Decimal>();
  for (const r of plan.keep) savedTotals.set(r.productId, (savedTotals.get(r.productId) ?? dec(0)).plus(dec(r.lineTotal)));
  const total = plan.total;
  const paid = parseAmount(summary.paid || "0") ?? dec(0);
  const debtAfter = previousDebt !== null ? dec(previousDebt).plus(total).minus(paid).plus(dec(adjustment ?? 0)) : null;
  const oldDifference = dec(storedTotal).minus(totalOf(storedLines));

  const dirty =
    plan.remove.length > 0 ||
    plan.add.length > 0 ||
    !paid.equals(dec(initial.paid)) ||
    summary.method !== initialSummary.method ||
    summary.hasWaybill !== initialSummary.hasWaybill ||
    (kind === "order" && summary.uploadStatus !== initialSummary.uploadStatus) ||
    summary.comment !== initialSummary.comment ||
    summary.discountFactor !== initialSummary.discountFactor;

  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);

  const validate = () => {
    const next: Record<string, string> = {};
    const bad = firstInvalidLine(ordered, lineOf);
    if (bad) next._form = `შეასწორეთ ველები: ${bad.name}`;
    if (summary.paid !== "" && !parseAmount(summary.paid)) next.paidAmount = "არასწორი თანხა";
    if (kind === "delivery") {
      if (resulting.length === 0 && paid.isZero()) next._form = "შეიყვანეთ რაოდენობა ან აღებული თანხა.";
      // Same rule as a new operation, for what the edit delivers on top of the saved one.
      const increase = new Map<number, number>();
      for (const r of plan.remove) increase.set(r.productId, (increase.get(r.productId) ?? 0) - r.quantity);
      for (const l of plan.add) increase.set(l.productId, (increase.get(l.productId) ?? 0) + l.quantity);
      const over = ordered.find((p) => (increase.get(p.id) ?? 0) > Math.max(p.stockQty, 0));
      if (over) next._form = `${over.name}: დამატებული რაოდენობა აღემატება მარაგს (${over.stockQty}).`;
    } else if (resulting.length === 0) {
      next._form = "შეკვეთაში არცერთი პროდუქტი არ არის.";
    }
    setErrors(next);
    if (Object.keys(next).length) toast.error("შეასწორეთ შეცდომები");
    return Object.keys(next).length === 0;
  };

  const payload = () => ({
    lines: editedProducts.map((p) => {
      const l = lineOf(p);
      return {
        productId: p.id,
        unitPrice: l.price.trim() || views.get(p.id)?.unitPrice.toString() || "0",
        quantity: l.quantity || "0",
        giftQty: l.giftQty || "0",
        leftoverQty: l.leftoverQty || "0",
      };
    }),
    paidAmount: summary.paid,
    paymentMethod: summary.method,
    hasWaybill: summary.hasWaybill,
    comment: summary.comment,
  });

  // Only a changed discount is sent: imported orders can carry a factor that isn't one of the options.
  const orderPayload = () => ({
    ...payload(),
    uploadStatus: summary.uploadStatus,
    ...(summary.discountFactor !== initialSummary.discountFactor ? { discountFactor: summary.discountFactor } : {}),
  });

  const save = () =>
    run(
      () =>
        kind === "delivery"
          ? updateDeliveryAction(storeId, documentId, payload())
          : updateOrderAction(storeId, documentId, orderPayload()),
      { onSuccess: () => setConfirming(null), onError: () => setConfirming(null) },
    );

  const askComplete = () => {
    if (dirty && !validate()) return;
    if (summary.method === null && !paid.isZero()) {
      setErrors({ paymentMethod: "აირჩიეთ გადახდის მეთოდი — თანხა სალაროში უნდა ჩაიწეროს." });
      return;
    }
    setConfirming("complete");
  };
  const complete = () =>
    run(
      () =>
        completeOrderAction(storeId, documentId, dirty ? orderPayload() : null),
      { onError: () => setConfirming(null) },
    );
  const cancel = () => run(() => cancelOrderAction(storeId, documentId), { onSuccess: () => setConfirming(null) });

  // Order completion takes goods without a stock check (old app) — warn about what goes negative.
  const taking = new Map<number, number>();
  for (const l of resulting) taking.set(l.productId, (taking.get(l.productId) ?? 0) + l.quantity + l.giftQty);
  const shortStock = ordered.filter((p) => (taking.get(p.id) ?? 0) > p.stockQty).map((p) => p.name);

  const discountLabel = (f: string) => formatDiscount(f) || "არა";
  const figures = [
    ...(summary.discountFactor !== initialSummary.discountFactor
      ? [
          {
            label: "ფასდაკლება",
            value: `${discountLabel(initialSummary.discountFactor)} → ${discountLabel(summary.discountFactor)}`,
          },
        ]
      : []),
    {
      label: "სულ ჯამში",
      value: total.equals(dec(storedTotal)) ? (
        <Money value={total} currency />
      ) : (
        <>
          <Money value={storedTotal} /> → <Money value={total} currency />
        </>
      ),
    },
    {
      label: `აღებული (${paymentLabel(summary.method)})`,
      value: paid.equals(dec(initial.paid)) ? (
        <Money value={paid} currency />
      ) : (
        <>
          <Money value={initial.paid} /> → <Money value={paid} currency />
        </>
      ),
    },
    ...(debtAfter
      ? [
          {
            label: kind === "delivery" ? "დარჩენილი ვალი" : "ვალი დასრულების შემდეგ",
            value: <Money value={debtAfter} currency tone="debt" />,
            strong: true,
          },
        ]
      : []),
  ];

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0">
        <LinesEditor
          products={ordered}
          lineOf={lineOf}
          onChange={setField}
          mode="final"
          discountFactor={summary.discountFactor}
          stockMode={kind === "order" ? "warn" : "off"}
          savedTotals={savedTotals}
          onlyFilledAtStart={kind === "order"}
        />
      </div>
      <div className="xl:sticky xl:top-20">
        <SummaryPanel
          values={summary}
          onChange={changeSummary}
          total={total}
          lineCount={new Set(resulting.map((l) => l.productId)).size}
          quantity={resulting.reduce((a, l) => a + l.quantity, 0)}
          gifts={resulting.reduce((a, l) => a + l.giftQty, 0)}
          leftoverValue={leftoverValue(resulting)}
          previousDebt={previousDebt}
          adjustment={adjustment}
          discountEditable={discountEditable}
          showUploadStatus={kind === "order"}
          submitLabel="ცვლილებების შენახვა"
          onSubmit={() => {
            if (!dirty) toast.info("ცვლილებები არ არის.");
            else if (validate()) setConfirming("save");
          }}
          pending={pending}
          errors={errors}
          totalNote={
            oldDifference.isZero()
              ? undefined
              : `ძველი სისტემის სხვაობა ჯამში (${formatAmount(oldDifference)} ₾) შენარჩუნდება.`
          }
          footer={
            order ? (
              <div className="grid gap-2 border-t pt-4">
                <Button variant="secondary" className="w-full" onClick={askComplete} disabled={pending}>
                  <PackageCheck />
                  {dirty ? "შენახვა და დასრულება" : "შეკვეთის დასრულება"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirming("cancel")}
                  disabled={pending}
                >
                  <Ban />
                  შეკვეთის გაუქმება
                </Button>
              </div>
            ) : null
          }
        />
      </div>

      <ConfirmDialog
        open={confirming === "save"}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="ცვლილებების შენახვა?"
        description={
          <>
            <ConfirmFigures rows={figures} />
            <p className="text-xs">
              {kind === "delivery"
                ? "საწყობი, ობიექტის ვალი (ამ და შემდეგი ოპერაციების) და სალარო ავტომატურად გადაითვლება."
                : "მარაგი და სალარო შეიცვლება მხოლოდ შეკვეთის დასრულებისას."}
            </p>
          </>
        }
        confirmLabel="შენახვა"
        cancelLabel="უკან"
        pending={pending}
        onConfirm={save}
      />

      {order ? (
        <>
          <ConfirmDialog
            open={confirming === "complete"}
            onOpenChange={(o) => !o && setConfirming(null)}
            title={`შეკვეთა #${order.number} — დასრულება?`}
            description={
              <>
                <p>შეიქმნება ოპერაცია: პროდუქცია ჩამოიწერება საწყობიდან, თანხა ჩაიწერება სალაროში და ობიექტის ვალი განახლდება.</p>
                {dirty ? <p className="font-medium text-foreground">ეკრანზე არსებული ცვლილებებიც შეინახება.</p> : null}
                <ConfirmFigures rows={figures} />
                {shortStock.length ? (
                  <p className="text-warning">მარაგი არასაკმარისია: {shortStock.join(", ")} — მარაგი გახდება უარყოფითი.</p>
                ) : null}
              </>
            }
            confirmLabel={dirty ? "შენახვა და დასრულება" : "დასრულება"}
            pending={pending}
            onConfirm={complete}
          />
          <ConfirmDialog
            open={confirming === "cancel"}
            onOpenChange={(o) => !o && setConfirming(null)}
            title={`შეკვეთა #${order.number} — გაუქმება?`}
            description={
              <>
                <p>შეკვეთა გადავა ისტორიაში გაუქმებულის სტატუსით. მარაგი და სალარო არ იცვლება.</p>
                {dirty ? <p className="text-warning">შეუნახავი ცვლილებები დაიკარგება.</p> : null}
              </>
            }
            confirmLabel="გაუქმება"
            cancelLabel="უკან"
            destructive
            pending={pending}
            onConfirm={cancel}
          />
        </>
      ) : null}
    </div>
  );
}
