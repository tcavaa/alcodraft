import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createStoreAction } from "@/features/admin/actions";
import { StoreForm } from "@/features/admin/components/admin-forms";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ახალი მაღაზია" };

export default async function NewStorePage() {
  await requireSuperAdmin();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        back={{ href: "/admin/settings/stores", label: "მაღაზიები" }}
        eyebrow="ადმინისტრირება"
        title="ახალი მაღაზია"
        description="შეიქმნება ცარიელი მაღაზია საკუთარი სალაროთი. შემდეგ მიანიჭეთ მომხმარებლებს."
      />
      <Card>
        <CardContent className="pt-6">
          <StoreForm action={createStoreAction} submitLabel="შექმნა" showAdvanced={false} />
        </CardContent>
      </Card>
    </div>
  );
}
