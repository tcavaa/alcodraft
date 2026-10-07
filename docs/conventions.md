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
3. Server Action in `features/x/actions.ts`: `runAction(async () => { authorizeStore();
   parseInput(schema, input); db.transaction(...); refresh() | redirect() })`. Return Georgian
   messages via `ActionError`. Creates that move money or stock take a `requestId` (`@/lib/validation`)
   and run through `once(db, { key, action, userId }, tx => …)` so a double submit books once.
4. Read path: `features/x/queries.ts`; one query per list + one count query; paginate lists that grow.
5. Page in `src/app/admin/(panel)/stores/[storeId]/...`: `requireStore(params.storeId)` first, ids via
   `idParam()`, query values via `intParam` / `enumParam` / `dateRangeParam`; reuse `PageHeader`,
   `FormPage` (new/edit pages), `TableCard` + `HeadRow`, `ArchivedTabs`, `FilterTabs`, `SearchInput`,
   `Pagination`, `Money`, `EmptyState`, `Notice`, `InfoRow`, `DocumentLinesTable`, `HistoryCard`.
   Tables: headers are `SortableHead` (`src/components/data/sortable-head.tsx`). Paginated lists sort in
   SQL — export `X_SORTS` from the query, take `sort: SortState | null`, map columns to expressions with
   `by(expr, dir)` (`src/server/db/order.ts`, NULLS LAST) and always end with the id so pages are stable.
   Small, fully loaded tables sort in memory with `sortRows()` (`src/lib/sort.ts` — amounts via `dec()`,
   same text order as the database). Read the param with `sortParam(sp, SORTS)`.
6. `npm run typecheck && npm run lint && npm test && npm run build`.

## Forms (client)

- `<form>` + FormData actions: `useActionForm(action)` (`src/hooks/use-action-form.ts`) — submits from
  `onSubmit`, so React doesn't reset the form: a failed save keeps what was typed and Radix
  checkboxes/selects never jump back to their first values. Pass `pending` to `SubmitButton`.
- Buttons and dialogs that call an action: `useServerAction()` — pending state, field errors (a message
  without a field lands in `_form`), toasts.
- Anything that moves money asks first (`ConfirmDialog` / `ConfirmAction`) and shows the amount;
  creates send `useRequestId().current()` and `renew()` it after a success.

## Money and numbers

- Never use floats for money. `dec()`, `sum()`, `toDb()`, `parseAmount()`, `formatMoney()` from `@/lib/money`.
- In SQL, debts and balances come from `src/server/db/expressions.ts` (`debtDelta`, `debtSum`,
  `cashDelta`, `supplierPaidSum`) — the formulas are written once.
- Display: Georgian format `1 234,50 ₾` (`formatMoney`) / `formatAmount` without the sign.
- Quantities are integers; negative delivered quantity = goods returned on an operation.
- Inputs: `inputMode="decimal"` text fields; server validates with `amount()` / `wholeNumber()` from
  `@/lib/validation`.

## Dates

- Business date = Tbilisi date: `todayIso()`; stored as `date`; shown `dd.mm.yyyy` (`formatDate`).
- Timestamps (`created_at`) are `timestamptz`; shown with `formatDateTime` in Tbilisi time.

## Testing

- `npm test` (Vitest): pure rules (`features/sales/logic.test.ts`, incl. editing saved documents),
  money/URL parsing (`src/lib/*.test.ts`) and the PHP-compatible legacy parser (`scripts/legacy/php.test.ts`).
- Money & stock flows against a real database (`features/sales/flows.integration.test.ts`, everything
  rolled back) run only with a **disposable** database in `TEST_DATABASE_URL` — never the production
  URL from `.env.local`. With Homebrew Postgres:

  ```bash
  createdb alcodraft_test && DATABASE_URL_SESSION=postgresql://$USER@localhost/alcodraft_test npm run db:migrate
  TEST_DATABASE_URL=postgresql://$USER@localhost/alcodraft_test npm test
  ```
- The legacy import has its own end-to-end verification (`npm run legacy:verify`).
- Manual check list before a release: create an operation, edit it, complete an order, receive stock,
  pay a supplier, pay a wage — then compare customer debt / stock / cash balance.

## Security checklist

- Every action authorizes on the server; never trust ids from the client without `store_id` checks
  (services always filter by `actor.storeId`).
- Super-admin-only for destructive and access-control operations.
- No secrets in the repo; `.env*` is git-ignored except `.env.example`.
