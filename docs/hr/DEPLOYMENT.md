# HR v2 — Deployment & Production RLS

The HR system relies on Postgres Row-Level Security (RLS) for tenant isolation.
RLS is **defence-in-depth**: every query also filters by `companyId` in app code,
but RLS only actually constrains the database when the runtime connects as a
**`NOBYPASSRLS`** role. This document covers the production prerequisites.

## 1. Database roles

Two roles are created by `lib/db/migrations/0001_rls_setup.sql`:

| Role             | Attributes (as created)       | Use                                              |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| `app_user`       | **NOLOGIN**, **NOBYPASSRLS**  | The application runtime. RLS applies to it.      |
| `app_privileged` | **NOLOGIN**, **BYPASSRLS**    | Migrations / break-glass identity ops only.      |

The migration creates both roles as `NOLOGIN` with no password. Before use you
must enable login and set a password with `ALTER ROLE ... LOGIN PASSWORD ...`
(see §4a). Use strong, secrets-managed passwords in production.

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

Apply raw SQL migrations **in order, starting at `0000`**, with a privileged
connection. `0000_hr_tables.sql` creates the base tables that every later
migration (including `0001`'s GRANTs and RLS policies) depends on, so it must
run first — do not skip it:

```bash
for f in lib/db/migrations/0000_*.sql \
         lib/db/migrations/0001_*.sql \
         lib/db/migrations/0002_*.sql \
         lib/db/migrations/0003_*.sql \
         lib/db/migrations/0004_*.sql \
         lib/db/migrations/0005_*.sql \
         lib/db/migrations/0006_*.sql \
         lib/db/migrations/0007_*.sql \
         lib/db/migrations/0008_*.sql \
         lib/db/migrations/0009_*.sql \
         lib/db/migrations/0010_*.sql \
         lib/db/migrations/0011_*.sql; do
  psql "$ADMIN_DATABASE_URL" -f "$f"
done
```

`0008_account_activation.sql` adds the global `account_activation_tokens`
identity table (no RLS) plus the `get_activation_by_token_hash` SECURITY
DEFINER lookup used by `POST /auth/activate`.

### 4a. Enable login for the app roles (one-time, before runtime use)

`0001_rls_setup.sql` creates `app_user` and `app_privileged` as **`NOLOGIN`**
roles with **no password**. Before the application (or the `appuser-prod-gate`)
can connect as `app_user`, you must grant them login and a password — the
migrations deliberately do **not** bake credentials in:

```bash
psql "$ADMIN_DATABASE_URL" -c "ALTER ROLE app_user      LOGIN PASSWORD '<app_user_pw>';"
psql "$ADMIN_DATABASE_URL" -c "ALTER ROLE app_privileged LOGIN PASSWORD '<app_privileged_pw>';"
```

Note also that `0001` hardcodes `GRANT CONNECT ON DATABASE teamframe` — i.e. it
assumes the target database is named **`teamframe`**. If you deploy under a
different database name, edit that `GRANT CONNECT ON DATABASE teamframe ...`
line in `0001_rls_setup.sql` (and re-grant CONNECT on your actual database)
before applying it, or the roles will be unable to connect.

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
