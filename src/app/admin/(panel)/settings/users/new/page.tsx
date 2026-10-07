import type { Metadata } from "next";

import { FormPage } from "@/components/form-page";
import { createUserAction } from "@/features/admin/actions";
import { UserForm } from "@/features/admin/components/admin-forms";
import { listStoreOptions } from "@/features/admin/queries";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი მომხმარებელი" };

export default async function NewUserPage() {
  await requireSuperAdmin();
  const stores = await listStoreOptions();
  return (
    <FormPage back={{ href: "/admin/settings/users", label: "მომხმარებლები" }} eyebrow="ადმინისტრირება" title="ახალი მომხმარებელი">
      <UserForm action={createUserAction} stores={stores} submitLabel="შექმნა" isCreate />
    </FormPage>
  );
}
