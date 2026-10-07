import { Plus, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listUsersAdmin } from "@/features/admin/queries";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომხმარებლები" };

export default async function UsersPage() {
  await requireSuperAdmin();
  const users = await listUsersAdmin();
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
              <TableHead>მომხმარებელი</TableHead>
              <TableHead>როლი</TableHead>
              <TableHead className="hidden md:table-cell">მაღაზიები</TableHead>
              <TableHead className="hidden text-right lg:table-cell">ბოლო შესვლა</TableHead>
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
