# Veemah Pay — Team Setup

This repo includes a one-command local PostgreSQL setup and a Next.js app. New teammates can get running in minutes with Docker.

## Quick Start

- Prerequisites:
  - Install Docker Desktop (macOS/Windows/Linux)
  - Install Node.js 18+

- Steps:
  - Copy env: `cp .env.example .env.local`
  - Start DB: `npm run db:up`
  - Install deps: `npm install`
  - Start app: `npm run dev`
  - Open `http://localhost:3000`

## Accounts

- Admin: `0000 / 0000`
- Customers:
  - `12345 / 1111`
  - `23456 / 2222`
  - `34567 / 3333`
  - `45678 / 4444`
  - `56789 / 5555` (Locked)

## Database Details

- Service: `postgres:16` via `docker-compose.yml`
- DB: `bank_db`
- App user: `bank_user` / `bank_pass`
- Env var: `DATABASE_URL=postgresql://bank_user:bank_pass@localhost:5432/bank_db`
- Initialization:
  - `db/init/00_user.sql` creates `bank_user` and sets DB owner
  - `db/init/10_schema.sql` creates tables
  - `db/init/20_seed.sql` seeds accounts
  - `db/init/30_grants.sql` sets privileges
  - Lockout: `accounts.failed_attempts` tracks failed PIN attempts (auto-lock at 3)

## Useful Commands

- `npm run db:up` — start Postgres
- `npm run db:down` — stop Postgres
- `npm run db:reset` — drop volumes and re-init fresh data
- `npm run db:psql` — open `psql` inside the container

## Troubleshooting

- Port 5432 in use: stop other local Postgres services or change `ports` in `docker-compose.yml`.
- Permission denied: run `npm run db:reset` to reapply init scripts or see `db/README.md` for manual grants.
- Could not connect: wait a few seconds after `db:up` (healthcheck waits for readiness).

## Account Locking

- The app locks an account after 3 failed PIN attempts.
- On a successful login, the counter resets to 0.
- Admin can unlock by setting status to `Active` (this also resets the counter).

### Migrating Existing Databases

If your local DB was created before lockout was added, run:

```
npm run db:psql
# Inside psql:
\i /docker-entrypoint-initdb.d/30_grants.sql
\i /workspace/db/migrations/001_add_failed_attempts.sql
```

Or from host:

```
docker compose exec postgres psql -U postgres -d bank_db -f db/migrations/001_add_failed_attempts.sql
```

## Verify Owners & Privileges (pgAdmin/UI or SQL)

Use these steps if you or a teammate sees `permission denied for table accounts` or if you want to confirm the DB is set up correctly.

- pgAdmin UI checks (connect as superuser `postgres`):
  - Database owner: right‑click `bank_db` → Properties → `Owner` should be `bank_user`.
  - Table owners: `bank_db → Schemas → public → Tables → accounts/transactions` → Properties → `Owner` should be `bank_user`.
  - Sequence owner: `bank_db → Schemas → public → Sequences → transactions_id_seq` → Properties → `Owner` should be `bank_user`.
  - Grants: on `public` schema, add `bank_user` with `USAGE`; on tables, grant `SELECT, INSERT, UPDATE, DELETE`; on sequences, grant `USAGE, SELECT, UPDATE`.

- SQL commands (pgAdmin Query Tool or `npm run db:psql`):
  - `GRANT USAGE ON SCHEMA public TO bank_user;`
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bank_user;`
  - `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bank_user;`
  - `ALTER TABLE public.accounts OWNER TO bank_user;`
  - `ALTER TABLE public.transactions OWNER TO bank_user;`
  - `ALTER SEQUENCE public.transactions_id_seq OWNER TO bank_user;`

- Verify with SQL:
  - `SELECT table_name, tableowner FROM information_schema.tables WHERE table_schema='public';`
  - `SELECT grantee, privilege_type FROM information_schema.table_privileges WHERE table_schema='public' AND table_name='accounts';`
  - psql quick checks: `\dp public.accounts`, `\dp public.transactions_id_seq`

## Without Docker

If teammates prefer a local Postgres install, follow `db/README.md` (Homebrew or Postgres.app) and use the same `db/schema.sql`, `db/seed.sql`, and `db/grants.sql` scripts.