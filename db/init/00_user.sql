-- Create the application role and assign DB ownership
-- This runs automatically on first container start via docker-entrypoint-initdb.d

DO $$
BEGIN
   IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bank_user') THEN
      CREATE ROLE bank_user LOGIN PASSWORD 'bank_pass';
   END IF;
END$$;

-- Ensure the database exists (created by POSTGRES_DB) and assign ownership to bank_user
ALTER DATABASE bank_db OWNER TO bank_user;