import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createUserAction } from "@/features/admin/actions";
import { UserForm } from "@/features/admin/components/admin-forms";
import { listStoreOptions } from "@/features/admin/queries";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი მომხმარებელი" };

export default async function NewUserPage() {
  await requireSuperAdmin();
  const stores = await listStoreOptions();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/admin/settings/users", label: "მომხმარებლები" }} eyebrow="ადმინისტრირება" title="ახალი მომხმარებელი" />
      <Card>
        <CardContent className="pt-6">
          <UserForm action={createUserAction} stores={stores} submitLabel="შექმნა" isCreate />
        </CardContent>
      </Card>
    </div>
  );
}
