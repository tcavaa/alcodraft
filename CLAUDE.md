# AlcoDraft — project guide

In-house back office for **AlcoDraft**, a Georgian wine & spirits distributor. Rewrite of an old
PHP/CodeIgniter app that kept one copy of every table per store; here every store shares one
schema (`store_id`), and every store has every feature. **The business calculations must stay
exactly as in the old app** (debts, balances, stock) — they are documented and tested.

@AGENTS.md

## Stack (one line each)

- Next.js 16 App Router, **Cache Components + Partial Prefetching on**, React 19, React Compiler, TypeScript.
- Postgres on **Supabase**, accessed directly with **Drizzle ORM** + `pg` (no Supabase JS client, no Supabase Auth).
- Tailwind CSS 4 + shadcn/ui (Radix, "nova" preset) · Georgian UI · Vercel hosting (region `fra1`).
- Own auth: DB sessions, bcrypt; imported users keep their old passwords (bcrypt(md5) → upgraded on login).

## Commands

```bash
npm run dev            # http://localhost:3000  (/ = public page, /admin = panel)
npm run build          # production build (catches Cache Components mistakes)
npm run lint && npm run typecheck && npm test
npm run db:generate    # SQL migration from schema changes (drizzle/)
npm run db:migrate     # apply migrations to DATABASE_URL_SESSION
npm run legacy:import -- --dry-run|--reset   # old MySQL → Postgres (see docs/legacy-migration.md)
npm run legacy:verify  # re-check imported numbers, writes docs/migration/legacy-import-report.md
```

## Where to find what

| Topic | File |
|---|---|
| Folder structure, request flow, Cache Components rules, auth & access, Server Action pattern | [docs/architecture.md](docs/architecture.md) |
| Tables, old→new mapping, derived balances, migrations, Supabase security | [docs/database.md](docs/database.md) |
| **Every calculation rule** (operations, orders, stock, debts, cash book, wages) and intentional differences from the old app | [docs/business-logic.md](docs/business-logic.md) |
| Importing the old MySQL dump, data cleaning rules, verification, go-live cutover | [docs/legacy-migration.md](docs/legacy-migration.md) |
| Vercel + Supabase setup, env vars, backups, operations | [docs/deployment.md](docs/deployment.md) |
| Code conventions, money/date handling, adding a feature, testing | [docs/conventions.md](docs/conventions.md) |
| Design system: colors, typography, page patterns, components | [docs/ui.md](docs/ui.md) |
| Latest import verification report (generated) | [docs/migration/legacy-import-report.md](docs/migration/legacy-import-report.md) |

## Golden rules

1. **Money is exact.** `numeric(18,4)` in the DB, strings over the wire, `@/lib/money` (Decimal) for math. Never `Number()` an amount for arithmetic.
2. **Debts and cash balances are never stored** — they are sums over rows (see business-logic.md). Stock *is* stored (`products.stock_qty`) and only changed inside the same transaction as the document that moves it.
3. **Every write goes through a service in `src/features/*/service.ts`, inside `db.transaction`,** called from a Server Action that first authorizes with `authorizeStore()` / `authorizeSuperAdmin()`. Services write an `audit()` line.
4. **Pages authorize with `requireStore()` / `requireSuperAdmin()`** (they 404 when access is missing) and read through `src/features/*/queries.ts`.
5. **Cache Components:** anything that reads cookies, params, searchParams or the DB must be under a `<Suspense>` (every page folder has its own `loading.tsx` — add one with every new page). No `Date.now()`/`Math.random()` during render of static parts.
6. **UI text is Georgian**; code, comments and docs are English. Reuse the old app's wording where users know it (e.g. „დღის ჩახურვა“, „დარჩენილი“, „ნაშთი“).
7. Business dates are Tbilisi dates (`todayIso()`), stored as `date` strings `YYYY-MM-DD`.
