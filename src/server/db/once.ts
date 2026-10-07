import "server-only";

import { eq, lt } from "drizzle-orm";

import { ActionError } from "@/server/action";

import type { DbOrTx, Tx } from "./index";
import { requestKeys } from "./schema";

/**
 * Runs a create in a transaction at most once per client request id.
 *
 * The key row is inserted in the same transaction as the document: a concurrent duplicate waits
 * on the primary key until the first commits (then gets its result), and if the first rolls back
 * the key is free again, so a retry after a failure still works. Without a key it is a plain
 * transaction. The result is stored as JSON, so return plain ids and strings only.
 */
export async function once<T>(
  dbx: DbOrTx,
  request: { key: string | undefined; action: string; userId: number },
  run: (tx: Tx) => Promise<T>,
): Promise<T> {
  const { key, action, userId } = request;
  if (!key) return dbx.transaction(run);

  const outcome = await dbx.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(requestKeys)
      .values({ id: key, userId, action })
      .onConflictDoNothing()
      .returning({ id: requestKeys.id });
    if (!claimed) return { replay: true as const };
    const result = await run(tx);
    // Wrapped, so actions that return nothing are stored too.
    await tx.update(requestKeys).set({ result: { value: result ?? null } }).where(eq(requestKeys.id, key));
    return { replay: false as const, result };
  });
  if (!outcome.replay) return outcome.result;

  const [previous] = await dbx.select().from(requestKeys).where(eq(requestKeys.id, key));
  const stored = previous?.result as { value: T } | null | undefined;
  if (!previous || previous.userId !== userId || previous.action !== action || !stored) {
    throw new ActionError("ეს მოთხოვნა უკვე გაიგზავნა — განაახლეთ გვერდი.");
  }
  return stored.value;
}

/** Housekeeping: keys only matter for retries within minutes; keep a month for the audit trail. */
export async function deleteOldRequestKeys(dbx: DbOrTx): Promise<void> {
  await dbx.delete(requestKeys).where(lt(requestKeys.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));
}
