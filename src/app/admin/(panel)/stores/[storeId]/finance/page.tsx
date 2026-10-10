import { CalendarRange, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DateRangeFilter } from "@/components/data/date-range-filter";
import { FilterTabs } from "@/components/data/filter-tabs";
import { Pagination } from "@/components/data/pagination";
import { ParamSelect } from "@/components/data/param-select";
import { SearchInput } from "@/components/data/search-input";
import { SortableHead } from "@/components/data/sortable-head";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AddEntryDialog, EntryRowMenu, RenameAccountButton } from "@/features/finance/components/finance-components";
import { ENTRY_SORTS, listAccounts, listEntries } from "@/features/finance/queries";
import { formatDate } from "@/lib/dates";
import { dec, formatAmount, formatQty } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { dateRangeParam, enumParam, intParam, pageParam, param, sortParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "სალარო" };

const PAGE_SIZE = 100;

export default async function FinancePage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/finance">) {
  const { storeId } = await params;
  const { store, user } = await requireStore(storeId);
  const sp = await searchParams;
  const accounts = await listAccounts(store.id);
  const account = accounts.find((a) => a.id === intParam(sp, "account")) ?? accounts[0];
  const pathname = storeHref(store.id, "finance");

  if (!account) {
    return (
      <>
        <PageHeader eyebrow={store.name} title="სალარო" />
        <EmptyState icon={Wallet} title="სალარო არ არის" />
      </>
    );
  }

  const page = pageParam(sp);
  const direction = enumParam(sp, "dir", ["in", "out"] as const);
  const list = await listEntries(account.id, {
    q: param(sp, "q"),
    ...dateRangeParam(sp),
    direction,
    sort: sortParam(sp, ENTRY_SORTS),
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="სალარო"
        description="ხარჯები და შემოსავლები; ბალანსი ყოველი ჩანაწერის შემდეგ."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${storeHref(store.id, "finance/monthly")}?account=${account.id}`}>
                <CalendarRange />
                თვის ბრუნვა
              </Link>
            </Button>
            <AddEntryDialog storeId={store.id} accountId={account.id} accountName={account.name} />
          </>
        }
      />

      {accounts.length > 1 || user.role === "super_admin" ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {accounts.length > 1 ? (
            <FilterTabs
              pathname={pathname}
              searchParams={{}}
              param="account"
              value={String(account.id)}
              options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          ) : null}
          {user.role === "super_admin" ? (
            <RenameAccountButton storeId={store.id} accountId={account.id} name={account.name} />
          ) : null}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard accent label={`ბალანსი — ${account.name}`} icon={Wallet} value={<Money value={account.balance} currency />} />
        <StatCard label="შემოსავალი (ფილტრით)" value={<Money value={list.totalIn} currency />} />
        <StatCard label="ხარჯი (ფილტრით)" value={<Money value={list.totalOut} currency />} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput className="sm:w-72" placeholder="კომენტარის ძებნა…" />
        <DateRangeFilter />
        <div className="flex flex-wrap gap-2">
          <ParamSelect
            param="dir"
            value={direction ?? "all"}
            label="ტიპი"
            className="w-48"
            options={[
              { value: "all", label: "ყველა" },
              { value: "in", label: "შემოსავალი" },
              { value: "out", label: "ხარჯი" },
            ]}
          />
        </div>
      </div>

      {list.rows.length === 0 ? (
        <EmptyState icon={Wallet} title="ჩანაწერები ვერ მოიძებნა" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <SortableHead column="date" first="desc">
                  თარიღი
                </SortableHead>
                <SortableHead column="out" className="text-right">
                  ხარჯი
                </SortableHead>
                <SortableHead column="in" className="text-right">
                  შემოსავალი
                </SortableHead>
                <SortableHead column="balance" className="text-right">
                  ბალანსი
                </SortableHead>
                <SortableHead column="comment">კომენტარი</SortableHead>
                <TableHead className="w-10" />
              </HeadRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</TableCell>
                  <TableCell className="text-right">
                    {dec(e.amountOut).isZero() ? <span className="text-muted-foreground/40">—</span> : <Money value={e.amountOut} className="text-destructive" />}
                  </TableCell>
                  <TableCell className="text-right">
                    {dec(e.amountIn).isZero() ? <span className="text-muted-foreground/40">—</span> : <Money value={e.amountIn} className="text-success" />}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={e.balanceAfter} />
                  </TableCell>
                  <TableCell className="max-w-md">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="whitespace-pre-line">{e.description}</span>
                      {e.deliveryId ? (
                        <Link href={storeHref(store.id, `operations/${e.deliveryId}`)}>
                          <Badge variant="outline">ოპერაცია #{e.deliveryNumber}</Badge>
                        </Link>
                      ) : null}
                      {e.supplierId ? (
                        <Link href={storeHref(store.id, `suppliers/${e.supplierId}`)}>
                          <Badge variant="outline">მომწოდებელი</Badge>
                        </Link>
                      ) : null}
                      {e.employeeId ? (
                        <Link href={storeHref(store.id, `employees/${e.employeeId}`)}>
                          <Badge variant="outline">ხელფასი</Badge>
                        </Link>
                      ) : null}
                      {!dec(e.adjustment).isZero() ? (
                        <Badge variant="secondary" title="ძველ ბაზაში ხელით გასწორებული ბალანსი">
                          კორ. {formatAmount(e.adjustment)}
                        </Badge>
                      ) : null}
                    </div>
                    {e.note ? <div className="text-xs text-muted-foreground">{e.note}</div> : null}
                  </TableCell>
                  <TableCell>
                    <EntryRowMenu
                      storeId={store.id}
                      entryId={e.id}
                      description={e.description}
                      note={e.note}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>სულ ({formatQty(list.count)})</TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={list.totalOut} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={list.totalIn} />
                </TableCell>
                <TableCell className="text-right font-semibold">
                  <Money value={account.balance} currency />
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.count} pathname={pathname} searchParams={sp} />
    </>
  );
}
