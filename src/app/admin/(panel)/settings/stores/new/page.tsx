import type { Metadata } from "next";

import { FormPage } from "@/components/form-page";
import { createStoreAction } from "@/features/admin/actions";
import { StoreForm } from "@/features/admin/components/admin-forms";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი მაღაზია" };

export default async function NewStorePage() {
  await requireSuperAdmin();
  return (
    <FormPage
      width="xl"
      back={{ href: "/admin/settings/stores", label: "მაღაზიები" }}
      eyebrow="ადმინისტრირება"
      title="ახალი მაღაზია"
      description="შეიქმნება ცარიელი მაღაზია საკუთარი სალაროთი. შემდეგ მიანიჭეთ მომხმარებლებს."
    >
      <StoreForm action={createStoreAction} submitLabel="შექმნა" showAdvanced={false} />
    </FormPage>
  );
}
