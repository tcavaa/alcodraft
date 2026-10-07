import { Boxes, PackageOpen, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ArchivedTabs } from "@/components/data/archived-tabs";
import { ParamSelect } from "@/components/data/param-select";
import { SearchInput } from "@/components/data/search-input";
import { SortableHead } from "@/components/data/sortable-head";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductRowMenu } from "@/features/products/components/product-row-menu";
import { countProducts, listProducts, listSupplierOptions } from "@/features/products/queries";
import { dec, formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { intParam, param, sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "პროდუქცია" };

const SORTS = ["name", "stock", "price", "purchase", "changed"] as const;

export default async function ProductsPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/products">) {
  const { storeId } = await params;
  const { store, user } = await requireStore(storeId);
  const sp = await searchParams;
  const archived = param(sp, "archived") === "1";
  const supplierId = intParam(sp, "supplier");
  const [list, counts, suppliers] = await Promise.all([
    listProducts(store.id, { q: param(sp, "q"), archived, supplierId }),
    countProducts(store.id),
    listSupplierOptions(store.id),
  ]);
  const rows = sortRows(list, sortParam(sp, SORTS), {
    name: (p) => p.name,
    stock: (p) => p.stockQty,
    price: (p) => dec(p.salePrice),
    purchase: (p) => dec(p.purchasePrice),
    changed: (p) => p.priceChanged,
  });
  const pathname = storeHref(store.id, "products");
  const totalStock = rows.reduce((a, r) => a + r.stockQty, 0);

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="პროდუქცია"
        description="ფასები, შემოტანის ფასები და მარაგი საწყობში."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={storeHref(store.id, "stock")}>
                <PackageOpen />
                საწყობი
              </Link>
            </Button>
            <Button asChild>
              <Link href={storeHref(store.id, "products/new")}>
                <Plus />
                ახალი პროდუქტი
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput placeholder="ჩაწერე დასახელება…" />
          <ArchivedTabs pathname={pathname} searchParams={sp} archived={archived} counts={counts} />
        </div>
        <ParamSelect
          param="supplier"
          value={supplierId ? String(supplierId) : "all"}
          label="მომწოდებელი"
          className="w-64"
          options={[{ value: "all", label: "ყველა" }, ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={Boxes} title="პროდუქცია ვერ მოიძებნა" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <SortableHead column="name">დასახელება</SortableHead>
                <SortableHead column="stock" className="text-right">
                  რაოდენობა
                </SortableHead>
                <SortableHead column="price" className="text-right">
                  ფასი
                </SortableHead>
                <SortableHead column="purchase" className="text-right">
                  შემოტანის ფასი
                </SortableHead>
                <SortableHead column="changed" first="desc" className="hidden text-center md:table-cell">
                  ცვლილება
                </SortableHead>
                <TableHead className="w-10" />
              </HeadRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link href={storeHref(store.id, `products/${p.id}`)} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.supplierName ? <div className="text-xs text-muted-foreground">{p.supplierName}</div> : null}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium tabular-nums", p.stockQty <= 0 && "text-destructive")}>
                    {formatQty(p.stockQty)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={p.salePrice} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <Money value={p.purchasePrice} />
                  </TableCell>
                  <TableCell className="hidden text-center md:table-cell">
                    {p.priceChanged ? <Badge variant="secondary">კი</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <ProductRowMenu
                      storeId={store.id}
                      productId={p.id}
                      name={p.name}
                      archived={archived}
                      canDelete={user.role === "super_admin"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>{rows.length} პროდუქტი</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatQty(totalStock)}</TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}
    </>
  );
}
