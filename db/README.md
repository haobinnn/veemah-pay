# PostgreSQL Setup (macOS)

This folder contains `schema.sql` and `seed.sql` to move your data from the 2D array to PostgreSQL.

## 1) Install PostgreSQL on macOS

Choose one of the options below:

### Option A — Homebrew (recommended)

```bash
brew update
brew install postgresql@16
# Start the database server
brew services start postgresql@16

# (Optional) Add binaries to PATH on Apple Silicon
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

psql --version
```

### Option B — Postgres.app (very easy)
Download and install: https://postgresapp.com/
Open the app and start the server. Then use the built-in `psql` from the app.

### Option C — Docker
```bash
docker run --name bank-postgres \
  -e POSTGRES_USER=bank_user \
  -e POSTGRES_PASSWORD=bank_pass \
  -e POSTGRES_DB=bank_db \
  -p 5432:5432 -d postgres:16
```

## 2) Create database and user

Open `psql` and run the following:

```sql
-- Connect to the default maintenance DB
\c postgres

-- Create an application user
CREATE ROLE bank_user WITH LOGIN PASSWORD 'bank_pass';

-- Create the database and assign ownership
CREATE DATABASE bank_db OWNER bank_user;

-- Grant privileges (optional, ownership already grants most rights)
GRANT ALL PRIVILEGES ON DATABASE bank_db TO bank_user;
```

## 3) Apply schema and seed data

```bash
# From the repository root
psql -U bank_user -d bank_db -f db/schema.sql
psql -U bank_user -d bank_db -f db/seed.sql

# Verify rows
psql -U bank_user -d bank_db -c "SELECT * FROM accounts;"
```

## 4) Connection string (for apps)

Use this connection string in your backend:

```
DATABASE_URL=postgresql://bank_user:bank_pass@localhost:5432/bank_db
```

### JDBC (Java) example

```java
String url = "jdbc:postgresql://localhost:5432/bank_db";
String user = "bank_user";
String pass = "bank_pass";
Connection conn = DriverManager.getConnection(url, user, pass);
```

## 5) Notes & Best Practices

- Store PINs hashed (never plaintext) in production. For learning, plaintext is okay, but switch to hashing later.
- The `accounts` table enforces:
  - `status` must be `Active` or `Locked`.
  - `pin` must be exactly 4 digits.
- A `transactions` table is included for future auditing.
- Lockout: accounts include `failed_attempts` and are auto‑locked after 3 failed PIN attempts.

## 6) Common troubleshooting

- If `psql: could not connect to server`, ensure Postgres is running:
  - Homebrew: `brew services start postgresql@16`
  - Postgres.app: open the app and start the server
  - Docker: `docker ps` and verify `bank-postgres` is `Up`
- If port 5432 is in use, stop other Postgres services or change the port.

### Permission denied for table `accounts`

This means the app user (`bank_user`) doesn’t own or have privileges on the tables.

Fix it via pgAdmin (UI):
- Open `bank_db` → Schemas → `public` → Tables → right‑click `accounts` → Properties:
  - Owner: set to `bank_user` (or keep the owner and grant privileges below).
- Repeat for `transactions`.
- For sequences (e.g., `transactions_id_seq`), set Owner to `bank_user`.

Or run the provided script as a superuser (e.g., `postgres`):

```sql
\c bank_db
-- Execute from pgAdmin Query Tool or psql
-- File: db/grants.sql
```

Manual commands (if you prefer inline):

```sql
GRANT USAGE ON SCHEMA public TO bank_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bank_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bank_user;
ALTER TABLE public.accounts OWNER TO bank_user;
ALTER TABLE public.transactions OWNER TO bank_user;
ALTER SEQUENCE public.transactions_id_seq OWNER TO bank_user;
```

After changing permissions, reload the app and retry login.

### Add lockout column to existing DB

If your DB was initialized before `failed_attempts` existed, run this migration:

```bash
psql -U postgres -d bank_db -f db/migrations/001_add_failed_attempts.sql
```

Or from Docker:

```bash
docker compose exec postgres psql -U postgres -d bank_db -f db/migrations/001_add_failed_attempts.sql
```