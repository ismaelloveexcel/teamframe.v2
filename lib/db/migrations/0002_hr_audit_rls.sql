-- hr_audit_log: append-only, tenant-scoped audit (build-spec §4). Raw SQL because
-- drizzle-kit push needs a TTY for an unrelated pending prompt; this is idempotent.
CREATE TABLE IF NOT EXISTS hr_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id   uuid NOT NULL,
  action      text NOT NULL,
  before      jsonb,
  after       jsonb,
  actor_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  timestamp   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hr_audit_company ON hr_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_audit_entity ON hr_audit_log(entity_type, entity_id);

ALTER TABLE hr_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON hr_audit_log;
CREATE POLICY tenant_isolation ON hr_audit_log
  USING (company_id = current_setting('app.company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.company_id', true)::uuid);
GRANT SELECT, INSERT ON hr_audit_log TO app_user, app_privileged;
