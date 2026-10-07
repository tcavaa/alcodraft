/**
 * Applies pending SQL migrations from ./drizzle to the database in
 * DATABASE_URL_SESSION (Supabase session pooler).
 *   npm run db:migrate
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { redactConnectionString } from "../../src/server/db/connection-string";
import { createPool } from "../../src/server/db/pool";

const url = process.env.DATABASE_URL_SESSION;
const pool = createPool(url, { max: 1 });

try {
  const db = drizzle({ client: pool });
  console.log(`Applying migrations to ${redactConnectionString(url!)} …`);
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Migrations are up to date.");
} finally {
  await pool.end();
}
