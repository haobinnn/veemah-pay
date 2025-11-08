-- PostgreSQL schema for the bank system
-- Run against your database (e.g., bank_db)

CREATE TABLE IF NOT EXISTS accounts (
  account_number VARCHAR(5) PRIMARY KEY,
  name           VARCHAR(100)    NOT NULL,
  balance        NUMERIC(12,2)   NOT NULL DEFAULT 0,
  pin            VARCHAR(4)      NOT NULL,
  status         VARCHAR(6)      NOT NULL,
  failed_attempts INTEGER        NOT NULL DEFAULT 0,
  CONSTRAINT status_check CHECK (status IN ('Active','Locked')),
  CONSTRAINT pin_format_check CHECK (pin ~ '^[0-9]{4}$')
);

-- Optional: record transactions for auditing
CREATE TABLE IF NOT EXISTS transactions (
  id              BIGSERIAL PRIMARY KEY,
  account_number  VARCHAR(5) NOT NULL REFERENCES accounts(account_number) ON DELETE CASCADE,
  type            VARCHAR(20) NOT NULL,         -- e.g., 'Deposit','Withdrawal','Transfer','Fee'
  amount          NUMERIC(12,2) NOT NULL,
  fee             NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  note            TEXT
);