-- PostgreSQL schema for the bank system
-- Run against your database (e.g., bank_db)

CREATE TABLE IF NOT EXISTS accounts (
  account_number VARCHAR(10) PRIMARY KEY,
  name           VARCHAR(100)    NOT NULL,
  email          VARCHAR(255),
  balance        NUMERIC(12,2)   NOT NULL DEFAULT 0,
  pin            VARCHAR(5)      NOT NULL,
  status         VARCHAR(10)     NOT NULL,
  failed_attempts INTEGER        NOT NULL DEFAULT 0,
  password       VARCHAR(255),
  terms_accepted BOOLEAN         NOT NULL DEFAULT FALSE,
  CONSTRAINT status_check CHECK (status IN ('Active','Locked','Archived')),
  CONSTRAINT pin_format_check CHECK (pin ~ '^[0-9]{4,5}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_key ON accounts(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  account_number VARCHAR(10) NOT NULL REFERENCES accounts(account_number) ON DELETE CASCADE,
  target_account VARCHAR(10) REFERENCES accounts(account_number) ON DELETE RESTRICT,
  type VARCHAR(10) NOT NULL,         -- 'deposit','withdraw','transfer'
  status VARCHAR(10) NOT NULL DEFAULT 'Completed', -- 'Pending','Completed','Voided'
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  voided_at TIMESTAMPTZ,
  source_balance_before NUMERIC(12,2),
  source_balance_after  NUMERIC(12,2),
  target_balance_before NUMERIC(12,2),
  target_balance_after  NUMERIC(12,2),
  CONSTRAINT type_check CHECK (type IN ('deposit','withdraw','transfer','fee')),
  CONSTRAINT status_tx_check CHECK (status IN ('Pending','Completed','Voided'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(account_number);
CREATE INDEX IF NOT EXISTS idx_transactions_target ON transactions(target_account);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

CREATE TABLE IF NOT EXISTS transaction_audit (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  action VARCHAR(12) NOT NULL, -- 'create','update','complete','void','rollback'
  performed_by VARCHAR(10) NOT NULL,
  reason TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT action_check CHECK (action IN ('create','update','complete','void','rollback'))
);

CREATE TABLE IF NOT EXISTS pending_signups (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  pin TEXT NOT NULL,
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  terms_accepted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verification_codes (
  email TEXT PRIMARY KEY,
  account_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON email_verification_codes(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_codes_email_key ON password_reset_codes(email);
