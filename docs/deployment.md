# Deployment (Vercel + Supabase)

## Pieces

| Piece | Where | Notes |
|---|---|---|
| App | Vercel project, functions region **fra1** (`vercel.json`) | Next.js 16, Node ≥ 20.9 |
| Database | Supabase project "Alcodraft", **eu-central-1** (Frankfurt), Postgres 17 | same region as the functions |
| Backups | none (owner's decision) — one-off `pg_dump` before risky changes, see below | the Supabase free plan has no restorable backups |

## Environment variables

| Name | Value | Used by |
|---|---|---|
| `DATABASE_URL` | Supabase → Connect → **Transaction pooler** URI (port 6543) with the DB password | app (Vercel + `npm run dev`) |
| `DATABASE_URL_SESSION` | Supabase → Connect → **Session pooler** URI (port 5432) | `db:migrate`, `legacy:*` scripts |
| `LEGACY_DATABASE_URL` | `mysql://root@127.0.0.1:3306/alcodraft_legacy` | import script only (local) |
| `TEST_DATABASE_URL` | a disposable Postgres (local or a Supabase branch) — **never production** | integration tests only (optional) |

Locally they live in `.env.local` (git-ignored; template: `.env.example`). On Vercel set
`DATABASE_URL` (Production + Preview). The `NEXT_PUBLIC_SUPABASE_*` values are not used.

## First deployment

1. Push this folder to a **private** GitHub repository.
2. Vercel → Add New → Project → import the repo. Framework preset: Next.js. Add `DATABASE_URL`.
3. Locally: `npm run db:migrate` (creates the schema in Supabase).
4. Import the data (see [legacy-migration.md](legacy-migration.md)) with `--reset`.
5. Vercel → Settings → Domains → add the domain (e.g. `alcodraft.ge`) and update DNS as shown.
6. Supabase hardening (Dashboard): Settings → API → disable the Data API (the app doesn't use it);
   Database → enable "Enforce SSL"; keep "Network restrictions" open (Vercel IPs are dynamic).

## Day-to-day

- `git push` → Vercel builds and deploys (preview deployments for branches).
- Schema change: edit `src/server/db/schema`, `npm run db:generate`, review the SQL, **run
  `npm run db:migrate` against production before deploying code that needs it**. (Migration
  `0003_request_keys_and_login_index` — table `request_keys` + an `audit_log` index — must be applied
  before deploying the version that introduced it: every create and the login use them.)
- Logs: Vercel → Project → Logs. Slow queries: Supabase → Reports / Query performance.

## Backups

Not enabled — the owner decided on 2026-10-07 that automatic backups are not needed. The Supabase
free plan keeps no restorable backups, so before anything risky (a re-import, a bulk fix) take a
one-off copy:

```bash
pg_dump --schema=app --schema=drizzle --no-owner --no-privileges --format=custom \
  "postgresql://…session pooler URI with percent-encoded password…" > alcodraft-backup.dump
```

An encrypted nightly GitHub Actions job existed and can be restored if this changes:
`git show a2ef0a4:.github/workflows/backup.yml` (needs secrets `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE`;
the repository is public, so never upload an unencrypted dump).

Free Supabase projects pause after 7 days without any activity; if that ever happens, resume the
project from the Supabase dashboard (data is kept).

## Costs (as checked Oct 2026)

Vercel Hobby (free) and Supabase Free. Supabase free limits: 500 MB database (this data is ~25 MB),
5 GB egress. If Vercel classifies the usage as commercial, Pro ($20/month) is a billing change only.
