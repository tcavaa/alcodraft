# Architecture

## Folder structure

```
src/
  app/                         routes only (thin): fetch via queries, render components
    page.tsx                   / — public one-page site
    admin/login/               /admin/login
    admin/(panel)/             everything behind login (sidebar layout)
      page.tsx                 /admin — overview of my stores
      orders/                  /admin/orders — open orders of all my stores
      account/                 my name + password
      settings/{stores,users,audit}   super admin only
      stores/[storeId]/        one store; every store has the same sections:
        page.tsx               dashboard
        operations/            old "distribution" (list, new, [id], [id]/edit)
        orders/                old "orders" (list/history, new, [id] = edit/complete)
        customers/             old "company" (list, new, [id], [id]/edit)
        products/              old "drinks"
        stock/                 old drinks/stock + history (receipts)
        suppliers/             old "momwodebeli" (+ payments, old historylistmomw)
        finance/               old "finance" (cash book) + monthly/
        employees/             old "employees" (+ wages, old historywages)
  features/<feature>/          domain code, grouped by feature
    queries.ts                 reads (server-only)
    service.ts                 writes — business rules, run inside a transaction
    actions.ts                 "use server" — validate (zod) → authorize → service → refresh/redirect
    logic.ts                   pure calculation rules shared by server and forms (+ *.test.ts)
    components/                feature UI (client components when interactive)
  components/                  shared UI: layout (sidebar, ⌘K), data (tables, pagination, filters), forms, ui/ (shadcn)
  hooks/                       use-action-form (forms), use-server-action (buttons/dialogs), use-request-id
  server/
    db/                        drizzle client (lazy), pool, schema/*.ts, helpers (locks, numbering),
                               expressions.ts (debt / cash / supplier-paid formulas), once.ts (double submits)
    auth/                      session, password, dal.ts (requireUser/requireStore/authorize*)
    action.ts                  runAction() + ActionError + parseInput() (uniform action results)
    audit.ts                   audit() — one line per important change
  lib/                         money, dates, validation, routes, search-params (no server deps)
  proxy.ts                     optimistic redirect to /admin/login when there is no session cookie
scripts/
  db/migrate.ts                apply drizzle/ migrations
  legacy/                      old MySQL → Postgres import + verification
drizzle/                       generated SQL migrations (commit them)
docs/                          this documentation
```

Feature folders: `sales` (operations + orders), `customers`, `products`, `stock` (receipts + suppliers),
`finance` (cash book + employees/wages), `catalog/service.ts` (product/supplier/customer writes),
`dashboard`, `search` (⌘K), `admin` (stores, users, account), `auth`.

## Request flow

```
browser ──► proxy.ts (no cookie? → /admin/login)
        ──► page (server component, inside loading.tsx Suspense)
              requireStore(params.storeId)        ← DAL: session from DB, store access, else 404
              features/x/queries.ts               ← Drizzle, one or two SQL queries per page
        ◄── streamed HTML (static shell first: sidebar skeleton + page skeleton)

form submit ──► Server Action (features/x/actions.ts)
                  runAction(async () => {
                    authorizeStore(storeId)        ← never trust the client
                    parseInput(schema, input)      ← zod; Georgian field errors
                    db.transaction(tx => service(tx, actor, data))   ← locks, stock, numbers, audit
                      (creates: once(db, { key: requestId, … }, tx => service(…)) — no double booking)
                    refresh() | redirect(...)
                  })
```

## Cache Components (Next 16) rules we follow

- `cacheComponents: true`, `partialPrefetching: true` (see `next.config.ts`). We do **not** use
  `"use cache"` for business data — numbers must always be live.
- **Every page folder** under `/admin` has its own `loading.tsx` (skeletons in `src/components/page-skeleton.tsx`).
  A parent folder's `loading.tsx` does not cover a click between sibling pages (the shared layout stays
  mounted), so without one per page the navigation blocks and the dev overlay reports a blocking-route
  insight. Pages may then `await` params/cookies/DB at the top.
- Layout parts that need the session (sidebar) or the URL (⌘K palette) are wrapped in `<Suspense>`.
- Nothing random or time-dependent renders in the static shell (fixed skeleton widths; date
  presets computed in click handlers).
- After a mutation: `refresh()` (stay on page) or `redirect()` (go to the new document).
- Route ids go through `idParam()` (`src/lib/search-params.ts`): anything that isn't a positive
  integer that fits the column is a 404, never a database error.
- Errors: `app/global-error.tsx` (root layout), `app/admin/error.tsx` (login, panel layout),
  `app/admin/(panel)/error.tsx` (pages) — all Georgian, with the digest to find the server log line.
- Build (`npm run build`) fails loudly when a rule is broken — run it before shipping.

## Authentication & authorization

- `users` table; `sessions` table stores **sha256(token)**, cookie `alcodraft_session`
  (httpOnly, sameSite=lax, secure in production), 30 days sliding.
- Passwords: bcrypt (12 rounds). Imported users have `legacy_md5_bcrypt` = bcrypt(md5(password));
  first successful login rewrites the hash to plain bcrypt (`src/server/auth/password.ts`).
- Login: input that isn't an e-mail / password of sane length is refused before any database work.
  Throttling counts `auth.login_failed` rows of the last 15 minutes **from the same IP** — 10 per
  (IP, e-mail), 30 per IP — so nobody can lock a colleague out from elsewhere. Every attempt is written
  before the password is checked (a success rewrites it to `auth.login`, a refused one to
  `auth.login_throttled`, which doesn't count), so parallel guesses count each other.
- Roles: `super_admin` (all stores, user/store management, hard deletes) and `user`
  (only stores in `user_stores`). Deactivating a user or resetting a password deletes their sessions.
- `requireStore()` → 404 for stores you can't open (no information leak);
  `authorizeStore(storeId, { superAdminOnly })` → `ActionError` inside actions.
- Super-admin-only actions: delete operation / receipt / cash entry, hard-delete customer /
  product / supplier, rename a cash book, everything under Settings. (Cash books can't be created
  from the UI: every store gets one on creation; stores 1–2 keep their imported second book.)

## Database access

- `src/server/db/index.ts` exports a lazy `db` (pool created on first query, so builds need no DB).
- Runtime uses Supabase's **transaction pooler** (`DATABASE_URL`, port 6543); scripts use the
  **session pooler** (`DATABASE_URL_SESSION`, port 5432). Direct connections are IPv6-only on the
  free plan and Vercel is IPv4, so the poolers are required.
- `attachDatabasePool()` from `@vercel/functions` closes idle connections before a Fluid
  compute instance suspends.
- Row locks: `lockProducts()` (`SELECT … FOR UPDATE`) before any stock change; document numbers
  come from per-store counters updated atomically (`nextNumber()`).
