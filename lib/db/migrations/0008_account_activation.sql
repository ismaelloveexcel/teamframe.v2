-- 0008: account activation tokens (employee credential activation flow).
--
-- account_activation_tokens belongs to the GLOBAL identity layer (like users and
-- sessions): it is NOT tenant-scoped and has NO RLS. We still GRANT the needed
-- DML to app_user + app_privileged so the runtime (which connects as app_user in
-- production) can read/write it.
--
-- Single-use, hashed tokens: we store ONLY a sha256 hash of the plaintext token
-- (the plaintext is returned once at invite/issue time and never persisted).

CREATE TABLE IF NOT EXISTS account_activation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_activation_tokens_token_hash_idx
  ON account_activation_tokens (token_hash);
CREATE INDEX IF NOT EXISTS account_activation_tokens_user_id_idx
  ON account_activation_tokens (user_id);

-- Global identity table: no RLS, but the runtime role still needs DML on it.
GRANT SELECT, INSERT, UPDATE, DELETE ON account_activation_tokens TO app_user, app_privileged;

-- Activation runs BEFORE any tenant context exists (like login). We route the
-- lookup through a SECURITY DEFINER function for symmetry with the rest of the
-- identity layer (get_user_by_email, get_session_with_membership) and so the
-- privilege surface stays explicit.
CREATE OR REPLACE FUNCTION get_activation_by_token_hash(p_token_hash TEXT)
RETURNS TABLE(
  token_id uuid,
  user_id uuid,
  expires_at timestamptz,
  consumed_at timestamptz,
  user_status text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT t.id, t.user_id, t.expires_at, t.consumed_at, u.status::text
  FROM account_activation_tokens t
  JOIN users u ON u.id = t.user_id
  WHERE t.token_hash = p_token_hash;
$$;

GRANT EXECUTE ON FUNCTION get_activation_by_token_hash TO app_user;
GRANT EXECUTE ON FUNCTION get_activation_by_token_hash TO app_privileged;
