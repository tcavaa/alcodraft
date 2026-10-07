import type { Metadata } from "next";

import { FilterTabs } from "@/components/data/filter-tabs";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAccounts, monthlyReport } from "@/features/finance/queries";
import { formatMonth } from "@/lib/dates";
import { dec, sum } from "@/lib/money";
import { storeHref } from "@/lib/routes";
import { intParam } from "@/lib/search-params";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "თვის ბრუნვა" };

/** Old finance/month: expense, income and income − expense per month. */
export default async function MonthlyPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/finance/monthly">) {
  const { storeId } = await params;
  const { store } = await requireStore(storeId);
  const sp = await searchParams;
  const accounts = await listAccounts(store.id);
  const account = accounts.find((a) => a.id === intParam(sp, "account")) ?? accounts[0];
  const rows = account ? await monthlyReport(account.id) : [];
  const totalOut = sum(rows.map((r) => r.out));
  const totalIn = sum(rows.map((r) => r.in));

  return (
    <>
      <PageHeader
        back={{ href: `${storeHref(store.id, "finance")}${account ? `?account=${account.id}` : ""}`, label: "სალარო" }}
        eyebrow={store.name}
        title="თვის ბრუნვა"
        description={account?.name}
      />
      {accounts.length > 1 ? (
        <div className="mb-4">
          <FilterTabs
            pathname={storeHref(store.id, "finance/monthly")}
            searchParams={{}}
            param="account"
            value={String(account?.id)}
            options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
          />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>თარიღი (თვე)</TableHead>
              <TableHead className="text-right">ხარჯი</TableHead>
              <TableHead className="text-right">შემოსავალი</TableHead>
              <TableHead className="text-right">შემოსავალი − ხარჯი</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const net = dec(r.in).minus(r.out);
              return (
                <TableRow key={r.month}>
                  <TableCell className="font-medium">
                    {formatMonth(r.month)}
                    <span className="ml-2 text-xs text-muted-foreground">{r.entries} ჩანაწერი</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.out} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={r.in} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={net} tone="signed" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell>სულ</TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={totalOut} currency />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={totalIn} currency />
              </TableCell>
              <TableCell className="text-right font-semibold">
                <Money value={totalIn.minus(totalOut)} currency tone="signed" />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
