import "server-only";

import type { DbOrTx } from "@/server/db";
import { auditLog } from "@/server/db/schema";

export interface AuditEntry {
  storeId?: number | null;
  userId?: number | null;
  /** "<entity>.<verb>", e.g. "delivery.create" */
  action: string;
  entityType: string;
  entityId?: number | null;
  /** One human-readable line (Georgian), shown in the audit log page. */
  summary: string;
  details?: unknown;
}

export async function audit(tx: DbOrTx, entry: AuditEntry): Promise<void> {
  await tx.insert(auditLog).values({
    storeId: entry.storeId ?? null,
    userId: entry.userId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    summary: entry.summary,
    details: entry.details ?? null,
  });
}
