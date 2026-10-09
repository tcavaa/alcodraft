import { ClipboardList, PackageOpen, Pencil, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentLinesTable, sortLineRows } from "@/components/data/document-lines-table";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { InfoList, InfoRow } from "@/components/info-list";
import { Money } from "@/components/money";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteOperationButton } from "@/features/sales/components/delete-operation-button";
import { hasNoPayment, OPERATION_KIND_LABEL, operationKind, UPLOAD_STATUS_LABEL } from "@/features/sales/labels";
import { leftoverValue, paymentLabel } from "@/features/sales/logic";
import { getOperation } from "@/features/sales/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { dec, formatAmount, formatDiscount, formatQty, type Numeric, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { idParam, param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ოპერაცია" };

export default async function OperationPage({
  params,
  searchParams,
}: PageProps<"/admin/stores/[storeId]/operations/[deliveryId]">) {
  const { storeId, deliveryId } = await params;
  const { store, user } = await requireStore(storeId);
  const op = await getOperation(store.id, idParam(deliveryId));
  if (!op) notFound();
  const sp = await searchParams;
  const { delivery: d, customer } = op;
  const factor = d.discountFactor ? dec(d.discountFactor) : dec(1);
  const rows = sortLineRows(
    op.items.map((i) => {
      // Old view painted the price red when it differed from the product's current price.
      const expected = dec(i.currentPrice).times(factor);
      const differs = !dec(i.unitPrice).equals(expected) && !dec(i.unitPrice).equals(i.currentPrice);
      return {
        key: i.id,
        name: i.name,
        nameExtra: i.productArchived ? <span className="ml-2 text-xs text-muted-foreground">(არქივი)</span> : null,
        unitPrice: i.unitPrice,
        priceCell: differs ? (
          <Tooltip>
            <TooltipTrigger className="cursor-help text-warning underline decoration-dotted underline-offset-4">
              {formatAmount(i.unitPrice)}
            </TooltipTrigger>
            <TooltipContent>მიმდინარე ფასი: {formatAmount(i.currentPrice)} ₾</TooltipContent>
          </Tooltip>
        ) : undefined,
        quantity: i.quantity,
        leftover: i.leftoverQty,
        gift: i.giftQty,
        total: i.lineTotal,
      };
    }),
    sp,
  );
  const kind = operationKind({ kind: d.kind, total: d.totalAmount, paid: d.paidAmount });
  const debtBefore = dec(op.debtAfter).minus(d.totalAmount).plus(d.paidAmount).minus(d.adjustmentAmount);
  const cash = op.cash[0] ? dec(op.cash[0].amountIn).minus(op.cash[0].amountOut) : null;
  const notice = param(sp, "created")
    ? "ოპერაცია შენახულია."
    : param(sp, "fromOrder")
      ? "შეკვეთა დასრულდა — შეიქმნა ოპერაცია."
      : param(sp, "updated")
        ? "ცვლილებები შენახულია."
        : null;

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, `customers/${customer.id}`), label: customer.name }}
        eyebrow={store.name}
        title={
          <span className="flex items-center gap-3">
            ოპერაცია #{d.number}
            {kind !== "delivery" ? <Badge variant="secondary">{OPERATION_KIND_LABEL[kind]}</Badge> : null}
          </span>
        }
        description={
          <>
            {formatDate(d.deliveryDate)} ·{" "}
            <Link href={storeHref(store.id, `customers/${customer.id}`)} className="font-medium text-foreground hover:underline">
              {customer.name}
            </Link>
            {customer.address ? ` · ${customer.address}` : ""}
          </>
        }
        actions={
          <>
            <PrintButton />
            {d.kind === "delivery" ? (
              <Button variant="outline" asChild className="print:hidden">
                <Link href={storeHref(store.id, `operations/${d.id}/edit`)}>
                  <Pencil />
                  რედაქტირება
                </Link>
              </Button>
            ) : null}
            {user.role === "super_admin" ? (
              <DeleteOperationButton
                storeId={store.id}
                deliveryId={d.id}
                customerId={customer.id}
                number={d.number}
                kind={d.kind}
                hasLinkedCash={op.cash.length > 0}
                total={d.totalAmount}
                paid={d.paidAmount}
                adjustment={d.adjustmentAmount}
              />
            ) : null}
          </>
        }
      />

      {notice ? <Notice>{notice}</Notice> : null}

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        {d.kind === "adjustment" ? (
          <Card>
            <CardHeader>
              <CardTitle>ვალის კორექტირება</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="text-3xl font-semibold">
                {dec(d.adjustmentAmount).isPositive() ? "+" : ""}
                <Money value={d.adjustmentAmount} currency />
              </div>
              <p className="whitespace-pre-line text-muted-foreground">{d.comment || "მიზეზი არ არის მითითებული."}</p>
            </CardContent>
          </Card>
        ) : d.kind === "count" ? (
          <SimpleLinesTable
            qtyLabel="ნაშთი"
            totalLabel="ღირებულება"
            rows={op.items.map((i) => ({ key: i.id, name: i.name, unitPrice: i.unitPrice, quantity: i.leftoverQty }))}
            empty="ნაშთი არ დარჩა — ყველა პროდუქტი 0."
          />
        ) : d.kind === "return" ? (
          <SimpleLinesTable
            qtyLabel="გამოტანილი"
            totalLabel="ჯამი"
            rows={(op.returnReceipt?.items ?? []).map((i) => ({ key: i.id, name: i.name, unitPrice: i.unitPrice, quantity: i.quantity }))}
            empty="პროდუქცია არ არის."
          />
        ) : (
          <DocumentLinesTable rows={rows} total={d.totalAmount} empty="პროდუქცია არ არის — მხოლოდ თანხის მიღება." />
        )}

        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ინფორმაცია</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoList>
                <InfoRow label="სულ ჯამში">
                  <Money value={d.totalAmount} currency className="font-semibold" />
                </InfoRow>
                <InfoRow label="აღებული თანხა">
                  <Money value={d.paidAmount} currency />
                </InfoRow>
                <InfoRow label="გადახდის მეთოდი">{hasNoPayment(kind) ? "—" : paymentLabel(d.paymentMethod)}</InfoRow>
                <InfoRow label="წინა ვალი">
                  <Money value={debtBefore} tone="debt" />
                </InfoRow>
                <InfoRow label="დარჩენილი">
                  <Money value={op.debtAfter} currency tone="debt" className="text-base font-semibold" />
                </InfoRow>
                {!dec(d.adjustmentAmount).isZero() && d.kind === "delivery" ? (
                  <InfoRow label="კორექტირება (ძველი სისტემიდან)">
                    <Money value={d.adjustmentAmount} />
                  </InfoRow>
                ) : null}
                <InfoRow label="ზედნადები">{d.hasWaybill === null ? "—" : d.hasWaybill ? "კი" : "არა"}</InfoRow>
                <InfoRow label="ფასდაკლება">{formatDiscount(d.discountFactor) || "არა"}</InfoRow>
                {d.uploadStatus ? <InfoRow label="სტატუსი (RS)">{UPLOAD_STATUS_LABEL[d.uploadStatus]}</InfoRow> : null}
                <InfoRow label="ნაშთი (ღირებულება)">
                  <Money value={leftoverValue(op.items)} />
                </InfoRow>
              </InfoList>
            </CardContent>
          </Card>

          {d.kind !== "adjustment" && d.comment ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">კომენტარი</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line text-muted-foreground">{d.comment}</CardContent>
            </Card>
          ) : null}

          <div className="space-y-2 rounded-xl border bg-card/60 p-4 text-xs text-muted-foreground print:hidden">
            {cash ? (
              <p className="flex items-center gap-1.5">
                <Wallet className="size-3.5" />
                სალაროში: {cash.isNegative() ? "" : "+"}
                {formatAmount(cash)} ₾ ({formatDate(op.cash[0].date)})
              </p>
            ) : !dec(d.paidAmount).isZero() && d.paymentMethod !== "back" ? (
              <p className="flex items-center gap-1.5">
                <Wallet className="size-3.5" />
                სალაროს ჩანაწერი ძველ სისტემაშია (მიუბმელი).
              </p>
            ) : null}
            {op.returnReceipt ? (
              <p className="flex items-center gap-1.5">
                <PackageOpen className="size-3.5" />
                საწყობში შევიდა:{" "}
                <Link href={storeHref(store.id, `stock/${op.returnReceipt.id}`)} className="underline underline-offset-2">
                  მიღება #{op.returnReceipt.number}
                </Link>
              </p>
            ) : null}
            {op.order ? (
              <p className="flex items-center gap-1.5">
                <ClipboardList className="size-3.5" />
                შეიქმნა{" "}
                <Link href={storeHref(store.id, `orders/${op.order.id}`)} className="underline underline-offset-2">
                  შეკვეთა #{op.order.number}
                </Link>
                -დან
              </p>
            ) : null}
            <p>
              {d.createdById
                ? `${op.createdBy || op.createdByEmail || "მომხმარებელი"} · ${formatDateTime(d.createdAt)}`
                : "გადმოტანილია ძველი სისტემიდან"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/** Lines of a count („ნაშთი“) or a return („გამოტანილი“): name, price, quantity, price × quantity. */
function SimpleLinesTable({
  rows,
  qtyLabel,
  totalLabel,
  empty,
}: {
  rows: { key: number; name: string; unitPrice: Numeric; quantity: number }[];
  qtyLabel: string;
  totalLabel: string;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  const lineTotal = (r: (typeof rows)[number]) => dec(r.unitPrice).times(r.quantity);
  return (
    <TableCard>
      <Table>
        <TableHeader>
          <HeadRow>
            <TableHead>დასახელება</TableHead>
            <TableHead className="text-right">ფასი</TableHead>
            <TableHead className="text-right">{qtyLabel}</TableHead>
            <TableHead className="text-right">{totalLabel}</TableHead>
          </HeadRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-right">
                <Money value={r.unitPrice} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(r.quantity)}</TableCell>
              <TableCell className="text-right">
                <Money value={lineTotal(r)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2}>სულ</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">
              {formatQty(rows.reduce((a, r) => a + r.quantity, 0))}
            </TableCell>
            <TableCell className="text-right font-semibold">
              <Money value={sum(rows.map(lineTotal))} currency />
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </TableCard>
  );
}
