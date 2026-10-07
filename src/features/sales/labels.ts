import { dec, type Numeric } from "@/lib/money";

export type OperationKind = "delivery" | "payment" | "adjustment";

/** What an operation row represents (the old app had only "distribution" rows). */
export function operationKind(op: { kind: string; total: Numeric; paid: Numeric }): OperationKind {
  if (op.kind === "adjustment") return "adjustment";
  if (dec(op.total).isZero() && !dec(op.paid).isZero()) return "payment";
  return "delivery";
}

export const OPERATION_KIND_LABEL: Record<OperationKind, string> = {
  delivery: "მიწოდება",
  payment: "გადახდა",
  adjustment: "კორექტირება",
};

export const UPLOAD_STATUS_LABEL: Record<"pending" | "uploaded", string> = {
  pending: "ასატვირთი",
  uploaded: "ატვირთული",
};

export const ORDER_STATUS_LABEL: Record<"open" | "completed" | "cancelled", string> = {
  open: "ღია",
  completed: "დასრულებული",
  cancelled: "გაუქმებული",
};
