-- 0006: default-company resolver for the login path.
--
-- Under app_user (NOBYPASSRLS), a direct `SELECT ... FROM memberships` during
-- login returns nothing because no tenant context (app.company_id) exists yet —
-- the same chicken-and-egg the session resolver already solves. This SECURITY
-- DEFINER function (owned by a BYPASSRLS role) resolves a user's default company
-- membership before any tenant context is established.

CREATE OR REPLACE FUNCTION get_user_default_company(p_user_id UUID)
RETURNS TABLE(company_id UUID, role TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.company_id, m.role::text
  FROM memberships m
  WHERE m.user_id = p_user_id
  ORDER BY m.id ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_user_default_company TO app_user;
GRANT EXECUTE ON FUNCTION get_user_default_company TO app_privileged;
