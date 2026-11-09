-- Custom SQL migration file, put your code below! --
-- [OPS-03][FEAT-13 decision] Two-role model (no RLS policies in
-- bedest-lite): `bedest_app` is a NOLOGIN group role without
-- SUPERUSER/BYPASSRLS; the runtime login (DATABASE_USER) is created by
-- src/scripts/database/ProvisionRoles.ts as its member. Migrations run as
-- the schema owner (DATABASE_MIGRATION_USER). If the owner lacks
-- CREATEROLE, run ProvisionRoles first so the role already exists.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bedest_app') THEN
    CREATE ROLE bedest_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO bedest_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO bedest_app;
--> statement-breakpoint
-- Audit rows are append-only for the application.
REVOKE UPDATE, DELETE, TRUNCATE ON system_audit_logs FROM bedest_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bedest_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bedest_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO bedest_app;
