# Production RLS Verification — Paid-Pilot Blocker

> **Status: `PENDING_OPERATOR_VERIFICATION`**
> This procedure has **not** been run against production from this repository.
> Code is paid-pilot ready **pending operator verification of production RLS**.
> Do **not** onboard a second paying client until the verification below PASSes
> against the production database and the evidence is captured here.

---

## Why this exists

TeamFrame is multi-tenant on a single Postgres instance. Tenant isolation is
enforced two ways, defence-in-depth:

1. **Application layer** — every query filters by `companyId`.
2. **Database layer (RLS)** — tenant tables have `FORCE ROW LEVEL SECURITY`
   with a policy keyed on the `app.company_id` GUC that `runWithTenant()` sets
   per request. The runtime connects as **`app_user`**, which is
   **`NOBYPASSRLS`**, so the database refuses cross-tenant rows even if an
   application filter is ever forgotten.

The single largest production footgun is connecting the runtime as a
**superuser or a `BYPASSRLS` role**. Such a role silently ignores every policy,
collapsing isolation back to "we hope every query has the right `WHERE`". CI
proves the model works on a throwaway database; it cannot prove that the
*production* connection string actually points at the `NOBYPASSRLS` role with
the RLS migrations applied. That is what this script checks.

> **Audit assumption corrected:** the launch audit described this as verifying
> `tenancy_rls_v2.sql` / `current_actor_tenant_id()` on Supabase. This repo does
> **not** use Supabase, JWTs, or that function. Tenant identity is the
> `app.company_id` GUC on a `NOBYPASSRLS` Postgres role. The script verifies the
> equivalent guarantees for the architecture actually shipped (RLS migrations
> `0001`, `0002`, `0003`, `0004`, `0005`, `0007`, `0009`).

---

## What the script checks

`artifacts/api-server/src/__rls_check__/prod-rls-verify.ts` is **read-only**
(no INSERT/UPDATE/DELETE; the only session state it touches is `app.company_id`
inside a rolled-back transaction).

**Hard checks (failure ⇒ exit 1):**

1. The runtime role is **not a superuser** and is **`NOBYPASSRLS`**.
2. Every table carrying an `app.company_id` policy also has RLS **forced** and is
   **`NULLIF`-hardened** (migration `0007`) so an empty/reset GUC fails closed —
   no half-configured isolation.
3. **Fail-closed:** with no tenant context, `companies` returns 0 rows.
4. **No cross-tenant resolution:** a random/unknown `app.company_id` returns 0
   rows from `companies`.

**Informational (printed; requires manual operator review):**

- An inventory of every tenant-keyed table and whether it is DB-isolated. Some
  tenant-keyed tables are **not** protected by RLS and rely on application-level
  filtering or SECURITY DEFINER access:
  - `sessions` — identity/infra, accessed only via the SECURITY DEFINER
    `get_session_with_membership` function (like `users`); RLS not required.
  - The **legacy `organizations/people/actions` model** (`people`, `actions`,
    `positions`, `teams`, `organization_memberships`, `*_ownerships`,
    `*_assignments`, `policies`, `documents`, `compensation_*`, `evidence_*`,
    `audit_events`, `offboarding_completions`, …). These back the **legacy
    header-trusted routes** (`routes/organizations.ts`, `routes/ops.ts`) and are
    isolated only by application-level `organization_id` filters.

  **Before onboarding client #2, confirm the legacy routes are not exposed to
  paying clients** (the shipped HR product uses the fully RLS-isolated `hr_*`
  tables). If the legacy surface will be used by multiple paying tenants,
  isolating those tables is required work and must be scoped separately — do not
  treat this verification as covering them.

---

## How to run it (operator)

> Requires the **production** connection string for the `app_user` role — the
> exact one the server runs with. Never commit credentials.

```bash
# From the repo root, with production creds in your shell (not in the repo):
DATABASE_URL="postgresql://app_user:<PASSWORD>@<PROD_HOST>:5432/teamframe?sslmode=require" \
  pnpm --filter @workspace/api-server run verify:rls:prod | tee prod-rls-verification-$(date +%Y%m%d).txt
```

Expected final line on success:

```
=== PRODUCTION RLS VERIFICATION: PASS ===
```

If you see `FAIL`:

- **role check fails** → `DATABASE_URL` points at a superuser/`BYPASSRLS` role.
  Fix the runtime connection to use `app_user` (see `DEPLOYMENT.md §4a`). This is
  the blocker — do not proceed.
- **forced/hardened check fails** → an RLS migration (`0001`/`0007`) did not land
  on production. Re-apply migrations `0000`→latest with a privileged connection.
- **fail-closed / cross-tenant fails** → stop and investigate immediately; do not
  onboard anyone.

---

## Evidence capture (paste here after running)

```
Date run:                    __________
Run by:                      __________
Prod host (no creds):        __________
Runtime role / rolbypassrls: __________
Final result (PASS/FAIL):    __________
Non-isolated tables review:  __________  (legacy routes exposed to clients? yes/no)
Verification log attached:   prod-rls-verification-YYYYMMDD.txt
```

Until the block above is filled in with a **PASS**, this item remains
`PENDING_OPERATOR_VERIFICATION` and the paid pilot is **not** cleared for a
second concurrent paying tenant.
