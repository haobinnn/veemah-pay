-- Fix permissions for bank_user
-- Run as a superuser (e.g., postgres) or the owner of the objects

-- Ensure bank_user can use the public schema
GRANT USAGE ON SCHEMA public TO bank_user;

-- Give bank_user full table privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bank_user;

-- Give bank_user access to sequences (needed for BIGSERIAL)
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bank_user;

-- Optionally transfer ownership of tables to bank_user
ALTER TABLE IF EXISTS public.accounts OWNER TO bank_user;
ALTER TABLE IF EXISTS public.transactions OWNER TO bank_user;
ALTER TABLE IF EXISTS public.transaction_audit OWNER TO bank_user;
ALTER TABLE IF EXISTS public.pending_signups OWNER TO bank_user;
ALTER TABLE IF EXISTS public.email_verification_codes OWNER TO bank_user;
ALTER TABLE IF EXISTS public.password_reset_codes OWNER TO bank_user;
ALTER SEQUENCE IF EXISTS public.transactions_id_seq OWNER TO bank_user;
ALTER SEQUENCE IF EXISTS public.password_reset_codes_id_seq OWNER TO bank_user;

-- Set default privileges so future tables/sequences are accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bank_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO bank_user;
