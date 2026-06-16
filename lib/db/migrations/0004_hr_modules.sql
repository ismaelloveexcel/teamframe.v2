-- Prompt 6: CRUD modules (Compensation, Leave, Policy, Document/Template, Offboarding).
-- Company-scoped, RLS-isolated. Raw SQL (drizzle push TTY-blocked).

-- Leave type enum (UAE statutory set + unpaid)
DO $$ BEGIN
  CREATE TYPE hr_leave_type AS ENUM ('annual','sick','maternity','paternity','hajj','bereavement','unpaid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1. Compensation
CREATE TABLE IF NOT EXISTS hr_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL,
  components jsonb,
  effective_date date,
  bank_name text, iban text, swift_code text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 2. Leave + LeaveBalance
CREATE TABLE IF NOT EXISTS hr_leave (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  type hr_leave_type NOT NULL,
  start_date date NOT NULL, end_date date NOT NULL, days integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS hr_leave_balance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  type hr_leave_type NOT NULL,
  balance_days integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT hr_leave_balance_employee_type_unique UNIQUE (employee_id, type)
);

-- 3. Policy + acknowledgement
CREATE TABLE IF NOT EXISTS hr_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL, body text NOT NULL, version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS hr_policy_acknowledgement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES hr_policy(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  version integer NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT hr_policy_ack_policy_employee_version_unique UNIQUE (policy_id, employee_id, version)
);

-- 4. Template + Document
CREATE TABLE IF NOT EXISTS hr_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS hr_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES hr_employees(id) ON DELETE CASCADE,
  template_id uuid REFERENCES hr_template(id) ON DELETE SET NULL,
  name text NOT NULL, content text, attachments jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- 5. Offboarding (frozen exit record + EOSG)
CREATE TABLE IF NOT EXISTS hr_offboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  exit_date date NOT NULL, reason text,
  eosg_inputs jsonb, gratuity_amount integer,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- RLS + grants for all new tables
DO $$ DECLARE t text;
BEGIN FOR t IN SELECT unnest(ARRAY[
  'hr_compensation','hr_leave','hr_leave_balance','hr_policy',
  'hr_policy_acknowledgement','hr_template','hr_document','hr_offboarding'
]) LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
  EXECUTE format('CREATE POLICY tenant_isolation ON %I USING (company_id = current_setting(''app.company_id'', true)::uuid) WITH CHECK (company_id = current_setting(''app.company_id'', true)::uuid);', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user, app_privileged;', t);
END LOOP; END $$;
