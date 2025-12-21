-- Create auth-related tables (used by Next.js API routes)
CREATE TABLE IF NOT EXISTS public.pending_signups (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  pin TEXT NOT NULL,
  initial_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  terms_accepted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_verification_codes (
  email TEXT PRIMARY KEY,
  account_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_email_verification_expires_at ON public.email_verification_codes(expires_at);

-- Ensure unique emails on accounts when present
DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_key ON public.accounts(email) WHERE email IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Ensure password_reset_codes supports ON CONFLICT (email)
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.password_reset_codes ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE public.password_reset_codes ADD COLUMN IF NOT EXISTS code VARCHAR(10);
ALTER TABLE public.password_reset_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.password_reset_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

WITH ranked AS (
  SELECT ctid, email, ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at DESC NULLS LAST) AS rn
  FROM public.password_reset_codes
)
DELETE FROM public.password_reset_codes p
USING ranked r
WHERE p.ctid = r.ctid AND r.rn > 1 AND r.email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS password_reset_codes_email_key ON public.password_reset_codes(email);

-- Drop unused legacy tables (not referenced by this codebase)
DROP TABLE IF EXISTS public.budget_goals CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.scheduled_transactions CASCADE;
