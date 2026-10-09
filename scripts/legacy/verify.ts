/**
 * Re-checks an import against the old database and writes
 * docs/migration/legacy-import-report.md.
 *
 *   npm run legacy:verify      (also runs automatically after legacy:import)
 *
 * "Must match" checks compare what the old app showed (debts, balances,
 * stock, wages, totals) with what the new app computes. Any difference fails.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";

import { Decimal } from "../../src/lib/money";
import { createPool } from "../../src/server/db/pool";
import * as s from "../../src/server/db/schema";
import { DROPPED_FINANCE_ROWS, STORE_SETS } from "./config";
import { legacyDate, money4, phpInt, phpNumber } from "./php";
import { type Legacy, openLegacy } from "./source";
import { buildImport, type ImportNotes } from "./transform";

type Db = NodePgDatabase<typeof s>;

interface Check {
  name: string;
  mustMatch: boolean;
  ok: boolean;
  detail: string;
  samples?: string[];
}

const fmt = (d: Decimal | string | number) => new Decimal(d).toDecimalPlaces(4).toString();

async function q<T>(db: Db, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

export async function runVerification(args: {
  legacy: Legacy;
  db: Db;
  notes: ImportNotes;
  counts: Record<string, number>;
}): Promise<boolean> {
  const { legacy, db, notes, counts } = args;
  const checks: Check[] = [];
  const stores = await q<{ id: number; legacy_key: string; name: string }>(
    db,
    sql`SELECT id, legacy_key, name FROM app.stores ORDER BY id`,
  );
  const storeByKey = new Map(stores.map((st) => [st.legacy_key, st]));

  for (const set of STORE_SETS) {
    const store = storeByKey.get(set.key);
    if (!store) {
      checks.push({ name: `${set.key}: store exists`, mustMatch: true, ok: false, detail: "missing" });
      continue;
    }
    const sx = set.suffix;
    const label = `${store.name} (${set.key})`;

    // 1. Running customer debt after every delivery == old stored `darchenili`.
    {
      const oldRows = await legacy.rows(`SELECT id, darchenili FROM distribution${sx}`);
      const expected = new Map(oldRows.map((r) => [Number(r.id), money4(r.darchenili)]));
      const newRows = await q<{ number: number; debt: string }>(
        db,
        sql`SELECT number, SUM(total_amount - paid_amount + adjustment_amount)
              OVER (PARTITION BY customer_id ORDER BY id) AS debt
            FROM app.deliveries WHERE store_id = ${store.id}`,
      );
      const bad: string[] = [];
      for (const r of newRows) {
        const exp = expected.get(r.number);
        if (!exp || !exp.equals(r.debt)) bad.push(`#${r.number}: old ${exp ? fmt(exp) : "∅"} new ${fmt(r.debt)}`);
      }
      const missing = oldRows.length - newRows.length;
      checks.push({
        name: `${label}: customer debt after each operation`,
        mustMatch: true,
        ok: bad.length === 0 && missing === 0,
        detail: `${newRows.length} operations compared, ${bad.length} differ, ${missing} missing`,
        samples: bad.slice(0, 10),
      });
    }

    // 2. Current debt per customer (what the old customer list showed).
    {
      const old = await legacy.rows(
        `SELECT d.company_id, d.darchenili FROM distribution${sx} d
         JOIN (SELECT company_id, MAX(id) mid FROM distribution${sx} GROUP BY company_id) x ON x.mid = d.id`,
      );
      const newRows = await q<{ legacy_id: number; debt: string }>(
        db,
        sql`SELECT c.legacy_id, COALESCE(SUM(d.total_amount - d.paid_amount + d.adjustment_amount), 0) AS debt
            FROM app.customers c JOIN app.deliveries d ON d.customer_id = c.id
            WHERE c.store_id = ${store.id} GROUP BY c.legacy_id`,
      );
      const newMap = new Map(newRows.map((r) => [Number(r.legacy_id), new Decimal(r.debt)]));
      let oldNet = new Decimal(0);
      let oldPositive = new Decimal(0);
      const bad: string[] = [];
      for (const r of old) {
        const exp = money4(r.darchenili);
        oldNet = oldNet.plus(exp);
        if (exp.gt(0)) oldPositive = oldPositive.plus(exp);
        const got = newMap.get(phpInt(r.company_id));
        if (!got || !got.equals(exp)) bad.push(`customer ${r.company_id}: old ${fmt(exp)} new ${got ? fmt(got) : "∅"}`);
      }
      const newNet = [...newMap.values()].reduce((a, b) => a.plus(b), new Decimal(0));
      checks.push({
        name: `${label}: current debt of every customer`,
        mustMatch: true,
        ok: bad.length === 0,
        detail: `${old.length} customers, ${bad.length} differ. Net debt old ${fmt(oldNet)} / new ${fmt(newNet)}; positive-only total ${fmt(oldPositive)}`,
        samples: bad.slice(0, 10),
      });
    }

    // 3. Delivery and item totals.
    {
      const old = await legacy.rows(`SELECT money, fullamount FROM distribution${sx}`);
      const oldTotal = old.reduce((a, r) => a.plus(money4(r.fullamount)), new Decimal(0));
      const oldPaid = old.reduce((a, r) => a.plus(money4(r.money)), new Decimal(0));
      const [n] = await q<{ total: string; paid: string }>(
        db,
        sql`SELECT COALESCE(SUM(total_amount),0) total, COALESCE(SUM(paid_amount),0) paid FROM app.deliveries WHERE store_id = ${store.id}`,
      );
      const ok = oldTotal.equals(n.total) && oldPaid.equals(n.paid);
      checks.push({
        name: `${label}: Σ operation totals and Σ money taken`,
        mustMatch: true,
        ok,
        detail: `total old ${fmt(oldTotal)} / new ${fmt(n.total)}; paid old ${fmt(oldPaid)} / new ${fmt(n.paid)}`,
      });
    }

    // 4. Stock of every product.
    {
      const old = await legacy.rows(`SELECT id, count FROM drinks${sx}`);
      const newRows = await q<{ legacy_id: number; stock_qty: number }>(
        db,
        sql`SELECT legacy_id, stock_qty FROM app.products WHERE store_id = ${store.id} AND legacy_id IS NOT NULL`,
      );
      const newMap = new Map(newRows.map((r) => [Number(r.legacy_id), Number(r.stock_qty)]));
      const bad = old
        .filter((r) => newMap.get(Number(r.id)) !== phpInt(r.count))
        .map((r) => `product ${r.id}: old ${r.count} new ${newMap.get(Number(r.id))}`);
      checks.push({
        name: `${label}: warehouse stock of every product`,
        mustMatch: true,
        ok: bad.length === 0,
        detail: `${old.length} products, ${bad.length} differ`,
        samples: bad.slice(0, 10),
      });
    }

    // 5. Cash books: balance after every entry, final balance, monthly report.
    for (const book of set.finance) {
      if (!(await legacy.tableExists(book.table))) continue;
      const [account] = await q<{ id: number }>(
        db,
        sql`SELECT id FROM app.finance_accounts WHERE store_id = ${store.id} AND legacy_table = ${book.table}`,
      );
      const old = await legacy.rows(`SELECT id, date, money, darchenili, balance FROM ${book.table} ORDER BY id`);
      const expected = new Map(old.map((r) => [Number(r.id), money4(r.balance)]));
      const newRows = await q<{ legacy_id: number; balance: string }>(
        db,
        sql`SELECT legacy_id, SUM(amount_in - amount_out + adjustment_amount) OVER (ORDER BY id) AS balance
            FROM app.finance_entries WHERE account_id = ${account.id}`,
      );
      const bad: string[] = [];
      for (const r of newRows) {
        const exp = expected.get(Number(r.legacy_id));
        if (!exp || !exp.equals(r.balance)) bad.push(`entry ${r.legacy_id}: old ${exp ? fmt(exp) : "∅"} new ${fmt(r.balance)}`);
      }
      const oldFinal = old.length ? money4(old[old.length - 1].balance) : new Decimal(0);
      const newFinal = newRows.length ? new Decimal(newRows[newRows.length - 1].balance) : new Decimal(0);
      checks.push({
        name: `${label}: ${book.name} (${book.table}) balance after every entry`,
        mustMatch: true,
        ok: bad.length === 0 && oldFinal.equals(newFinal),
        detail: `${newRows.length} entries compared, ${bad.length} differ. Final balance old ${fmt(oldFinal)} / new ${fmt(newFinal)}`,
        samples: bad.slice(0, 10),
      });

      // Old "თვის ბრუნვა" page: floatval(str_replace([',', ' '], '', value)) per month.
      const monthOld = new Map<string, { out: Decimal; inc: Decimal }>();
      const monthArith = new Map<string, { out: Decimal; inc: Decimal }>();
      const removed = new Set(DROPPED_FINANCE_ROWS[book.table] ?? []);
      for (const r of old) {
        if (removed.has(Number(r.id))) continue; // left out on purpose (see config.ts)
        const iso = legacyDate(r.date);
        if (!iso) continue;
        const m = iso.slice(0, 7);
        const page = monthOld.get(m) ?? { out: new Decimal(0), inc: new Decimal(0) };
        page.out = page.out.plus(phpNumber((r.money ?? "").replace(/[, ]/g, "")));
        page.inc = page.inc.plus(phpNumber((r.darchenili ?? "").replace(/[, ]/g, "")));
        monthOld.set(m, page);
        const ar = monthArith.get(m) ?? { out: new Decimal(0), inc: new Decimal(0) };
        ar.out = ar.out.plus(money4(r.money));
        ar.inc = ar.inc.plus(money4(r.darchenili));
        monthArith.set(m, ar);
      }
      const monthNew = await q<{ m: string; out: string; inc: string }>(
        db,
        sql`SELECT to_char(entry_date, 'YYYY-MM') m, SUM(amount_out) AS out, SUM(amount_in) AS inc
            FROM app.finance_entries WHERE account_id = ${account.id} GROUP BY 1`,
      );
      const newMonth = new Map(monthNew.map((r) => [r.m, r]));
      const arithBad: string[] = [];
      const pageDiff: string[] = [];
      for (const [m, ar] of monthArith) {
        // A month that only had all-zero rows has no entries now (they are dropped on import).
        const got = newMonth.get(m) ?? { out: "0", inc: "0" };
        if (!ar.out.equals(got.out) || !ar.inc.equals(got.inc)) {
          arithBad.push(`${m}: expected out ${fmt(ar.out)} in ${fmt(ar.inc)}, new ${fmt(got.out)} / ${fmt(got.inc)}`);
        }
        const page = monthOld.get(m)!;
        if (!page.out.toDecimalPlaces(4).equals(ar.out) || !page.inc.toDecimalPlaces(4).equals(ar.inc)) {
          pageDiff.push(`${m}: old page out ${fmt(page.out)} in ${fmt(page.inc)} → now ${fmt(ar.out)} / ${fmt(ar.inc)}`);
        }
      }
      checks.push({
        name: `${label}: ${book.name} monthly totals`,
        mustMatch: true,
        ok: arithBad.length === 0,
        detail: `${monthArith.size} months. ${pageDiff.length} month(s) look different from the old monthly page because it read text like "1072,3" as 10723 (the balance used 1072).`,
        samples: [...arithBad.slice(0, 5), ...pageDiff.slice(0, 10)],
      });
    }

    // 6. Supplier "remaining to pay" (old page truncated every amount to whole lari).
    {
      const suppliers = await legacy.rows(`SELECT id, name FROM momwodebeli${sx}`);
      const defaultBook = set.finance.find((b) => b.isDefault)!.table;
      const diffs: string[] = [];
      for (const sup of suppliers) {
        const batches = await legacy.rows(
          `SELECT SUM(drink_in * shemotan_price) AS ttt FROM drinks${sx}_history WHERE momwodebeli_id = ? GROUP BY id, date`,
          [Number(sup.id)],
        );
        const oldPayable = batches.reduce((a, b) => a + Math.trunc(Number(b.ttt ?? 0)), 0);
        const payments = await legacy.rows(`SELECT money FROM ${defaultBook} WHERE comment = ?`, [sup.name ?? ""]);
        const oldPaid = payments.reduce((a, p) => a + phpInt(p.money), 0);
        const [n] = await q<{ payable: string; paid: string }>(
          db,
          sql`SELECT
                (SELECT COALESCE(SUM(i.quantity * i.unit_cost), 0) FROM app.stock_receipt_items i
                   JOIN app.stock_receipts r ON r.id = i.receipt_id JOIN app.suppliers su ON su.id = r.supplier_id
                  WHERE su.store_id = ${store.id} AND su.legacy_id = ${Number(sup.id)}) AS payable,
                (SELECT COALESCE(SUM(f.amount_out), 0) FROM app.finance_entries f JOIN app.suppliers su ON su.id = f.supplier_id
                  WHERE su.store_id = ${store.id} AND su.legacy_id = ${Number(sup.id)}) AS paid`,
        );
        const oldRemaining = oldPayable - oldPaid;
        const newRemaining = new Decimal(n.payable).minus(n.paid);
        if (!newRemaining.equals(oldRemaining)) {
          diffs.push(
            `${sup.name}: old ${oldPayable} − ${oldPaid} = ${oldRemaining}; now ${fmt(n.payable)} − ${fmt(n.paid)} = ${fmt(newRemaining)}`,
          );
        }
      }
      checks.push({
        name: `${label}: supplier "remaining to pay"`,
        mustMatch: false,
        ok: diffs.length === 0,
        detail: diffs.length
          ? `${diffs.length} supplier(s) differ. The old page cut every receipt and payment to whole lari ((int) cast); the new one is exact.`
          : `${suppliers.length} suppliers, identical`,
        samples: diffs.slice(0, 15),
      });
    }

    // 7. Customer "all days together" summary (old page summed items by their own company_id).
    {
      const old = await legacy.rows(
        `SELECT company_id, SUM(drink_in) qty, SUM(drink_sum) total FROM drinks${sx}_count GROUP BY company_id`,
      );
      const newRows = await q<{ legacy_id: number; qty: string; total: string }>(
        db,
        sql`SELECT c.legacy_id, SUM(i.quantity) qty, SUM(i.line_total) total
            FROM app.delivery_items i JOIN app.deliveries d ON d.id = i.delivery_id JOIN app.customers c ON c.id = d.customer_id
            WHERE d.store_id = ${store.id} GROUP BY c.legacy_id`,
      );
      const newMap = new Map(newRows.map((r) => [Number(r.legacy_id), r]));
      const diffs: string[] = [];
      for (const r of old) {
        const got = newMap.get(phpInt(r.company_id));
        const oldTotal = new Decimal(Number(r.total ?? 0)).toDecimalPlaces(2);
        const newTotal = new Decimal(got?.total ?? 0).toDecimalPlaces(2);
        if (!oldTotal.equals(newTotal)) diffs.push(`customer ${r.company_id}: old ${fmt(oldTotal)} new ${fmt(newTotal)}`);
      }
      checks.push({
        name: `${label}: customer "all days together" totals`,
        mustMatch: false,
        ok: diffs.length === 0,
        detail: diffs.length
          ? `${diffs.length} customer(s) differ: the old page also counted item rows of deleted operations and of operations later moved to another customer.`
          : "identical",
        samples: diffs.slice(0, 10),
      });
    }
  }

  // 8. Employee wages.
  {
    const old = await legacy.rows("SELECT id, name, wage FROM employees");
    const newRows = await q<{ legacy_id: number; wage_balance: string }>(
      db,
      sql`SELECT legacy_id, wage_balance FROM app.employees`,
    );
    const newMap = new Map(newRows.map((r) => [Number(r.legacy_id), new Decimal(r.wage_balance)]));
    const bad = old
      .filter((r) => !newMap.get(Number(r.id))?.equals(money4(r.wage)))
      .map((r) => `${r.name}: old ${r.wage} new ${newMap.get(Number(r.id))}`);
    checks.push({
      name: "Employees: unpaid wage balance",
      mustMatch: true,
      ok: bad.length === 0,
      detail: `${old.length} employees, ${bad.length} differ`,
      samples: bad,
    });
  }

  const failed = checks.filter((c) => c.mustMatch && !c.ok);
  await writeReport(checks, notes, counts);
  for (const c of checks) {
    const mark = c.ok ? "✓" : c.mustMatch ? "✗" : "ℹ";
    console.log(`${mark} ${c.name} — ${c.detail}`);
  }
  console.log(failed.length ? `\n${failed.length} MUST-MATCH CHECK(S) FAILED` : "\nAll must-match checks passed.");
  return failed.length === 0;
}

async function writeReport(checks: Check[], notes: ImportNotes, counts: Record<string, number>) {
  const lines: string[] = [];
  const now = new Date().toISOString().replace("T", " ").slice(0, 16);
  lines.push("# Legacy import report", "", `Generated ${now} UTC by \`npm run legacy:verify\`.`, "");
  lines.push("## Checks", "", "| | Check | Result |", "|---|---|---|");
  for (const c of checks) {
    const mark = c.ok ? "✅" : c.mustMatch ? "❌" : "ℹ️";
    lines.push(`| ${mark} | ${c.name} | ${c.detail.replace(/\|/g, "\\|")} |`);
  }
  const withSamples = checks.filter((c) => c.samples?.length);
  if (withSamples.length) {
    lines.push("", "### Details", "");
    for (const c of withSamples) {
      lines.push(`**${c.name}**`, "", ...c.samples!.map((x) => `- ${x}`), "");
    }
  }
  lines.push("", "## Rows written", "", "| Table | Rows |", "|---|---|");
  for (const [k, v] of Object.entries(counts)) lines.push(`| ${k} | ${v} |`);

  lines.push("", "## What the import cleaned or reconstructed", "");
  lines.push(
    "- **All-zero item rows dropped.** The old forms saved a row for every product on every operation; rows with nothing delivered, gifted or left over change no total:",
  );
  for (const d of notes.droppedZeroItemRows) lines.push(`  - ${d.store} \`${d.table}\`: ${d.rows}`);
  lines.push("- **Zero cash-book rows dropped** (the old list already hid them; they never changed a balance):");
  for (const d of notes.droppedZeroFinanceRows) lines.push(`  - \`${d.table}\`: ${d.count}`);
  for (const d of notes.removedFinanceRows)
    lines.push(
      `- **Typo rows left out at the owner's request:** \`${d.table}\` ids ${d.ids.join(", ")} (20 000 000 000 005 ₾ entered and reversed; their −0.20 net moved into the next entry's correction, so balances are unchanged).`,
    );
  lines.push(
    "- **Manual debt corrections kept as adjustments.** Where the stored debt did not follow `previous + total − paid` (edits made directly in the database), the difference is stored on that operation so every debt stays exactly as it was:",
  );
  for (const d of notes.deliveryAdjustments) lines.push(`  - ${d.store}: ${d.count} operation(s), net ${d.total} ₾`);
  lines.push("- **Manual balance corrections kept as adjustments** (same idea for cash books):");
  for (const d of notes.financeAdjustments) lines.push(`  - \`${d.table}\`: ${d.count} entr(ies), net ${d.total} ₾`);
  lines.push("- **Cash-book entries linked** (by exact name, as the old supplier/wage pages matched them):");
  for (const d of notes.financeLinks)
    lines.push(`  - \`${d.table}\`: ${d.delivery} to operations, ${d.supplier} to suppliers, ${d.employee} to employees`);
  if (notes.placeholderProducts.length)
    lines.push(
      `- **${notes.placeholderProducts.length} deleted product(s)** still referenced by history were recreated as archived "[წაშლილი პროდუქტი #id]".`,
    );
  if (notes.placeholderCustomers.length)
    lines.push(
      `- **${notes.placeholderCustomers.length} deleted customer(s)** still referenced by operations were recreated as archived "[წაშლილი ობიექტი #id]".`,
    );
  for (const o of notes.orphanDeliveryItems)
    lines.push(
      `- **${o.store}: ${o.rows} item row(s) of ${o.deliveries} deleted operation(s) not imported** (qty ${o.quantity}, ${o.total} ₾). The operations themselves were deleted in the old DB; only their item rows were left behind.`,
    );
  for (const o of notes.orphanOrderItems) lines.push(`- **${o.store}: ${o.rows} item row(s) of deleted orders not imported.**`);
  for (const sk of notes.skippedEmptyReceipts)
    if (sk.count) lines.push(`- ${sk.store}: ${sk.count} stock receipt(s) saved without any quantity skipped (no stock effect).`);
  for (const c of notes.emptyReceiptComments)
    lines.push(`  - ${c.store} ${c.date}: comment kept here for the record — "${c.comment.replace(/\s+/g, " ")}"`);
  if (notes.unknownOrderStatuses.length)
    lines.push(`- Unknown order statuses imported as cancelled: ${JSON.stringify(notes.unknownOrderStatuses)}`);
  if (notes.ambiguousNames.length) lines.push(`- Duplicate names (linked to the first match): ${notes.ambiguousNames.join(", ")}`);
  if (notes.nonIntegerQuantities.length)
    lines.push(`- Non-integer quantities truncated: ${notes.nonIntegerQuantities.length}`);
  lines.push(
    "",
    `### Text typed into number fields (${notes.dirtyValues.length})`,
    "",
    "The old app stored numbers as text and PHP read only the leading number. The import uses exactly the value PHP used; the original text is kept in the row's `legacy` column.",
    "",
    "| Table | Column | Row | Stored text | Used as |",
    "|---|---|---|---|---|",
  );
  for (const d of notes.dirtyValues.slice(0, 200))
    lines.push(`| ${d.table} | ${d.column} | ${d.id} | \`${JSON.stringify(d.raw).slice(1, -1).replace(/\|/g, "\\|")}\` | ${d.usedAs} |`);

  const file = path.join(process.cwd(), "docs", "migration", "legacy-import-report.md");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${lines.join("\n")}\n`);
  console.log(`Report written to ${path.relative(process.cwd(), file)}`);
}

// Standalone: npm run legacy:verify
if (import.meta.url === `file://${process.argv[1]}`) {
  const legacy = await openLegacy();
  const pool = createPool(process.env.DATABASE_URL_SESSION, { max: 2 });
  try {
    const db = drizzle({ client: pool, schema: s, casing: "snake_case" });
    const { data, notes } = await buildImport(legacy);
    const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
    const ok = await runVerification({ legacy, db, notes, counts });
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
    await legacy.close();
  }
}
