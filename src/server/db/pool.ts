import pg from "pg";

import { parseConnectionString } from "./connection-string";

// Return DATE columns as "YYYY-MM-DD" strings instead of JS Dates (no timezone shifts).
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

/** Shared by the app (`./index.ts`) and the CLI scripts (which cannot import `server-only`). */
export function createPool(connectionString: string | undefined, options: pg.PoolConfig = {}) {
  if (!connectionString || connectionString.includes("[YOUR-PASSWORD]")) {
    throw new Error(
      "Database URL is not configured. Fill DATABASE_URL / DATABASE_URL_SESSION in .env.local (see .env.example).",
    );
  }
  // Discrete fields (not a URL) so passwords with @ # / ? % work without encoding.
  const c = parseConnectionString(connectionString);
  const isLocal = c.host === "localhost" || c.host === "127.0.0.1";
  return new pg.Pool({
    host: c.host,
    port: c.port,
    user: c.user,
    password: c.password,
    database: c.database,
    // Supabase terminates TLS at the pooler; traffic is encrypted, the shared cert is not pinned.
    ssl: isLocal ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
    ...options,
  });
}
