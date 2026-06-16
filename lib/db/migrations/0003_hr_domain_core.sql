-- HR domain core tables (company-scoped, active). Raw SQL (drizzle push TTY-blocked).
CREATE TABLE IF NOT EXISTS hr_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL, department text, function text,
  line_manager_id uuid REFERENCES hr_positions(id) ON DELETE SET NULL,
  grade text, location text, employment_type text, work_schedule text,
  budgeted boolean NOT NULL DEFAULT true, job_description text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS hr_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_no text NOT NULL, first_name text NOT NULL, last_name text NOT NULL,
  date_of_birth date, gender text, nationality text, personal_email text,
  company_email text, mobile_number text, address text, emergency_contacts jsonb,
  join_date date, date_of_exit date, status text NOT NULL DEFAULT 'Draft',
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS hr_position_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES hr_positions(id) ON DELETE CASCADE,
  start_date date NOT NULL, end_date date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
DO $$ DECLARE t text;
BEGIN FOR t IN SELECT unnest(ARRAY['hr_positions','hr_employees','hr_position_assignments']) LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (company_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (company_id = current_setting(''app.company_id'', true)::uuid);', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user, app_privileged;', t);
END LOOP; END $$;
