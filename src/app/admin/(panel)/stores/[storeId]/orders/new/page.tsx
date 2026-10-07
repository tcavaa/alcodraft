import type { Metadata } from "next";

import { NewDocumentPage } from "@/features/sales/components/new-document-page";

export const metadata: Metadata = { title: "ახალი შეკვეთა" };

export default async function NewOrderPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/orders/new">) {
  const { storeId } = await params;
  return <NewDocumentPage kind="order" storeId={storeId} searchParams={await searchParams} />;
}
