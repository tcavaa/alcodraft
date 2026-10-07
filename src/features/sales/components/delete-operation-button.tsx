"use client";

import { Trash2 } from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { dec, formatAmount } from "@/lib/money";

import { deleteDeliveryAction } from "../actions";

export function DeleteOperationButton({
  storeId,
  deliveryId,
  customerId,
  number,
  kind,
  hasLinkedCash,
  paid,
  adjustment,
}: {
  storeId: number;
  deliveryId: number;
  customerId: number;
  number: number;
  kind: "delivery" | "adjustment";
  hasLinkedCash: boolean;
  paid: string;
  /** Old manual debt correction carried by an imported operation. */
  adjustment: string;
}) {
  const keepsCorrection = kind === "delivery" && !dec(adjustment).isZero();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" className="text-destructive hover:text-destructive print:hidden">
          <Trash2 />
          წაშლა
        </Button>
      }
      title={kind === "adjustment" ? `კორექტირება #${number} — წაშლა?` : `ოპერაცია #${number} — წაშლა?`}
      description={
        kind === "adjustment" ? (
          <p>კლიენტის ვალი შეიცვლება {formatAmount(dec(adjustment).negated())} ₾-ით (ამ და შემდეგი ოპერაციებისთვის).</p>
        ) : (
          <>
            <p>პროდუქცია დაბრუნდება საწყობში, კლიენტის ვალი გადაითვლება.</p>
            {!dec(paid).isZero() ? (
              <p>
                {hasLinkedCash
                  ? "სალაროს შესაბამისი ჩანაწერიც წაიშლება."
                  : "ძველი სისტემიდან გადმოტანილ ოპერაციას სალაროს ჩანაწერი არ აქვს მიბმული — სალაროში დაემატება შემასწორებელი ჩანაწერი."}
              </p>
            ) : null}
            {keepsCorrection ? (
              <p className="font-medium text-foreground">
                ოპერაციას აქვს ძველი სისტემის კორექტირება ({formatAmount(adjustment)} ₾) — ის დარჩება ცალკე ხაზად, რომ
                შემდეგი ოპერაციების ვალი არ შეიცვალოს.
              </p>
            ) : null}
            <p>თუ ოპერაცია შეკვეთიდან შეიქმნა, შეკვეთა ისევ გაიხსნება.</p>
          </>
        )
      }
      confirmLabel="წაშლა"
      destructive
      action={() => deleteDeliveryAction(storeId, deliveryId, customerId, kind)}
    />
  );
}
