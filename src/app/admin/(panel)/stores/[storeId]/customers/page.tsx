import { Palette, Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FilterTabs } from "@/components/data/filter-tabs";
import { Pagination } from "@/components/data/pagination";
import { ParamSelect } from "@/components/data/param-select";
import { SearchInput } from "@/components/data/search-input";
import { SortableHead } from "@/components/data/sortable-head";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COLOR_ROW, CustomerColorPicker } from "@/features/customers/components/customer-color";
import { CustomerComment } from "@/features/customers/components/customer-comment";
import { CustomerRowMenu } from "@/features/customers/components/customer-row-menu";
import { countCustomers, CUSTOMER_SORTS, listCustomers } from "@/features/customers/queries";
import { formatDate } from "@/lib/dates";
import { storeHref } from "@/lib/routes";
import { pageParam, param, sortParam } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { requireStore } from "@/server/auth/dal";

export const metadata: Metadata = { title: "კლიენტები" };

const PAGE_SIZE = 100;

export default async function CustomersPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/customers">) {
  const { storeId } = await params;
  const { store, user } = await requireStore(storeId);
  const sp = await searchParams;
  const archived = param(sp, "archived") === "1";
  const sort = sortParam(sp, CUSTOMER_SORTS);
  const colorParam = param(sp, "color");
  const color = colorParam === "green" || colorParam === "yellow" || colorParam === "red" ? colorParam : undefined;
  const page = pageParam(sp);
  const q = param(sp, "q");

  const [list, counts] = await Promise.all([
    listCustomers(store.id, { q, archived, sort, color, page, pageSize: PAGE_SIZE }),
    countCustomers(store.id),
  ]);
  const pathname = storeHref(store.id, "customers");

  return (
    <>
      <PageHeader
        eyebrow={store.name}
        title="კლიენტები"
        description="მაღაზიები, რესტორნები და კომპანიები, რომლებსაც აწვდით პროდუქციას."
        actions={
          <Button asChild>
            <Link href={storeHref(store.id, "customers/new")}>
              <Plus />
              ახალი კლიენტი
            </Link>
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput placeholder="სახელი, მისამართი, ტელეფონი, ს/ნ…" />
          <FilterTabs
            pathname={pathname}
            searchParams={sp}
            param="archived"
            value={archived ? "1" : "0"}
            options={[
              { value: "0", label: "აქტიური", count: counts.active },
              { value: "1", label: "სანაგვე", count: counts.archived },
            ]}
          />
        </div>
        <ParamSelect
          param="color"
          value={color ?? "all"}
          label="ფერი"
          className="w-40"
          options={[
            { value: "all", label: "ყველა" },
            { value: "red", label: "წითელი" },
            { value: "yellow", label: "ყვითელი" },
            { value: "green", label: "მწვანე" },
          ]}
        />
      </div>

      {list.rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "ვერაფერი მოიძებნა" : archived ? "სანაგვე ცარიელია" : "კლიენტები ჯერ არ არის"}
          description={q ? `"${q}" — სხვა სიტყვით სცადეთ.` : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <SortableHead column="color" first="asc" className="w-14 pr-0">
                  <Palette className="size-3.5" aria-label="ფერი" />
                </SortableHead>
                <SortableHead column="name">დასახელება</SortableHead>
                <SortableHead column="comment" className="hidden lg:table-cell">
                  კომენტარი
                </SortableHead>
                <SortableHead column="debt" className="text-right">
                  დარჩენილი (ვალი)
                </SortableHead>
                <SortableHead column="last" className="hidden text-right md:table-cell">
                  ბოლო ოპერაცია
                </SortableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((c) => (
                <TableRow key={c.id} className={cn(c.color && COLOR_ROW[c.color])}>
                  <TableCell className="pr-0">
                    <CustomerColorPicker storeId={store.id} customerId={c.id} color={c.color} />
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[22rem]">
                      <Link href={storeHref(store.id, `customers/${c.id}`)} className="block truncate font-medium hover:underline" title={c.name}>
                        {c.name}
                      </Link>
                      <div className="truncate text-xs text-muted-foreground">
                        {[c.address, c.phone, c.contactPerson].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden w-[34%] lg:table-cell">
                    <CustomerComment storeId={store.id} customerId={c.id} comment={c.comment} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <Money value={c.debt} tone="debt" />
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground md:table-cell">
                    {c.lastDate ? formatDate(c.lastDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <CustomerRowMenu
                      storeId={store.id}
                      customerId={c.id}
                      name={c.name}
                      archived={archived}
                      canDelete={user.role === "super_admin"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell />
                <TableCell colSpan={2} className="text-muted-foreground">
                  სულ {list.total} კლიენტი
                  {Number(list.credit) !== 0 ? (
                    <>
                      {" "}
                      · ზედმეტად გადახდილი <Money value={list.credit} currency />
                    </>
                  ) : null}
                </TableCell>
                <TableCell className="text-right text-base font-semibold">
                  <Money value={list.receivable} currency tone="debt" />
                </TableCell>
                <TableCell colSpan={2} className="hidden md:table-cell" />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} pathname={pathname} searchParams={sp} />
    </>
  );
}
