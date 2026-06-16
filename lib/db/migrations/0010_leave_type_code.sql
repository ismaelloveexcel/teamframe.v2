-- Phase 1 (Jurisdiction Packs) — Step 2: hr_leave_type enum -> leave_type_code.
--
-- Removes the UAE-specific statutory enum from the GLOBAL CORE. The leave type
-- becomes a free TEXT `leave_type_code`; allowed values are enforced at the
-- application layer against the jurisdiction's leave_types catalogue (provider
-- + company overrides), not by a hard-coded DB enum.
--
-- PRESERVATION: existing enum values ('annual','sick',...) ARE already the
-- codes, so the backfill is a straight ::text copy. No leave row, balance row,
-- or balance value changes.
--
-- Idempotent / safe to re-run: guarded on column existence.

-- hr_leave: add text column, backfill from enum, swap in place.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hr_leave' AND column_name = 'type'
  ) THEN
    ALTER TABLE hr_leave ADD COLUMN IF NOT EXISTS leave_type_code text;
    UPDATE hr_leave SET leave_type_code = type::text WHERE leave_type_code IS NULL;
    ALTER TABLE hr_leave ALTER COLUMN leave_type_code SET NOT NULL;
    ALTER TABLE hr_leave DROP COLUMN type;
  END IF;
END $$;

-- hr_leave_balance: same swap; rebuild the (employee_id, type) unique on code.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hr_leave_balance' AND column_name = 'type'
  ) THEN
    ALTER TABLE hr_leave_balance ADD COLUMN IF NOT EXISTS leave_type_code text;
    UPDATE hr_leave_balance SET leave_type_code = type::text WHERE leave_type_code IS NULL;
    ALTER TABLE hr_leave_balance ALTER COLUMN leave_type_code SET NOT NULL;
    ALTER TABLE hr_leave_balance DROP CONSTRAINT IF EXISTS hr_leave_balance_employee_type_unique;
    ALTER TABLE hr_leave_balance DROP COLUMN type;
    ALTER TABLE hr_leave_balance
      ADD CONSTRAINT hr_leave_balance_employee_type_unique UNIQUE (employee_id, leave_type_code);
  END IF;
END $$;

-- Drop the now-unused enum type (only after both columns no longer use it).
DROP TYPE IF EXISTS hr_leave_type;
