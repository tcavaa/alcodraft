import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Notice } from "@/components/notice";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateUserAction } from "@/features/admin/actions";
import { DeleteUserButton, ResetPasswordDialog, UserForm } from "@/features/admin/components/admin-forms";
import { getUserAdmin, listStoreOptions } from "@/features/admin/queries";
import { formatDateTime } from "@/lib/dates";
import { idParam, param } from "@/lib/search-params";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მომხმარებელი" };

export default async function EditUserPage({ params, searchParams }: PageProps<"/admin/settings/users/[userId]">) {
  const me = await requireSuperAdmin();
  const { userId } = await params;
  const [user, stores] = await Promise.all([getUserAdmin(idParam(userId)), listStoreOptions()]);
  if (!user) notFound();
  const sp = await searchParams;
  const isSelf = user.id === me.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        back={{ href: "/admin/settings/users", label: "მომხმარებლები" }}
        eyebrow="ადმინისტრირება"
        title={user.name || user.email}
        description={
          <>
            {user.lastLoginAt ? `ბოლო შესვლა: ${formatDateTime(user.lastLoginAt)}` : "ჯერ არ შესულა"}
            {user.passwordScheme === "legacy_md5_bcrypt" ? " · პაროლი ძველი სისტემიდანაა (პირველ შესვლაზე განახლდება)" : ""}
          </>
        }
        actions={
          <>
            <ResetPasswordDialog userId={user.id} email={user.email} />
            {!isSelf ? <DeleteUserButton userId={user.id} email={user.email} /> : null}
          </>
        }
      />
      {param(sp, "created") ? <Notice className="mb-0">მომხმარებელი შეიქმნა. გადაეცით ელფოსტა და პაროლი.</Notice> : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">მონაცემები და წვდომა</CardTitle>
          <CardDescription>წვდომის მოხსნა ან გათიშვა მაშინვე მოქმედებს.</CardDescription>
        </CardHeader>
        <CardContent>
          <UserForm
            action={updateUserAction.bind(null, user.id)}
            stores={stores}
            defaults={user}
            submitLabel="შენახვა"
            isCreate={false}
            isSelf={isSelf}
          />
        </CardContent>
      </Card>
    </div>
  );
}
