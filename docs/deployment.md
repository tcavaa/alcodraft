# Deployment (Vercel + Supabase)

## Pieces

| Piece | Where | Notes |
|---|---|---|
| App | Vercel project, functions region **fra1** (`vercel.json`) | Next.js 16, Node ≥ 20.9 |
| Database | Supabase project "Alcodraft", **eu-central-1** (Frankfurt), Postgres 17 | same region as the functions |
| Backups | GitHub Actions nightly `pg_dump`, gpg-encrypted (`.github/workflows/backup.yml`) | the Supabase free plan has no backups |

## Environment variables

| Name | Value | Used by |
|---|---|---|
| `DATABASE_URL` | Supabase → Connect → **Transaction pooler** URI (port 6543) with the DB password | app (Vercel + `npm run dev`) |
| `DATABASE_URL_SESSION` | Supabase → Connect → **Session pooler** URI (port 5432) | `db:migrate`, `legacy:*` scripts, backups |
| `LEGACY_DATABASE_URL` | `mysql://root@127.0.0.1:3306/alcodraft_legacy` | import script only (local) |

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
  `npm run db:migrate` against production before deploying code that needs it**.
- Logs: Vercel → Project → Logs. Slow queries: Supabase → Reports / Query performance.

## Backups

`.github/workflows/backup.yml` runs nightly at 03:30 Tbilisi time (and on demand from the Actions
tab): `pg_dump` of schemas `app` and `drizzle` through the session pooler, **encrypted with gpg
(AES-256)** and kept 30 days as a workflow artifact. The repository is public and artifacts of public
repositories can be downloaded by anyone, so an unencrypted dump must never be uploaded.

Setup: GitHub repo → Settings → Secrets and variables → Actions → two repository secrets:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | the **Session pooler** URI (raw password is fine — the workflow splits it itself) |
| `BACKUP_PASSPHRASE` | a long random passphrase; store a copy in your password manager — without it a backup cannot be opened |

Until both exist the job is skipped with a notice (no failure e-mails). Test it once with
Actions → Database backup → Run workflow.

Restore (download the artifact zip from the run, unzip it, then):

```bash
gpg --decrypt alcodraft-YYYY-MM-DD.dump.gpg > alcodraft.dump
```

```bash
pg_restore --no-owner --no-privileges --dbname "postgresql://…session pooler URI…" alcodraft.dump
```

(`pg_restore` needs a percent-encoded password in a URI; alternatively set `PGHOST`, `PGPORT`,
`PGUSER`, `PGPASSWORD`, `PGDATABASE` and pass only `alcodraft.dump`.)

The daily dump also keeps the free Supabase project active (free projects pause after 7 days without
activity; if it ever pauses, resume it from the Supabase dashboard).

## Costs (as checked Oct 2026)

Vercel Hobby (free) and Supabase Free. Supabase free limits: 500 MB database (this data is ~25 MB),
5 GB egress. If Vercel classifies the usage as commercial, Pro ($20/month) is a billing change only.
