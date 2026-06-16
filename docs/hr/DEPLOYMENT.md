# HR v2 — Deployment & Production RLS

The HR system relies on Postgres Row-Level Security (RLS) for tenant isolation.
RLS is **defence-in-depth**: every query also filters by `companyId` in app code,
but RLS only actually constrains the database when the runtime connects as a
**`NOBYPASSRLS`** role. This document covers the production prerequisites.

## 1. Database roles

Two roles are created by `lib/db/migrations/0001_rls_setup.sql`:

| Role             | Attributes                  | Use                                              |
| ---------------- | --------------------------- | ------------------------------------------------ |
| `app_user`       | LOGIN, **NOBYPASSRLS**      | The application runtime. RLS applies to it.      |
| `app_privileged` | LOGIN, **BYPASSRLS**        | Migrations / break-glass identity ops only.      |

Set passwords for these roles in your environment (the dev defaults are
`app_user_pw` / `app_privileged_pw` — **change them in production**).

## 2. Runtime connection — MUST be `app_user`

The API server reads `DATABASE_URL`. In production it **must** point at
`app_user`, not a superuser:

```
DATABASE_URL=postgresql://app_user:<password>@<host>:5432/<db>
```

If `DATABASE_URL` points at a superuser (or any `BYPASSRLS` role), RLS is
silently bypassed and the only remaining isolation is the app-level
`companyId` filter. Migrations are applied separately (see §4) and may use a
superuser / `app_privileged`.

## 3. How request-time tenant scoping works

- `requireSessionAuth` resolves the session via the `SECURITY DEFINER` function
  `get_session_with_membership()` (bypasses RLS — needed before tenant context
  exists), then opens a tenant scope with `runWithTenant(companyId, …)`.
- `runWithTenant` (in `lib/db`) checks out a dedicated pooled connection, sets
  `app.company_id` on it, routes all `db` access through an `AsyncLocalStorage`
  proxy for the duration of the request, and `RESET`s the GUC on release so a
  pooled connection never leaks tenant context to the next request.
- All tenant policies use
  `NULLIF(current_setting('app.company_id', true), '')::uuid`, so a missing or
  reset context **fails closed** (0 rows) instead of erroring.

## 4. Migrations

Apply raw SQL migrations in order with a privileged connection:

```bash
for f in lib/db/migrations/0001_*.sql \
         lib/db/migrations/0002_*.sql \
         lib/db/migrations/0003_*.sql \
         lib/db/migrations/0004_*.sql \
         lib/db/migrations/0005_*.sql \
         lib/db/migrations/0006_*.sql \
         lib/db/migrations/0007_*.sql; do
  psql "$ADMIN_DATABASE_URL" -f "$f"
done
```

## 5. Tenant onboarding (bootstrap)

`companies` and `memberships` have FORCED RLS, so a brand-new tenant cannot be
created without a tenant context. Use the bootstrap endpoint, which generates
the company id and runs the company + admin-membership inserts inside that
tenant scope (no `BYPASSRLS` needed):

```
POST /api/auth/bootstrap
{ "companyName": "...", "jurisdiction": "UAE", "currency": "AED",
  "adminEmail": "...", "adminPassword": "..." }
```

Then `POST /api/auth/login` returns a session token scoped to that company
(default company resolved via the `SECURITY DEFINER` `get_user_default_company`).

## 6. Verifying production isolation

`appuser-prod-gate` exercises the real production path **as `app_user`** (no
superuser): bootstrap two tenants, prove scope=A reads only A, prove the
`WITH CHECK` blocks cross-tenant writes, and prove no-context reads fail closed.

```bash
cd artifacts/api-server
APP_USER_DATABASE_URL="postgresql://app_user:<pw>@<host>:5432/<db>" \
DATABASE_URL="postgresql://app_user:<pw>@<host>:5432/<db>" \
  pnpm appuser-prod-gate
```
