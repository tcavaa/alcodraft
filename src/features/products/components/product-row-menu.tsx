"use client";

import { CircleCheck, CircleOff, Pencil } from "lucide-react";

import { archiveMenuItems, RowMenu } from "@/components/row-menu";
import { storeHref } from "@/lib/routes";

import { deleteProductAction, setProductActiveAction, setProductArchivedAction } from "../actions";

export function ProductRowMenu({
  storeId,
  productId,
  name,
  archived,
  active,
  canDelete,
}: {
  storeId: number;
  productId: number;
  name: string;
  archived: boolean;
  active: boolean;
  canDelete: boolean;
}) {
  return (
    <RowMenu
      label={`${name} — მოქმედებები`}
      items={[
        { type: "link", label: "რედაქტირება", href: storeHref(storeId, `products/${productId}`), icon: <Pencil /> },
        ...(archived
          ? []
          : [
              active
                ? {
                    type: "action" as const,
                    label: "არააქტიურად მონიშვნა",
                    icon: <CircleOff />,
                    run: () => setProductActiveAction(storeId, productId, false),
                    confirm: {
                      title: `${name} — არააქტიური?`,
                      description:
                        "აღარ გამოჩნდება ახალი ოპერაციის, შეკვეთისა და მიღების ფორმებში და სტატისტიკაში. ძველი ოპერაციები და შეკვეთები უცვლელი რჩება.",
                      confirmLabel: "არააქტიური",
                    },
                  }
                : {
                    type: "action" as const,
                    label: "გააქტიურება",
                    icon: <CircleCheck />,
                    run: () => setProductActiveAction(storeId, productId, true),
                  },
            ]),
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
