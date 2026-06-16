-- Tenant isolation via Postgres Row-Level Security (RLS).
-- Build spec §9: defense-in-depth so a missing app-layer `WHERE company_id`
-- cannot leak one client's data to another. company_id == organization_id.
--
-- Two roles:
--   app_user       : NON-superuser, NO bypassrls. The app runtime connects as
--                    this for all tenant-scoped queries. RLS is enforced.
--   app_privileged : BYPASSRLS. Used ONLY for identity resolution
--                    (user -> membership -> company) before a tenant context
--                    exists, and for super_admin operations.
--
-- Request contract: the app sets `SET LOCAL app.company_id = '<session company>'`
-- at the start of each request transaction. Policies read that GUC.

-- ── roles ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'app_user_pw' NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_privileged') THEN
    CREATE ROLE app_privileged LOGIN PASSWORD 'app_privileged_pw' BYPASSRLS;
  END IF;
END$$;

GRANT USAGE ON SCHEMA public TO app_user, app_privileged;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user, app_privileged;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user, app_privileged;

-- ── enable RLS + FORCE + tenant policy on every tenant-scoped table ──────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'organization_id' AND table_schema = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (organization_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (organization_id = current_setting(''app.company_id'', true)::uuid);',
      t
    );
  END LOOP;
END$$;
