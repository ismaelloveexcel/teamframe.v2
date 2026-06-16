#!/usr/bin/env bash
# Reproducible proof of tenant RLS isolation (build-runbook Prompt 1, gate a/b).
# Usage: ORGA=<uuid> ORGB=<uuid> ./rls-gate-check.sh   (PG on :5433 socket /tmp)
set -euo pipefail
H="host=/tmp"; P=5433
AUSER="postgresql://app_user:app_user_pw@localhost:$P/teamframe?$H"
APRIV="postgresql://app_privileged:app_privileged_pw@localhost:$P/teamframe?$H"
: "${ORGA:?set ORGA}"; : "${ORGB:?set ORGB}"
echo "GATE a — app_user (non-superuser), context=OrgA, no app WHERE:"
psql "$AUSER" -At <<SQL
BEGIN; SET LOCAL app.company_id = '$ORGA';
SELECT '  positions visible (OrgA only): ' || count(*) FROM positions;
SELECT '  OrgB rows even if asked: ' || count(*) FROM positions WHERE organization_id='$ORGB';
COMMIT;
SQL
echo "  no-context (fail-closed): $(psql "$AUSER" -At -c 'SELECT count(*) FROM positions')"
echo "GATE b — app_privileged identity lookup (distinct orgs): $(psql "$APRIV" -At -c 'SELECT count(DISTINCT organization_id) FROM organization_memberships')"
