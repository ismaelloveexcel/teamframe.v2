-- Enable RLS on tenant-scoped tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

-- RLS policies — missing_ok=true so unset context returns null (no match = denied)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'company_isolation'
  ) THEN
    EXECUTE 'CREATE POLICY company_isolation ON companies USING (id = current_setting(''app.company_id'', true)::uuid)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'memberships' AND policyname = 'membership_isolation'
  ) THEN
    EXECUTE 'CREATE POLICY membership_isolation ON memberships USING (company_id = current_setting(''app.company_id'', true)::uuid)';
  END IF;
END $$;

-- Create roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_privileged') THEN
    CREATE ROLE app_privileged NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- Grant privileges
GRANT CONNECT ON DATABASE teamframe TO app_user, app_privileged;
GRANT USAGE ON SCHEMA public TO app_user, app_privileged;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user, app_privileged;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user, app_privileged;

-- SECURITY DEFINER function for identity resolution (login path — bypasses RLS)
CREATE OR REPLACE FUNCTION get_user_by_email(p_email TEXT)
RETURNS TABLE(id uuid, email text, password_hash text, status text)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT u.id, u.email, u.password_hash, u.status::text
  FROM users u
  WHERE u.email = p_email;
$$;

GRANT EXECUTE ON FUNCTION get_user_by_email TO app_user;

CREATE OR REPLACE FUNCTION get_session_with_membership(p_token TEXT)
RETURNS TABLE(
  user_id uuid, company_id uuid, role text, user_email text, user_status text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT s.user_id, s.company_id, m.role::text, u.email, u.status::text
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  LEFT JOIN memberships m ON m.user_id = s.user_id AND m.company_id = s.company_id
  WHERE s.token = p_token AND s.expires_at > NOW();
$$;

GRANT EXECUTE ON FUNCTION get_session_with_membership TO app_user;
