import { dec, type Numeric } from "@/lib/money";

export type OperationKind = "delivery" | "payment" | "adjustment" | "count" | "return";

/** What an operation row represents (the old app had only "distribution" rows). */
export function operationKind(op: { kind: string; total: Numeric; paid: Numeric }): OperationKind {
  if (op.kind === "adjustment" || op.kind === "count" || op.kind === "return") return op.kind;
  if (dec(op.total).isZero() && !dec(op.paid).isZero()) return "payment";
  return "delivery";
}

export const OPERATION_KIND_LABEL: Record<OperationKind, string> = {
  delivery: "მიწოდება",
  payment: "გადახდა",
  adjustment: "კორექტირება",
  count: "განაშთვა",
  return: "გამოტანა",
};

/** Operation kinds that carry no payment (the method column shows „—“). */
export const hasNoPayment = (kind: OperationKind) => kind === "adjustment" || kind === "count" || kind === "return";

export const UPLOAD_STATUS_LABEL: Record<"pending" | "uploaded", string> = {
  pending: "ასატვირთი",
  uploaded: "ატვირთული",
};

export const ORDER_STATUS_LABEL: Record<"open" | "completed" | "cancelled", string> = {
  open: "ღია",
  completed: "დასრულებული",
  cancelled: "გაუქმებული",
};
