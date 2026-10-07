# AlcoDraft

Back office for AlcoDraft (wine & spirits distribution): operations („დღის ჩახურვა“), orders,
customers and their debts, products and stock, suppliers, cash books and wages — for every store.

- `/` — public one-page site
- `/admin` — staff panel (login required)

## Quick start

```bash
cp .env.example .env.local      # fill the two Supabase connection strings
npm install
npm run db:migrate              # create the schema
npm run dev                     # http://localhost:3000
```

Importing the old MySQL data: see [docs/legacy-migration.md](docs/legacy-migration.md).
Everything else: start at [CLAUDE.md](CLAUDE.md), which links to the detailed docs.
