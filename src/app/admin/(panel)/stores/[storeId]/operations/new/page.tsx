import type { Metadata } from "next";

import { NewDocumentPage } from "@/features/sales/components/new-document-page";

export const metadata: Metadata = { title: "ახალი ოპერაცია" };

export default async function NewOperationPage({ params, searchParams }: PageProps<"/admin/stores/[storeId]/operations/new">) {
  const { storeId } = await params;
  return <NewDocumentPage kind="delivery" storeId={storeId} searchParams={await searchParams} />;
}
