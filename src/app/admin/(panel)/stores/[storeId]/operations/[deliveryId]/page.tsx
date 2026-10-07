import { CheckCircle2, ClipboardList, Pencil, Wallet } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DeleteOperationButton } from "@/features/sales/components/delete-operation-button";
import { OPERATION_KIND_LABEL, operationKind, UPLOAD_STATUS_LABEL } from "@/features/sales/labels";
import { leftoverValue, paymentLabel } from "@/features/sales/logic";
import { getOperation } from "@/features/sales/queries";
import { formatDate, formatDateTime } from "@/lib/dates";
import { dec, formatAmount, formatDiscount, formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ოპერაცია" };

export default async function OperationPage({
  params,
  searchParams,
}: PageProps<"/admin/stores/[storeId]/operations/[deliveryId]">) {
  const { storeId, deliveryId } = await params;
  const { store, user } = await requireStore(storeId);
  const op = await getOperation(store.id, Number(deliveryId));
  if (!op) notFound();
  const sp = await searchParams;
  const { delivery: d, customer, items } = op;
  const kind = operationKind({ kind: d.kind, total: d.totalAmount, paid: d.paidAmount });
  const debtBefore = dec(op.debtAfter).minus(d.totalAmount).plus(d.paidAmount).minus(d.adjustmentAmount);
  const factor = d.discountFactor ? dec(d.discountFactor) : dec(1);
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
                hasLinkedCash={op.cash.length > 0}
                paid={d.paidAmount}
              />
            ) : null}
          </>
        }
      />

      {notice ? (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success print:hidden">
          <CheckCircle2 className="size-4" />
          {notice}
        </div>
      ) : null}

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
        ) : (
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
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      პროდუქცია არ არის — მხოლოდ თანხის მიღება.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((i) => {
                    // Old view painted the price red when it differed from the product's current price.
                    const expected = dec(i.currentPrice).times(factor);
                    const differs = !dec(i.unitPrice).equals(expected) && !dec(i.unitPrice).equals(i.currentPrice);
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">
                          {i.name}
                          {i.productArchived ? <span className="ml-2 text-xs text-muted-foreground">(არქივი)</span> : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {differs ? (
                            <Tooltip>
                              <TooltipTrigger className="cursor-help text-warning underline decoration-dotted underline-offset-4">
                                {formatAmount(i.unitPrice)}
                              </TooltipTrigger>
                              <TooltipContent>მიმდინარე ფასი: {formatAmount(i.currentPrice)} ₾</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Money value={i.unitPrice} />
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatQty(i.quantity)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatQty(i.leftoverQty)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatQty(i.quantity - i.leftoverQty)}</TableCell>
                        <TableCell className="text-right tabular-nums">{i.giftQty ? formatQty(i.giftQty) : "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          <Money value={i.lineTotal} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {items.length ? (
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={2}>ჯამში</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatQty(items.reduce((a, i) => a + i.quantity, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatQty(items.reduce((a, i) => a + i.leftoverQty, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatQty(items.reduce((a, i) => a + i.quantity - i.leftoverQty, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatQty(items.reduce((a, i) => a + i.giftQty, 0))}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <Money value={d.totalAmount} currency />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
        )}

        <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ინფორმაცია</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2.5 text-sm">
                <Row label="სულ ჯამში">
                  <Money value={d.totalAmount} currency className="font-semibold" />
                </Row>
                <Row label="აღებული თანხა">
                  <Money value={d.paidAmount} currency />
                </Row>
                <Row label="გადახდის მეთოდი">{d.kind === "adjustment" ? "—" : paymentLabel(d.paymentMethod)}</Row>
                <Row label="წინა ვალი">
                  <Money value={debtBefore} tone="debt" />
                </Row>
                <Row label="დარჩენილი">
                  <Money value={op.debtAfter} currency tone="debt" className="text-base font-semibold" />
                </Row>
                {!dec(d.adjustmentAmount).isZero() && d.kind === "delivery" ? (
                  <Row label="კორექტირება (ძველი სისტემიდან)">
                    <Money value={d.adjustmentAmount} />
                  </Row>
                ) : null}
                <Row label="ზედნადები">{d.hasWaybill === null ? "—" : d.hasWaybill ? "კი" : "არა"}</Row>
                <Row label="ფასდაკლება">{formatDiscount(d.discountFactor) || "არა"}</Row>
                {d.uploadStatus ? <Row label="სტატუსი (RS)">{UPLOAD_STATUS_LABEL[d.uploadStatus]}</Row> : null}
                <Row label="ნაშთი (ღირებულება)">
                  <Money value={leftoverValue(items)} />
                </Row>
              </dl>
            </CardContent>
          </Card>

          {d.kind === "delivery" && d.comment ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">კომენტარი</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-line text-muted-foreground">{d.comment}</CardContent>
            </Card>
          ) : null}

          <div className="space-y-2 rounded-xl border bg-card/60 p-4 text-xs text-muted-foreground print:hidden">
            {op.cash.length ? (
              <p className="flex items-center gap-1.5">
                <Wallet className="size-3.5" />
                სალაროში: +{formatAmount(dec(op.cash[0].amountIn).minus(op.cash[0].amountOut))} ₾ ({formatDate(op.cash[0].date)})
              </p>
            ) : Number(d.paidAmount) !== 0 && d.paymentMethod !== "back" ? (
              <p className="flex items-center gap-1.5">
                <Wallet className="size-3.5" />
                სალაროს ჩანაწერი ძველ სისტემაშია (მიუბმელი).
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
