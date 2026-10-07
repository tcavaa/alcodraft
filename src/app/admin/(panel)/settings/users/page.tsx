import { Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SortableHead } from "@/components/data/sortable-head";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/components/ui/table";
import { listUsersAdmin } from "@/features/admin/queries";
import { formatDateTime } from "@/lib/dates";
import { sortParam } from "@/lib/search-params";
import { sortRows } from "@/lib/sort";
import { cn } from "@/lib/utils";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომხმარებლები" };

const SORTS = ["user", "role", "stores", "login"] as const;

export default async function UsersPage({ searchParams }: PageProps<"/admin/settings/users">) {
  await requireSuperAdmin();
  const users = sortRows(await listUsersAdmin(), sortParam(await searchParams, SORTS), {
    user: (u) => u.name || u.email,
    role: (u) => (u.role === "super_admin" ? 0 : 1),
    // super admins open every store
    stores: (u) => (u.role === "super_admin" ? Number.MAX_SAFE_INTEGER : u.storeNames.length),
    login: (u) => u.lastLoginAt?.getTime(),
  });
  return (
    <>
      <PageHeader
        eyebrow="ადმინისტრირება"
        title="მომხმარებლები"
        description="ვინ შედის სისტემაში და რომელ მაღაზიებზე აქვს წვდომა."
        actions={
          <Button asChild>
            <Link href="/admin/settings/users/new">
              <Plus />
              ახალი მომხმარებელი
            </Link>
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SortableHead column="user">მომხმარებელი</SortableHead>
              <SortableHead column="role">როლი</SortableHead>
              <SortableHead column="stores" first="desc" className="hidden md:table-cell">
                მაღაზიები
              </SortableHead>
              <SortableHead column="login" className="hidden text-right lg:table-cell">
                ბოლო შესვლა
              </SortableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={cn(!u.isActive && "opacity-55")}>
                <TableCell>
                  <Link href={`/admin/settings/users/${u.id}`} className="font-medium hover:underline">
                    {u.name || u.email}
                  </Link>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  {u.role === "super_admin" ? (
                    <Badge className="gap-1">
                      <ShieldCheck className="size-3" /> სუპერ ადმინი
                    </Badge>
                  ) : (
                    <Badge variant="secondary">მომხმარებელი</Badge>
                  )}
                  {!u.isActive ? (
                    <Badge variant="destructive" className="ml-1">
                      გათიშული
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell className="hidden max-w-md md:table-cell">
                  {u.role === "super_admin" ? (
                    <span className="text-muted-foreground">ყველა</span>
                  ) : u.storeNames.length ? (
                    <div className="flex flex-wrap gap-1">
                      {u.storeNames.map((n) => (
                        <Badge key={n} variant="outline">
                          {n}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-destructive">არცერთი</span>
                  )}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground lg:table-cell">
                  {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
