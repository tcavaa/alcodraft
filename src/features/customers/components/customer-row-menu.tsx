"use client";

import { Archive, ArchiveRestore, ClipboardList, Pencil, ReceiptText, Trash2 } from "lucide-react";

import { RowMenu, type RowMenuItem } from "@/components/row-menu";
import { storeHref } from "@/lib/routes";

import { deleteCustomerAction, setCustomerArchivedAction } from "../actions";

export function CustomerRowMenu({
  storeId,
  customerId,
  name,
  archived,
  canDelete,
}: {
  storeId: number;
  customerId: number;
  name: string;
  archived: boolean;
  canDelete: boolean;
}) {
  const items: RowMenuItem[] = [
    {
      type: "link",
      label: "ახალი ოპერაცია",
      href: `${storeHref(storeId, "operations/new")}?customer=${customerId}`,
      icon: <ReceiptText />,
    },
    {
      type: "link",
      label: "ახალი შეკვეთა",
      href: `${storeHref(storeId, "orders/new")}?customer=${customerId}`,
      icon: <ClipboardList />,
    },
    { type: "link", label: "რედაქტირება", href: storeHref(storeId, `customers/${customerId}/edit`), icon: <Pencil /> },
    { type: "separator" },
    archived
      ? {
          type: "action",
          label: "აღდგენა",
          icon: <ArchiveRestore />,
          run: () => setCustomerArchivedAction(storeId, customerId, false),
        }
      : {
          type: "action",
          label: "სანაგვეში გადატანა",
          icon: <Archive />,
          run: () => setCustomerArchivedAction(storeId, customerId, true),
          confirm: {
            title: `${name} — სანაგვეში გადატანა?`,
            description: "კლიენტი გაქრება სიიდან, მაგრამ ისტორია და ვალი შენარჩუნდება. ნებისმიერ დროს შეგიძლიათ აღადგინოთ.",
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
      run: () => deleteCustomerAction(storeId, customerId),
      confirm: {
        title: `${name} — სამუდამოდ წაშლა?`,
        description: "წაიშლება მხოლოდ თუ კლიენტს არცერთი ოპერაცია ან შეკვეთა არ აქვს.",
        confirmLabel: "წაშლა",
      },
    });
  }
  return <RowMenu items={items} />;
}
