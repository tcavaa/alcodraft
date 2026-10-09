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
  total,
  paid,
  adjustment,
}: {
  storeId: number;
  deliveryId: number;
  customerId: number;
  number: number;
  kind: "delivery" | "adjustment" | "count" | "return";
  hasLinkedCash: boolean;
  /** Operation total (a return's is −Σ returned). */
  total: string;
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
      title={
        kind === "adjustment"
          ? `კორექტირება #${number} — წაშლა?`
          : kind === "count"
            ? `განაშთვა #${number} — წაშლა?`
            : kind === "return"
              ? `გამოტანა #${number} — წაშლა?`
              : `ოპერაცია #${number} — წაშლა?`
      }
      description={
        kind === "adjustment" ? (
          <p>ობიექტის ვალი შეიცვლება {formatAmount(dec(adjustment).negated())} ₾-ით (ამ და შემდეგი ოპერაციებისთვის).</p>
        ) : kind === "count" ? (
          <p>დათვლილი ნაშთი წაიშლება. საწყობი, ვალი და სალარო არ იცვლება.</p>
        ) : kind === "return" ? (
          <>
            <p>გამოტანილი პროდუქცია ისევ ჩამოიწერება საწყობიდან და მისი მიღებაც წაიშლება.</p>
            <p>ობიექტის ვალი გაიზრდება {formatAmount(dec(total).negated())} ₾-ით (ამ და შემდეგი ოპერაციებისთვის).</p>
          </>
        ) : (
          <>
            <p>პროდუქცია დაბრუნდება საწყობში, ობიექტის ვალი გადაითვლება.</p>
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
