import { ArrowUpRight, ClipboardList, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { storeHref } from "@/components/layout/nav";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { StoreVisibilityButton } from "@/features/admin/components/store-visibility-button";
import { getHiddenStoreIds } from "@/features/admin/queries";
import { getStoreKpis, type StoreKpis } from "@/features/dashboard/queries";
import { formatDate, todayIso } from "@/lib/dates";
import { getMyStores, requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მიმოხილვა" };

export default async function OverviewPage() {
  const user = await requireUser();
  const [allStores, hiddenIds] = await Promise.all([getMyStores(), getHiddenStoreIds(user.id)]);
  const active = allStores.filter((s) => !s.isArchived);
  const hidden = new Set(hiddenIds);
  const stores = active.filter((s) => !hidden.has(s.id));
  const hiddenStores = active.filter((s) => hidden.has(s.id));
  const today = todayIso();
  const kpis = await getStoreKpis(
    stores.map((s) => s.id),
    today,
  );

  return (
    <>
      <PageHeader
        eyebrow={formatDate(today)}
        title={`გამარჯობა${user.name ? `, ${user.name}` : ""}`}
        description="ყველა მაღაზიის დღევანდელი მდგომარეობა ერთ ეკრანზე."
      />
      {active.length === 0 ? (
        <EmptyState
          icon={Store}
          title="მაღაზია არ გაქვთ მინიჭებული"
          description="მიმართეთ სუპერ ადმინს, რომ მოგანიჭოთ წვდომა."
        />
      ) : (
        <>
          {stores.length === 0 ? (
            <p className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
              ყველა მაღაზია დამალულია — აჩვენეთ ქვემოთ.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {stores.map((store) => (
                <StoreCard key={store.id} id={store.id} name={store.name} kpis={kpis.get(store.id)!} />
              ))}
            </div>
          )}
          {hiddenStores.length ? (
            <section className="mt-8">
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">დამალული მაღაზიები ({hiddenStores.length})</h2>
              <div className="divide-y rounded-xl border bg-card">
                {hiddenStores.map((store) => (
                  <div key={store.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link href={storeHref(store.id)} className="truncate text-sm font-medium hover:underline">
                      {store.name}
                    </Link>
                    <StoreVisibilityButton storeId={store.id} name={store.name} hidden />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function StoreCard({ id, name, kpis }: { id: number; name: string; kpis: StoreKpis }) {
  // The hide button sits on top of the card link (a button can't be inside a link).
  return (
    <div className="relative">
      <div className="absolute top-5 right-16 z-10">
        <StoreVisibilityButton storeId={id} name={name} hidden={false} />
      </div>
      <Link
        href={storeHref(id)}
        className="group relative flex flex-col rounded-2xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pr-10">
            <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">მაღაზია</div>
            <h2 className="truncate text-lg font-semibold">{name}</h2>
          </div>
          <span className="flex size-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors group-hover:border-gold group-hover:text-gold-strong">
            <ArrowUpRight className="size-4" />
          </span>
        </div>

        <div className="mt-5">
          <div className="text-xs text-muted-foreground">დღევანდელი გაყიდვა · {kpis.todayCount} ოპერაცია</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight">
            <Money value={kpis.todayTotal} currency />
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            აღებული: <Money value={kpis.todayPaid} currency className="text-foreground" />
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">ამ თვეში</dt>
            <dd className="mt-0.5 font-medium">
              <Money value={kpis.monthTotal} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">მისაღები</dt>
            <dd className="mt-0.5 font-medium">
              <Money value={kpis.receivable} tone="debt" />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">სალარო</dt>
            <dd className="mt-0.5 font-medium">
              <Money value={kpis.cashBalance} />
            </dd>
          </div>
        </dl>
        {kpis.openOrders ? (
          <Badge variant="secondary" className="absolute top-6 right-26 gap-1">
            <ClipboardList className="size-3" />
            {kpis.openOrders} ღია შეკვეთა
          </Badge>
        ) : null}
      </Link>
    </div>
  );
}
