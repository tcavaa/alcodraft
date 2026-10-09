"use client";

import { ClipboardList, Pencil, ReceiptText } from "lucide-react";

import { archiveMenuItems, RowMenu, type RowMenuItem } from "@/components/row-menu";
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
    // A customer in the trash can't get new operations or orders — restore first.
    ...(archived
      ? []
      : ([
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
        ] satisfies RowMenuItem[])),
    { type: "link", label: "რედაქტირება", href: storeHref(storeId, `customers/${customerId}/edit`), icon: <Pencil /> },
    { type: "separator" },
    ...archiveMenuItems({
      name,
      archived,
      archive: () => setCustomerArchivedAction(storeId, customerId, true),
      restore: () => setCustomerArchivedAction(storeId, customerId, false),
      archiveDescription:
        "ობიექტი გაქრება სიიდან, მაგრამ ისტორია და ვალი შენარჩუნდება. ნებისმიერ დროს შეგიძლიათ აღადგინოთ.",
      remove: canDelete
        ? {
            run: () => deleteCustomerAction(storeId, customerId),
            description: "წაიშლება მხოლოდ თუ ობიექტს არცერთი ოპერაცია ან შეკვეთა არ აქვს.",
          }
        : undefined,
    }),
  ];
  return <RowMenu items={items} label={`${name} — მოქმედებები`} />;
}
