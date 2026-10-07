# Conventions

## Code

- TypeScript strict; `@/` = `src/`. Prettier formatting (`npx prettier --write`), ESLint (`npm run lint`).
- Server-only modules start with `import "server-only"` (queries, services, auth, db). Scripts under
  `scripts/` can't import those — they use `src/server/db/pool.ts` + schema directly.
- Names: tables/columns snake_case in SQL, camelCase in TS (Drizzle `casing: "snake_case"`).
  Old terms are kept in comments: `deliveries` = old `distribution`, `products` = old `drinks`, etc.
- Comments explain *why* or point to the old behaviour (`// Old rule: …`), not what the code does.

## Adding or changing a feature

1. Rule first: if it changes a calculation, update `docs/business-logic.md` and the pure function in
   `features/*/logic.ts` with a test.
2. Write path: service function in `features/x/service.ts` taking `(tx, actor, input)`; lock rows you
   change; call `audit()`.
3. Server Action in `features/x/actions.ts`: `runAction(async () => { authorizeStore(); parse(zod);
   db.transaction(...); refresh() | redirect() })`. Return Georgian messages via `ActionError`.
4. Read path: `features/x/queries.ts`; one query per list + one count query; paginate lists that grow.
5. Page in `src/app/admin/(panel)/stores/[storeId]/...`: `requireStore(params.storeId)` first; reuse
   `PageHeader`, `FilterTabs`, `SearchInput`, `Pagination`, `Money`, `EmptyState`.
6. `npm run typecheck && npm run lint && npm test && npm run build`.

## Money and numbers

- Never use floats for money. `dec()`, `sum()`, `toDb()`, `parseAmount()`, `formatMoney()` from `@/lib/money`.
- Display: Georgian format `1 234,50 ₾` (`formatMoney`) / `formatAmount` without the sign.
- Quantities are integers; negative delivered quantity = goods returned on an operation.
- Inputs: `inputMode="decimal"` text fields; server validates with `amount()` / `wholeNumber()` from
  `@/lib/validation`.

## Dates

- Business date = Tbilisi date: `todayIso()`; stored as `date`; shown `dd.mm.yyyy` (`formatDate`).
- Timestamps (`created_at`) are `timestamptz`; shown with `formatDateTime` in Tbilisi time.

## Testing

- `npm test` (Vitest): pure rules (`features/sales/logic.test.ts`) and the PHP-compatible legacy parser
  (`scripts/legacy/php.test.ts`).
- The legacy import has its own end-to-end verification (`npm run legacy:verify`).
- Manual check list before a release: create an operation, edit it, complete an order, receive stock,
  pay a supplier, pay a wage — then compare customer debt / stock / cash balance.

## Security checklist

- Every action authorizes on the server; never trust ids from the client without `store_id` checks
  (services always filter by `actor.storeId`).
- Super-admin-only for destructive and access-control operations.
- No secrets in the repo; `.env*` is git-ignored except `.env.example`.
