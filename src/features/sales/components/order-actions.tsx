"use client";

import { Ban, PackageCheck } from "lucide-react";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";

import { cancelOrderAction, completeOrderAction } from "../actions";

/** Old "შეკვეთის დასრულება" (orders/finish) and "გაუქმება" (orders/disable). */
export function OrderActions({
  storeId,
  orderId,
  number,
  shortStock,
  compact = false,
}: {
  storeId: number;
  orderId: number;
  number: number;
  /** Products whose stock is lower than the ordered quantity (warning only, like the old app). */
  shortStock: string[];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmAction
        trigger={
          <Button variant="ghost" size={compact ? "sm" : "default"} className="text-destructive hover:text-destructive">
            <Ban />
            გაუქმება
          </Button>
        }
        title={`შეკვეთა #${number} — გაუქმება?`}
        description="შეკვეთა გადავა ისტორიაში გაუქმებულის სტატუსით. მარაგი და სალარო არ იცვლება."
        confirmLabel="გაუქმება"
        destructive
        action={() => cancelOrderAction(storeId, orderId)}
      />
      <ConfirmAction
        trigger={
          <Button size={compact ? "sm" : "default"}>
            <PackageCheck />
            შეკვეთის დასრულება
          </Button>
        }
        title={`შეკვეთა #${number} — დასრულება?`}
        description={
          <div className="space-y-2">
            <p>შეიქმნება ოპერაცია: პროდუქცია ჩამოიწერება საწყობიდან, თანხა ჩაიწერება სალაროში და კლიენტის ვალი განახლდება.</p>
            {shortStock.length ? (
              <p className="text-warning">მარაგი არასაკმარისია: {shortStock.join(", ")} — მარაგი გახდება უარყოფითი.</p>
            ) : null}
          </div>
        }
        confirmLabel="დასრულება"
        action={() => completeOrderAction(storeId, orderId)}
      />
    </div>
  );
}
