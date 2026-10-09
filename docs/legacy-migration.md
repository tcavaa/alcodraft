# Importing the old database

Source: the phpMyAdmin dump of `alcodraf_base` (MySQL 5.7, PHP 7.3 app).
Target: Supabase Postgres (`app` schema). Code: `scripts/legacy/`.

## Run it

```bash
# 1. Load the dump into a local MySQL (once per fresh dump)
mysql -uroot -e "DROP DATABASE IF EXISTS alcodraft_legacy; CREATE DATABASE alcodraft_legacy CHARACTER SET utf8mb4;"
mysql -uroot --default-character-set=utf8mb4 alcodraft_legacy < ../alcodraf_base.sql

# 2. Schema up to date on the target
npm run db:migrate

# 3. Transform only — prints counts and everything it cleaned
npm run legacy:import -- --dry-run

# 4. Import (one transaction). --reset wipes all app.* data first (dev / final cutover)
npm run legacy:import -- --reset
```

The import ends by running the verification (`npm run legacy:verify` re-runs it any time) and writes
[docs/migration/legacy-import-report.md](migration/legacy-import-report.md). The exit code is
non-zero if any must-match check fails.

## What is verified (must match exactly)

- Customer debt after **every** operation = old `darchenili`; current debt of every customer.
- Cash-book balance after **every** entry and the final balance of every book.
- Stock of every product; every employee's unpaid wage.
- Σ operation totals and Σ money taken per store; monthly cash-book totals.

Informational (expected differences, explained in the report): supplier remaining amounts (old
`(int)` truncation), customer "all days together" totals (old page counted orphan item rows),
months where the old monthly page misread typos.

## Cleaning rules (transform.ts)

| Situation in the old data | What the import does |
|---|---|
| Item rows with nothing delivered/gifted/left (one per product per form; 97% of rows) | dropped |
| Cash-book rows with 0 expense and 0 income (old list hid them) | dropped |
| Typo pair in გეალკო თბილისი „ფინანსები“ (ids 2442/2443: 20 000 000 000 005 ₾ out, then in — an attempt to zero a 0.20 float leftover) | left out at the owner's request (`DROPPED_FINANCE_ROWS` in `config.ts`); their −0.20 net goes into the next entry's correction, so balances are unchanged |
| Text in number fields (`"30 ზაზას ბენზინი"`, `"1072,3"`, `"გასწორება"`) | value PHP 7 used (`scripts/legacy/php.ts`, tested against real PHP 7.4); raw text kept in the row's `legacy` jsonb |
| Stored debt/balance that doesn't follow the formula (manual DB edits) | difference stored in `adjustment_amount` → every number identical |
| Rows pointing at deleted products/customers | recreated as archived `[წაშლილი პროდუქტი #id]` / `[წაშლილი ობიექტი #id]` |
| Item rows of deleted operations/orders (orphans) | not imported, counted in the report |
| Receipt batches merged by an INT overflow (ids 2147483647…) | split by (id, date, supplier, comment), numbered in insertion order |
| Receipts saved without any quantity | skipped; their comments listed in the report |
| Comments with leading/trailing whitespace (old order form indentation) | trimmed; placeholder text `Comment` cleared |
| Finance rows whose text equals a supplier/employee name | linked to that supplier/employee (old pages matched exactly this way) |
| Customer payments (`"<name> cash"` on the same date and amount) | linked to their operation |
| Users | e-mail lower-cased, password hash = bcrypt(old md5), role super_admin for `admin@alcodraft.ge`, store access copied from the old menu rules |
| `hours`, `time*` tables | not imported (unused experiment / dead tables) |

Document numbers continue: operations and orders keep their old ids as `number`, and each store's
`next_*_number` starts at the old AUTO_INCREMENT.

## Go-live cutover

1. Announce a short stop of the old system; make sure nobody saves.
2. Export a fresh dump from cPanel → phpMyAdmin → `alcodraf_base` → Export (SQL).
3. Load it locally (step 1 above), run `npm run legacy:import -- --reset`. If the old app got a new
   store copy (`drinks7`, `finance13`, …) since this project was built, add it to `STORE_SETS` in
   `scripts/legacy/config.ts` first — the import only reads the table sets listed there.
4. Check the report: all ✅; skim the ℹ️ items.
5. Tell users to sign in at `https://alcodraft.vercel.app/admin` with their old e-mail and password.
6. Keep the old app read-only (or offline) and the dump archived.
