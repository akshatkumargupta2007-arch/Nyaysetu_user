-- Bible §9 / Build map #A4: the event ledger must be append-only at the
-- database level, not just by convention in application code.
--
-- Creates (if missing) a restricted role the API connects as in production,
-- with SELECT+INSERT on every table but no UPDATE/DELETE on `events`.
-- Local/dev can keep using the default connection owner; this role is wired
-- up explicitly on Railway (see docs/DEPLOY.md).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw LOGIN PASSWORD 'change-me-in-production';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;

-- The append-only guarantee: revoke UPDATE/DELETE specifically on events.
REVOKE UPDATE, DELETE ON events FROM app_rw;
GRANT SELECT, INSERT ON events TO app_rw;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
