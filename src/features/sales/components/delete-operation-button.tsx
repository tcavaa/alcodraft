"use client";

import { Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";

import { deleteDeliveryAction } from "../actions";

export function DeleteOperationButton({
  storeId,
  deliveryId,
  customerId,
  number,
  hasLinkedCash,
  paid,
}: {
  storeId: number;
  deliveryId: number;
  customerId: number;
  number: number;
  hasLinkedCash: boolean;
  paid: string;
}) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" className="text-destructive hover:text-destructive print:hidden">
          <Trash2 />
          წაშლა
        </Button>
      }
      title={`ოპერაცია #${number} — წაშლა?`}
      description={
        <div className="space-y-2">
          <p>პროდუქცია დაბრუნდება საწყობში, კლიენტის ვალი გადაითვლება.</p>
          {Number(paid) !== 0 ? (
            <p>
              {hasLinkedCash
                ? "სალაროს შესაბამისი ჩანაწერიც წაიშლება."
                : "ძველი სისტემიდან გადმოტანილ ოპერაციას სალაროს ჩანაწერი არ აქვს მიბმული — სალაროში დაემატება შემასწორებელი ჩანაწერი."}
            </p>
          ) : null}
          <p>თუ ოპერაცია შეკვეთიდან შეიქმნა, შეკვეთა ისევ გაიხსნება.</p>
        </div>
      }
      confirmLabel="წაშლა"
      destructive
      action={() => deleteDeliveryAction(storeId, deliveryId, customerId)}
    />
  );
}
