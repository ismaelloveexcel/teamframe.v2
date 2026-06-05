-- Phase 1 guardrails: enforce append-only org_events storage at DB level.
-- Apply manually in environments where migrations are executed with SQL tooling.

CREATE OR REPLACE FUNCTION prevent_org_events_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'org_events is append-only; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS org_events_block_update ON org_events;
CREATE TRIGGER org_events_block_update
BEFORE UPDATE ON org_events
FOR EACH ROW EXECUTE FUNCTION prevent_org_events_mutation();

DROP TRIGGER IF EXISTS org_events_block_delete ON org_events;
CREATE TRIGGER org_events_block_delete
BEFORE DELETE ON org_events
FOR EACH ROW EXECUTE FUNCTION prevent_org_events_mutation();

