import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import { createPool } from "./pool";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
/** A transaction handle; services accept `DbOrTx` so they compose inside transactions. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

/**
 * One pool per server instance, created on first use (so `next build` needs no database).
 * DATABASE_URL must be Supabase's *transaction pooler* URL (port 6543).
 */
const globalForDb = globalThis as unknown as { alcodraftDb?: Db };

function instance(): Db {
  if (!globalForDb.alcodraftDb) {
    const pool = createPool(process.env.DATABASE_URL, { max: 5, idleTimeoutMillis: 5_000 });
    // On Vercel Fluid compute: close idle connections before the instance suspends.
    attachDatabasePool(pool);
    globalForDb.alcodraftDb = drizzle({ client: pool, schema, casing: "snake_case" });
  }
  return globalForDb.alcodraftDb;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    const real = instance();
    const value = Reflect.get(real, property, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});
