import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { Pagination } from "@/components/data/pagination";
import { ParamSelect } from "@/components/data/param-select";
import { SearchInput } from "@/components/data/search-input";
import { SortableHead } from "@/components/data/sortable-head";
import { HeadRow, TableCard } from "@/components/data/table-card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { AUDIT_SORTS, listAudit, listStoreOptions, listUserOptions } from "@/features/admin/queries";
import { formatDateTime } from "@/lib/dates";
import { intParam, pageParam, param, sortParam } from "@/lib/search-params";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "აუდიტი" };

const PAGE_SIZE = 100;

export default async function AuditPage({ searchParams }: PageProps<"/admin/settings/audit">) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const page = pageParam(sp);
  const storeId = intParam(sp, "store");
  const userId = intParam(sp, "user");
  const [list, stores, users] = await Promise.all([
    listAudit({ storeId, userId, q: param(sp, "q"), sort: sortParam(sp, AUDIT_SORTS), page, pageSize: PAGE_SIZE }),
    listStoreOptions(),
    listUserOptions(),
  ]);
  return (
    <>
      <PageHeader eyebrow="ადმინისტრირება" title="აუდიტი" description="ვინ, როდის და რა შეცვალა." />
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput placeholder="ძებნა აღწერაში…" />
        <div className="flex gap-2">
          <ParamSelect
            param="store"
            value={storeId ? String(storeId) : "all"}
            label="მაღაზია"
            className="w-56"
            options={[{ value: "all", label: "ყველა" }, ...stores.map((s) => ({ value: String(s.id), label: s.name }))]}
          />
          <ParamSelect
            param="user"
            value={userId ? String(userId) : "all"}
            label="მომხმარებელი"
            className="w-64"
            options={[{ value: "all", label: "ყველა" }, ...users.map((u) => ({ value: String(u.id), label: u.name || u.email }))]}
          />
        </div>
      </div>
      {list.rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="ჩანაწერები არ არის" />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <HeadRow>
                <SortableHead column="time" first="desc">
                  დრო
                </SortableHead>
                <SortableHead column="user">მომხმარებელი</SortableHead>
                <SortableHead column="store" className="hidden md:table-cell">
                  მაღაზია
                </SortableHead>
                <SortableHead column="action">მოქმედება</SortableHead>
              </HeadRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{formatDateTime(r.createdAt)}</TableCell>
                  <TableCell>{r.userName || r.userEmail || "—"}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{r.storeName ?? "—"}</TableCell>
                  <TableCell>
                    <div>{r.summary}</div>
                    <div className="font-mono text-xs text-muted-foreground">{r.action}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={list.total} pathname="/admin/settings/audit" searchParams={sp} />
    </>
  );
}
