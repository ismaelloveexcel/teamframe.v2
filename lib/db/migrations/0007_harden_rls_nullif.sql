-- 0007: harden every tenant-isolation policy against an empty/unset GUC.
--
-- The original policies cast current_setting('app.company_id', true)::uuid
-- directly. When the GUC is unset on a fresh session that returns NULL (safe),
-- but on a pooled connection that was RESET it returns '' (empty string), and
-- ''::uuid raises invalid-input rather than failing closed. Wrapping with
-- NULLIF(..., '') normalizes '' -> NULL so the predicate yields 0 rows. Also
-- pins an explicit WITH CHECK so writes are constrained identically to reads.
--
-- Idempotent: recreates each existing app.company_id policy in place.

DO $$
DECLARE
  pol RECORD;
  key_col TEXT;
  new_qual TEXT;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE qual LIKE '%app.company_id%'
  LOOP
    -- pick the tenant key column for this table
    IF pol.tablename = 'companies' THEN
      key_col := 'id';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = pol.schemaname AND table_name = pol.tablename
        AND column_name = 'organization_id'
    ) THEN
      key_col := 'organization_id';
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = pol.schemaname AND table_name = pol.tablename
        AND column_name = 'company_id'
    ) THEN
      key_col := 'company_id';
    ELSE
      RAISE EXCEPTION 'no tenant key column found for %.%', pol.schemaname, pol.tablename;
    END IF;

    new_qual := format(
      '%I = NULLIF(current_setting(''app.company_id'', true), '''')::uuid',
      key_col
    );

    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I USING (%s) WITH CHECK (%s)',
      pol.policyname, pol.schemaname, pol.tablename, new_qual, new_qual
    );
  END LOOP;
END $$;
