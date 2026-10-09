-- The job queue library (pg-boss) creates and migrates its own `pgboss` schema at API start.
-- The API connects as the restricted role `app_rw` in production, so that role must be allowed
-- to do this. It is limited to its own schema; the append-only `events` guarantee (0002) is unchanged.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_rw') THEN
    EXECUTE format('GRANT CREATE ON DATABASE %I TO app_rw', current_database());
    CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION app_rw;
  END IF;
END $$;
