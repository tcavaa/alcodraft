/**
 * Imports the old PHP/MySQL Alcodraft database into the new Postgres schema.
 *
 *   npm run legacy:import -- --dry-run   transform only, print what would be written
 *   npm run legacy:import                import into an empty database
 *   npm run legacy:import -- --reset     wipe all app.* data first (dev, final cutover)
 *
 * Source: LEGACY_DATABASE_URL  (local MySQL with alcodraf_base.sql imported)
 * Target: DATABASE_URL_SESSION (Supabase session pooler)
 *
 * The whole import runs in one transaction, then verify.ts re-checks every
 * balance, debt and stock count against the old data and writes the report.
 */
import { getTableName, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";

import { createPool } from "../../src/server/db/pool";
import * as s from "../../src/server/db/schema";
import { openLegacy } from "./source";
import { buildImport, type ImportData } from "./transform";
import { runVerification } from "./verify";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const reset = args.has("--reset");

/** Insert order respects foreign keys. */
const TABLES: [keyof ImportData, PgTable][] = [
  ["stores", s.stores],
  ["financeAccounts", s.financeAccounts],
  ["suppliers", s.suppliers],
  ["products", s.products],
  ["productPriceChanges", s.productPriceChanges],
  ["customers", s.customers],
  ["employees", s.employees],
  ["wageAccruals", s.wageAccruals],
  ["deliveries", s.deliveries],
  ["deliveryItems", s.deliveryItems],
  ["orders", s.orders],
  ["orderItems", s.orderItems],
  ["stockReceipts", s.stockReceipts],
  ["stockReceiptItems", s.stockReceiptItems],
  ["financeEntries", s.financeEntries],
  ["users", s.users],
  ["userStores", s.userStores],
];

const legacy = await openLegacy();
try {
  const started = Date.now();
  const { data, notes } = await buildImport(legacy);
  const counts = Object.fromEntries(TABLES.map(([key]) => [key, data[key].length]));
  console.log(`Transformed legacy data in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.table(counts);

  if (dryRun) {
    console.log("Dry run — nothing written.");
    console.log(JSON.stringify({ ...notes, dirtyValues: notes.dirtyValues.length }, null, 2));
    process.exit(0);
  }

  const pool = createPool(process.env.DATABASE_URL_SESSION, { max: 2 });
  const db = drizzle({ client: pool, schema: s, casing: "snake_case" });
  try {
    const [{ stores }] = await db.select({ stores: sql<number>`count(*)::int` }).from(s.stores);
    if (stores > 0 && !reset) {
      throw new Error("The target database already has data. Re-run with --reset to wipe app.* tables first.");
    }

    await db.transaction(async (tx) => {
      if (reset) {
        const all = [...TABLES.map(([, t]) => t), s.sessions, s.auditLog, s.stockAdjustments];
        const list = all.map((t) => `"app"."${getTableName(t)}"`).join(", ");
        await tx.execute(sql.raw(`TRUNCATE ${list} RESTART IDENTITY CASCADE`));
        console.log("Wiped existing app data.");
      }
      for (const [key, table] of TABLES) {
        const rows = data[key] as Record<string, unknown>[];
        for (let i = 0; i < rows.length; i += 500) {
          await tx.insert(table).values(rows.slice(i, i + 500) as never);
        }
        console.log(`  ${getTableName(table).padEnd(24)} ${rows.length}`);
      }
      // Explicit ids were inserted; move every identity sequence past them.
      for (const [key, table] of TABLES) {
        if (key === "userStores") continue;
        const name = `app.${getTableName(table)}`;
        await tx.execute(
          sql.raw(
            `SELECT setval(pg_get_serial_sequence('${name}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${name}`,
          ),
        );
      }
      // Not in the old app: every store's „გამოტანილები“ supplier (goods taken back from customers,
      // see createCustomerReturn). Inserted after the sequences moved, so it gets a fresh id.
      await tx.execute(
        sql`INSERT INTO app.suppliers (store_id, name, is_customer_returns) SELECT id, 'გამოტანილები', true FROM app.stores`,
      );
      await tx.insert(s.auditLog).values({
        action: "legacy.import",
        entityType: "system",
        summary: "Imported the old Alcodraft (PHP/MySQL) database",
        details: { counts, reset },
      });
    });
    console.log("Import committed. Verifying …");

    const ok = await runVerification({ legacy, db, notes, counts });
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
} finally {
  await legacy.close();
}
