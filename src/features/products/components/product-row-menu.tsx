"use client";

import { Pencil } from "lucide-react";

import { archiveMenuItems, RowMenu } from "@/components/row-menu";
import { storeHref } from "@/lib/routes";

import { deleteProductAction, setProductArchivedAction } from "../actions";

export function ProductRowMenu({
  storeId,
  productId,
  name,
  archived,
  canDelete,
}: {
  storeId: number;
  productId: number;
  name: string;
  archived: boolean;
  canDelete: boolean;
}) {
  return (
    <RowMenu
      label={`${name} — მოქმედებები`}
      items={[
        { type: "link", label: "რედაქტირება", href: storeHref(storeId, `products/${productId}`), icon: <Pencil /> },
        { type: "separator" },
        ...archiveMenuItems({
          name,
          archived,
          archive: () => setProductArchivedAction(storeId, productId, true),
          restore: () => setProductArchivedAction(storeId, productId, false),
          archiveDescription: "პროდუქტი აღარ გამოჩნდება ოპერაციის ფორმაში. ისტორია შენარჩუნდება.",
          remove: canDelete
            ? {
                run: () => deleteProductAction(storeId, productId),
                description: "წაიშლება მხოლოდ თუ პროდუქტი არცერთ ოპერაციაში, შეკვეთასა თუ მიღებაში არ ფიგურირებს.",
              }
            : undefined,
        }),
      ]}
    />
  );
}
