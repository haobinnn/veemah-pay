-- Grants copied from db/grants.sql to ensure app user has access

GRANT USAGE ON SCHEMA public TO bank_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bank_user;

GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO bank_user;

ALTER TABLE IF EXISTS public.accounts OWNER TO bank_user;
ALTER TABLE IF EXISTS public.transactions OWNER TO bank_user;
ALTER TABLE IF EXISTS public.transaction_audit OWNER TO bank_user;
ALTER TABLE IF EXISTS public.pending_signups OWNER TO bank_user;
ALTER TABLE IF EXISTS public.email_verification_codes OWNER TO bank_user;
ALTER TABLE IF EXISTS public.password_reset_codes OWNER TO bank_user;
ALTER SEQUENCE IF EXISTS public.transactions_id_seq OWNER TO bank_user;
ALTER SEQUENCE IF EXISTS public.password_reset_codes_id_seq OWNER TO bank_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bank_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO bank_user;
