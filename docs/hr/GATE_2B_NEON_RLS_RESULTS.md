# Gate 2B — Neon RLS Validation Results

**Date:** 2026-06-21
**Environment:** Neon `teamframe` project — eu-west-2 (London)
**Endpoint:** ep-winter-sun-ab51hx0l (pooler)
**Postgres version:** PostgreSQL 18.4 (48c2093) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit
**Database:** teamframe
**Runner:** GitHub Actions (ubuntu-latest)

## Migration Result

Migrations 0000–0011 applied via `psql -v ON_ERROR_STOP=1` using the Neon owner role.

| Migration | Status |
|-----------|--------|
| 0000\_hr\_tables | PASS |
| 0001\_rls\_setup | PASS |
| 0002\_hr\_audit\_rls | PASS |
| 0003\_hr\_domain\_core | PASS |
| 0004\_hr\_modules | PASS |
| 0005\_hr\_reports | PASS |
| 0006\_auth\_default\_company | PASS |
| 0007\_harden\_rls\_nullif | PASS |
| 0008\_account\_activation | PASS |
| 0009\_leave\_types | PASS |
| 0010\_leave\_type\_code | PASS |
| 0011\_offboarding\_calculation\_method | PASS |

## Role Verification

```
    rolname     | superuser | bypassrls | can_login 
----------------+-----------+-----------+-----------
 app_privileged | f         | t         | f
 app_user       | f         | f         | t
 neondb_owner   | f         | t         | t
(3 rows)
```

app\_user confirmed: LOGIN=true, superuser=false, BYPASSRLS=false ✓

## Gate Results (18 gates)

| Gate | Status |
|------|--------|
| rls | PASS |
| runtime-rls | PASS |
| appuser-prod | PASS |
| audit | PASS |
| position | PASS |
| employee | PASS |
| orgchart | PASS |
| compensation | PASS |
| leave | PASS |
| policy | PASS |
| document | PASS |
| offboarding | PASS |
| report | PASS |
| activation | PASS |
| report-render | PASS |
| provider | PASS |
| historical-integrity | PASS |
| migration | PASS |

## Limitations

- Neon free tier (eu-west-2); direct port 5432 is blocked from Claude Code remote sessions — gates run via GitHub Actions runner instead.
- `migration-gate` creates a throwaway database on the Neon server (dropped after the gate).
- `PGSSLMODE=require` set at job level so node-postgres and psql both use SSL for all connections, including URLs reconstructed inside migration-gate.ts.
- No client data used; clean Neon staging project only.

## Verdict

Gate 2B: **PASS**
Safe to proceed to Gate 3 (staging deployment smoke test): **YES**
