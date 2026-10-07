"use client";

import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";

import { RowMenu, type RowMenuItem } from "@/components/row-menu";
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
  const items: RowMenuItem[] = [
    { type: "link", label: "რედაქტირება", href: storeHref(storeId, `products/${productId}`), icon: <Pencil /> },
    { type: "separator" },
    archived
      ? { type: "action", label: "აღდგენა", icon: <ArchiveRestore />, run: () => setProductArchivedAction(storeId, productId, false) }
      : {
          type: "action",
          label: "სანაგვეში გადატანა",
          icon: <Archive />,
          run: () => setProductArchivedAction(storeId, productId, true),
          confirm: {
            title: `${name} — სანაგვეში გადატანა?`,
            description: "პროდუქტი აღარ გამოჩნდება ოპერაციის ფორმაში. ისტორია შენარჩუნდება.",
            confirmLabel: "გადატანა",
          },
        },
  ];
  if (archived && canDelete) {
    items.push({
      type: "action",
      label: "სამუდამოდ წაშლა",
      icon: <Trash2 />,
      destructive: true,
      run: () => deleteProductAction(storeId, productId),
      confirm: {
        title: `${name} — სამუდამოდ წაშლა?`,
        description: "წაიშლება მხოლოდ თუ პროდუქტი არცერთ ოპერაციაში, შეკვეთასა თუ მიღებაში არ ფიგურირებს.",
        confirmLabel: "წაშლა",
      },
    });
  }
  return <RowMenu items={items} />;
}
