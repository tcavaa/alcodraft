import { Archive, ArrowDownLeft, ArrowUpRight, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SortableHead } from "@/components/data/sortable-head";
import { Money } from "@/components/money";
import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { updateProductAction } from "@/features/products/actions";
import { ProductForm } from "@/features/products/components/product-form";
import { ProductRowMenu } from "@/features/products/components/product-row-menu";
import { StockAdjustDialog } from "@/features/products/components/stock-adjust-dialog";
import { getProduct, listSupplierOptions } from "@/features/products/queries";
import { formatDate } from "@/lib/dates";
import { dec, formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { idParam, param, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "პროდუქტი" };

export default async function ProductPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/products/[productId]">) {
  const { storeId, productId } = await params;
  const { store, user } = await requireStore(storeId);
  const [data, suppliers] = await Promise.all([getProduct(store.id, idParam(productId)), listSupplierOptions(store.id)]);
  if (!data) notFound();
  const sp = await searchParams;
  const { product: p, movements } = data;
  // Price history: the price after each change (old → new; a change of only the other price keeps it).
  const priceChanges = sortRows(data.priceChanges, sortParam(sp, ["date", "price", "purchase"] as const, "hsort"), {
    date: (c) => c.changedOn,
    price: (c) => dec(c.newSalePrice ?? c.oldSalePrice),
    purchase: (c) => dec(c.newPurchasePrice ?? c.oldPurchasePrice),
  });

  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "products"), label: "პროდუქცია" }}
        eyebrow={store.name}
        title={
          <span className="flex items-center gap-2">
            {p.name}
            {p.isArchived ? (
              <Badge variant="secondary" className="gap-1">
                <Archive className="size-3" /> სანაგვეში
              </Badge>
            ) : !p.isActive ? (
              <Badge variant="outline">არააქტიური</Badge>
            ) : null}
          </span>
        }
        description={data.supplierName ?? "მომწოდებლის გარეშე"}
        actions={
          <ProductRowMenu storeId={store.id} productId={p.id} name={p.name} archived={p.isArchived} active={p.isActive} canDelete={user.role === "super_admin"} />
        }
      />
      {param(sp, "created") ? <Notice>პროდუქტი დაემატა. მარაგის დასამატებლად გამოიყენეთ „მიღება“.</Notice> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>მონაცემები</CardTitle>
            <CardDescription>ფასის შეცვლისას ძველი ფასები ინახება ცვლილების ისტორიაში.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* No remount after saving: the fields keep the saved values and the "saved" toast can show. */}
            <ProductForm
              action={updateProductAction.bind(null, store.id, p.id)}
              suppliers={suppliers}
              defaults={p}
              submitLabel="შეცვლა"
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardDescription>მარაგი საწყობში</CardDescription>
                <CardTitle className={cn("text-3xl tabular-nums", p.stockQty <= 0 && "text-destructive")}>{formatQty(p.stockQty)}</CardTitle>
              </div>
              <StockAdjustDialog storeId={store.id} productId={p.id} current={p.stockQty} />
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">შეცვლის ისტორია</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {priceChanges.length === 0 ? (
                <p className="px-6 text-sm text-muted-foreground">ფასი არ შეცვლილა.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHead param="hsort" column="date" first="desc" className="pl-6">
                        თარიღი
                      </SortableHead>
                      <SortableHead param="hsort" column="price" className="text-right">
                        ფასი
                      </SortableHead>
                      <SortableHead param="hsort" column="purchase" className="pr-6 text-right">
                        შემოტანის ფასი
                      </SortableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceChanges.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="pl-6">
                          {formatDate(c.changedOn)}
                          {c.by ? <div className="text-xs text-muted-foreground">{c.by}</div> : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Money value={c.oldSalePrice} />
                          {c.newSalePrice ? (
                            <span className="text-muted-foreground">
                              {" "}
                              → <Money value={c.newSalePrice} />
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Money value={c.oldPurchasePrice} />
                          {c.newPurchasePrice ? (
                            <span className="text-muted-foreground">
                              {" "}
                              → <Money value={c.newPurchasePrice} />
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">მარაგის მოძრაობა</CardTitle>
          <CardDescription>ბოლო მიღებები, ოპერაციები და შესწორებები</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {movements.length === 0 ? (
            <p className="px-6 text-sm text-muted-foreground">მოძრაობა არ ყოფილა.</p>
          ) : (
            <Table>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={`${m.kind}-${m.refId}`}>
                    <TableCell className="w-32 pl-6 text-muted-foreground">{formatDate(m.date)}</TableCell>
                    <TableCell>
                      {m.kind === "receipt" ? (
                        <Link href={storeHref(store.id, `stock/${m.refId}`)} className="inline-flex items-center gap-1.5 hover:underline">
                          <ArrowDownLeft className="size-4 text-success" /> მიღება #{m.number}
                          {m.label ? <span className="text-muted-foreground">· {m.label}</span> : null}
                        </Link>
                      ) : m.kind === "delivery" ? (
                        <Link href={storeHref(store.id, `operations/${m.refId}`)} className="inline-flex items-center gap-1.5 hover:underline">
                          <ArrowUpRight className="size-4 text-muted-foreground" /> ოპერაცია #{m.number}
                          <span className="text-muted-foreground">· {m.label}</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <SlidersHorizontal className="size-4 text-warning" /> შესწორება
                          <span className="text-muted-foreground">· {m.label}</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={cn("pr-6 text-right font-medium tabular-nums", m.delta > 0 ? "text-success" : m.delta < 0 ? "" : "text-muted-foreground")}>
                      {m.delta > 0 ? "+" : ""}
                      {formatQty(m.delta)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
