import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateStoreAction } from "@/features/admin/actions";
import { DeleteStoreButton, StoreForm } from "@/features/admin/components/admin-forms";
import { getStoreAdmin } from "@/features/admin/queries";
import { requireSuperAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "მაღაზიის რედაქტირება" };

export default async function EditStorePage({ params }: PageProps<"/admin/settings/stores/[storeId]">) {
  await requireSuperAdmin();
  const { storeId } = await params;
  const store = await getStoreAdmin(Number(storeId));
  if (!store) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader
        back={{ href: "/admin/settings/stores", label: "მაღაზიები" }}
        eyebrow="ადმინისტრირება"
        title={store.name}
        actions={
          <Button variant="outline" asChild>
            <Link href={`/admin/stores/${store.id}`}>
              გახსნა <ArrowRight />
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="pt-6">
          <StoreForm action={updateStoreAction.bind(null, store.id)} defaults={store} submitLabel="შენახვა" showAdvanced />
        </CardContent>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base">წაშლა</CardTitle>
          <CardDescription>მხოლოდ ცარიელი მაღაზია იშლება. მონაცემებიანი — დაარქივეთ ზემოთ.</CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteStoreButton storeId={store.id} name={store.name} />
        </CardContent>
      </Card>
    </div>
  );
}
