import { ArrowRight, PackageOpen, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ReceiptForm } from "@/features/stock/components/receipt-form";
import { listReceiveProducts } from "@/features/stock/queries";
import { listSupplierOptions } from "@/features/products/queries";
import { formatDate, todayIso } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { intParam, param } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "საწყობში მიღება" };

/** Old drinks/beforestock (choose supplier) + drinks/stock/{supplier} (the form). */
export default async function ReceivePage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/stock/receive">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const suppliers = (await listSupplierOptions(store.id)).filter((s) => !s.isArchived);
  const supplierId = intParam(sp, "supplier");
  const noSupplier = param(sp, "supplier") === "none";
  const supplier = suppliers.find((s) => s.id === supplierId) ?? null;

  if (!supplier && !noSupplier) {
    return (
      <>
        <PageHeader
          back={{ href: storeHref(store.id, "stock"), label: "საწყობი" }}
          eyebrow={store.name}
          title="საწყობში მიღება"
          description="აირჩიეთ მომწოდებელი."
        />
        {suppliers.length === 0 ? (
          <EmptyState icon={PackageOpen} title="მომწოდებლები არ არის" description="ჯერ დაამატეთ მომწოდებელი." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {suppliers.map((s) => (
              <Link
                key={s.id}
                href={`${storeHref(store.id, "stock/receive")}?supplier=${s.id}`}
                className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-gold/60"
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    {s.isReturns ? <Undo2 className="size-4" /> : <PackageOpen className="size-4" />}
                  </span>
                  <span className="font-medium">{s.name}</span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
            <Link
              href={`${storeHref(store.id, "stock/receive")}?supplier=none`}
              className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-card/50 p-4 text-muted-foreground transition-colors hover:border-gold/60"
            >
              მომწოდებლის გარეშე
              <ArrowRight className="size-4" />
            </Link>
          </div>
        )}
      </>
    );
  }

  const products = await listReceiveProducts(store.id);
  return (
    <>
      <PageHeader
        back={{ href: storeHref(store.id, "stock/receive"), label: "მომწოდებლის არჩევა" }}
        eyebrow={`${store.name} · ${formatDate(todayIso())}`}
        title={supplier ? `მიღება — ${supplier.name}` : "მიღება — მომწოდებლის გარეშე"}
        description="შეიყვანეთ შემოტანის ფასი და მიღებული რაოდენობა."
      />
      <ReceiptForm
        key={supplier?.id ?? "none"}
        storeId={store.id}
        supplier={supplier ? { id: supplier.id, name: supplier.name, isReturns: supplier.isReturns } : null}
        products={products}
      />
    </>
  );
}
