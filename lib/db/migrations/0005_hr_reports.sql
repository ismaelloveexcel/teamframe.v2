-- Prompt 7: Reports (Finance/payroll + Exit). FROZEN report output persisted
-- as hr_report rows. content jsonb captured at generation time; editing a
-- source record afterwards does NOT change the already-generated document.
-- Company-scoped, RLS-isolated. Raw SQL (drizzle push TTY-blocked).

-- Report kind enum (finance | exit)
DO $$ BEGIN
  CREATE TYPE hr_report_kind AS ENUM ('finance','exit');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS hr_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind hr_report_kind NOT NULL,
  subject_id uuid REFERENCES hr_employees(id) ON DELETE SET NULL,
  period_cutoff date,
  content jsonb NOT NULL,
  generated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS + grants
ALTER TABLE hr_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_report FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON hr_report;
CREATE POLICY tenant_isolation ON hr_report
  USING (company_id = current_setting('app.company_id', true)::uuid)
  WITH CHECK (company_id = current_setting('app.company_id', true)::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON hr_report TO app_user, app_privileged;
