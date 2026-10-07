import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm, NameForm } from "@/features/admin/components/account-forms";
import { getMyStores, requireUser } from "@/server/auth/dal";

export const metadata: Metadata = { title: "ჩემი ანგარიში" };

export default async function AccountPage() {
  const user = await requireUser();
  const stores = await getMyStores();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="ჩემი ანგარიში" description={user.email} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">სახელი</CardTitle>
          <CardDescription>ჩანს მენიუში და აუდიტში.</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm name={user.name} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">პაროლის შეცვლა</CardTitle>
          <CardDescription>შეცვლის შემდეგ სხვა მოწყობილობებიდან ავტომატურად გამოხვალთ.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">წვდომა</CardTitle>
          <CardDescription>{user.role === "super_admin" ? "სუპერ ადმინი — ყველა მაღაზია" : "მინიჭებული მაღაზიები"}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {stores.map((s) => (
            <span key={s.id} className="rounded-full border px-3 py-1">
              {s.name}
            </span>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
