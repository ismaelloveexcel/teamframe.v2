# Gate 2 — Live Database Validation Results

**Date**: 2026-06-20  
**Branch**: `prep/app-readiness`  
**Database engine**: PostgreSQL 16.13 (local staging, clean database)  
**Admin role used for migrations**: `postgres` (superuser, local socket via TCP with password)  
**App role used for RLS gates**: `app_user` (NOLOGIN→LOGIN enabled for gate run, NOBYPASSRLS confirmed)

---

## Migration Status

| File | Result |
|---|---|
| `0000_hr_tables.sql` | PASS |
| `0001_rls_setup.sql` | PASS |
| `0002_hr_audit_rls.sql` | PASS |
| `0003_hr_domain_core.sql` | PASS |
| `0004_hr_modules.sql` | PASS |
| `0005_hr_reports.sql` | PASS |
| `0006_auth_default_company.sql` | PASS |
| `0007_harden_rls_nullif.sql` | PASS |
| `0008_account_activation.sql` | PASS |
| `0009_leave_types.sql` | PASS |
| `0010_leave_type_code.sql` | PASS |
| `0011_offboarding_calculation_method.sql` | PASS |

**All 12 migrations applied cleanly in sequence with `ON_ERROR_STOP=1`.**

### Migration prerequisite note

Migrations 0000–0011 `ALTER`/reference a `users` table and an `organizations` table that are created by Drizzle's schema push in a normal deployment. For the gate run, these base tables were bootstrapped manually before migration 0000 (matching the content `migration-gate.ts` derives internally). This is documented in `docs/go-to-market/deploy-to-vercel.md` — on Neon, run `drizzle-kit push` or apply the base schema before the numbered SQL files.

---

## Role Verification

```
 rolname        | rolsuper | rolbypassrls | rolcanlogin
----------------+----------+--------------+-------------
 postgres       | t        | t            | t
 app_privileged | f        | t            | f
 app_user       | f        | f            | t
```

- `app_user`: not superuser, `NOBYPASSRLS`, login enabled for gate run only.
- `app_privileged`: not superuser, `BYPASSRLS`, no login (not used by application).

---

## RLS / Security Gate Results

| Gate | Command | Result |
|---|---|---|
| RLS isolation (3 sub-gates) | `pnpm run rls-gate` | **PASS** |
| Runtime RLS (request path) | `pnpm run runtime-rls-gate` | **PASS** |
| App-user production path | `pnpm run appuser-prod-gate` | **PASS** |
| Audit log atomicity | `pnpm run audit-gate` | **PASS** |
| Position gate | `pnpm run position-gate` | **PASS** |
| Employee gate | `pnpm run employee-gate` | **PASS** |
| Org chart gate | `pnpm run orgchart-gate` | **PASS** |
| Compensation gate | `pnpm run compensation-gate` | **PASS** |
| Leave gate | `pnpm run leave-gate` | **PASS** |
| Policy gate | `pnpm run policy-gate` | **PASS** |
| Document/template gate | `pnpm run document-gate` | **PASS** |
| Offboarding gate (EOSG math) | `pnpm run offboarding-gate` | **PASS** |
| Report gate (frozen snapshots) | `pnpm run report-gate` | **PASS** |
| Activation gate | `pnpm run activation-gate` | **PASS** |
| Report render gate | `pnpm run report-render-gate` | **PASS** |
| Compliance provider gate | `pnpm run provider-gate` | **PASS** |
| Historical integrity gate | `pnpm run historical-integrity-gate` | **PASS** |
| Migration gate (throwaway DB) | `pnpm run migration-gate` | **PASS** |

**18 / 18 gates passed. 0 failed.**

### Key sub-gate results

**rls-gate:**
- Gate (a): RLS isolation — Company B rows visible to Company A context: **0** ✓
- Gate (b): `get_user_by_email` SECURITY DEFINER resolves user without RLS context ✓
- Gate (c): admin sees salary field; employee role does not ✓

**appuser-prod-gate** (no superuser used):
- Bootstrap tenant as `app_user` ✓
- Cross-tenant read returns 0 rows ✓
- WITH CHECK blocks cross-tenant membership insert ✓
- No tenant context → 0 rows (fail-closed) ✓

**activation-gate:**
- Invite returns plaintext token; only SHA-256 hash stored ✓
- Activate sets password + active + consumes token ✓
- Re-activate same token fails (single-use) ✓
- Login succeeds after activation ✓
- Duplicate-email invite returns 409 ✓

**migration-gate:**
- Fresh throwaway DB provisioned, all migrations applied ✓
- Leave rows preserved through `hr_leave_type` enum → `leave_type_code` conversion ✓
- Leave balances preserved ✓
- UAE defaults include `hajj`; GENERIC set is `{annual,sick,unpaid}` with no `hajj` ✓
- `hr_leave_type` enum fully dropped ✓

**offboarding-gate:**
- UAE EOSG 21 days/yr (first 5y), no cap — 3y ≈ 2,071,233 fils ✓
- 30 days/yr beyond 5y tier (10y test) ✓
- 24-month cap applied at 40y ✓

**historical-integrity-gate:**
- Prior offboarding gratuity unchanged after jurisdiction change ✓
- Prior report content and rendered HTML byte-for-byte identical ✓

---

## API Smoke Test

Server started with staging `DATABASE_URL`, `PORT=3099`.

| Endpoint | Method | Result |
|---|---|---|
| `GET /api/healthz` | — | `{"status":"ok"}` ✓ |
| `POST /api/auth/bootstrap` | Create company + admin | `companyId` returned ✓ |
| `POST /api/auth/login` | Login as admin | Session token returned ✓ |
| `GET /api/employees` | Authenticated | `[]` (empty, correct) ✓ |
| `GET /api/positions` | Authenticated | `[]` (empty, correct) ✓ |

---

## Code Changes Made

**None.** No application logic, migrations, or deployment configs were changed to make any gate pass. All 18 gates passed against the unmodified `prep/app-readiness` codebase.

---

## Gate 2 Summary

| Category | Status |
|---|---|
| Migrations 0000–0011 | **PASS** — all applied cleanly |
| `app_user` role | **PASS** — `NOBYPASSRLS`, no superuser privileges |
| RLS gates (18 total) | **PASS** — 18/18 |
| API smoke test (5 endpoints) | **PASS** — healthz, bootstrap, login, employees, positions |
| Code changes required | **None** |

**The app is safe to proceed to deployment smoke test on Neon.**

### Prerequisites for Neon deployment smoke test
1. Create Neon project, note connection strings (admin + app_user).
2. Apply base schema (Drizzle push or equivalent) to create `users` and `organizations` tables.
3. Apply migrations 0000–0011 using the admin connection.
4. Set `DATABASE_URL=<app_user connection string>` in the Vercel api-server project.
5. Deploy api-server and hr-web per `docs/go-to-market/deploy-to-vercel.md`.
6. Re-run `pnpm run appuser-prod-gate` and `pnpm run activation-gate` against the Neon `app_user` URL to confirm RLS is enforced in the cloud environment.

---

## Known Staging Environment Difference from Neon

`app_user` is `NOLOGIN` in migration 0001. For the `appuser-prod-gate` to connect as `app_user` directly, `LOGIN` was temporarily granted. On Neon, the equivalent is using a database role with the `app_user` role membership that has login enabled (Neon's role management creates login-capable roles that can `SET ROLE app_user`). The gate results are valid regardless — the NOBYPASSRLS constraint and RLS policies are identical.
