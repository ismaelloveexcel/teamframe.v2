-- Phase 1 (Jurisdiction Packs) — Step 1: leave_types table.
--
-- Jurisdiction-driven leave-type catalogue. Two row kinds share one table:
--   * GLOBAL DEFAULTS — company_id IS NULL, jurisdiction set ('UAE'/'GENERIC').
--     These ship with the product and are readable by every tenant.
--   * COMPANY OVERRIDES — company_id set, RLS-scoped to that tenant.
--
-- The SELECT policy therefore allows company_id IS NULL (global defaults) OR
-- company_id = current tenant. Writes are constrained to the current tenant so
-- a tenant can never insert/modify a global default or another tenant's row.

CREATE TABLE IF NOT EXISTS leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  jurisdiction text,
  code text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lookup paths: by jurisdiction default, and by company override.
CREATE INDEX IF NOT EXISTS leave_types_jurisdiction_idx ON leave_types (jurisdiction) WHERE company_id IS NULL;
CREATE INDEX IF NOT EXISTS leave_types_company_idx ON leave_types (company_id) WHERE company_id IS NOT NULL;

-- RLS: global defaults (company_id NULL) are visible to all; tenant overrides
-- are isolated. Writes only ever touch the current tenant's own rows.
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON leave_types;
CREATE POLICY tenant_isolation ON leave_types
  USING (company_id IS NULL OR company_id = NULLIF(current_setting('app.company_id', true), '')::uuid)
  WITH CHECK (company_id = NULLIF(current_setting('app.company_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON leave_types TO app_user, app_privileged;

-- Seed jurisdiction defaults (company_id NULL). Idempotent: a partial unique
-- index keys global defaults on (jurisdiction, code) so re-runs no-op.
CREATE UNIQUE INDEX IF NOT EXISTS leave_types_global_jurisdiction_code_unique
  ON leave_types (jurisdiction, code) WHERE company_id IS NULL;

INSERT INTO leave_types (company_id, jurisdiction, code, name) VALUES
  (NULL, 'GENERIC', 'annual', 'Annual Leave'),
  (NULL, 'GENERIC', 'sick',   'Sick Leave'),
  (NULL, 'GENERIC', 'unpaid', 'Unpaid Leave'),
  (NULL, 'UAE', 'annual',      'Annual Leave'),
  (NULL, 'UAE', 'sick',        'Sick Leave'),
  (NULL, 'UAE', 'maternity',   'Maternity Leave'),
  (NULL, 'UAE', 'paternity',   'Paternity Leave'),
  (NULL, 'UAE', 'hajj',        'Hajj Leave'),
  (NULL, 'UAE', 'bereavement', 'Bereavement Leave'),
  (NULL, 'UAE', 'unpaid',      'Unpaid Leave')
ON CONFLICT DO NOTHING;
