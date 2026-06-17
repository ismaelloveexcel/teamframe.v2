# TeamFrame v2

Multi-tenant HR SaaS: positions, employees, compensation, leave, policies, documents, offboarding, and reports — backed by Postgres RLS for tenant isolation.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/hr-web run dev` — run the HR frontend (Vite dev server)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/db run push-force` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (must point at `app_user` in production)

## Stack

- pnpm workspaces, Node.js 22+, TypeScript 5.9
- API: Express 5 (`artifacts/api-server`)
- Frontend: React 19 + Vite + Tailwind + TanStack Query (`artifacts/hr-web`)
- DB: PostgreSQL 16 + Drizzle ORM (`lib/db`)
- Validation: Zod v3 (`^3.25`), `drizzle-zod`
- Build: esbuild (API server ESM bundle)

## Where things live

- `lib/db/` — Drizzle schema + migrations (source of truth for DB shape)
- `lib/db/migrations/` — Raw SQL migrations `0000`–`0011` (apply in order)
- `artifacts/api-server/src/routes/` — All API route handlers
- `artifacts/api-server/src/__rls_check__/` — 18-gate CI test suite
- `artifacts/api-server/src/compliance/` — Jurisdiction provider layer (UAE + Generic)
- `artifacts/hr-web/src/` — React HR frontend pages and API client
- `docs/hr/DEPLOYMENT.md` — Fresh-clone provisioning procedure
- `.github/workflows/ci.yml` — CI pipeline definition

## Architecture decisions

- **RLS as defence-in-depth**: All tenant tables have `FORCE ROW LEVEL SECURITY`. The runtime connects as `app_user` (NOBYPASSRLS). `runWithTenant()` sets `app.company_id` on a pooled connection for the request duration and resets it on release — a missing/reset context fails closed (0 rows).
- **SECURITY DEFINER functions** for identity resolution before tenant context exists (`get_user_by_email`, `get_user_default_company`, `get_activation_by_token_hash`, `get_session_with_membership`).
- **Compliance providers** abstract jurisdiction-specific rules. UAE gratuity (EOSG) and leave types live in `providers/uae.ts`; new jurisdictions add a provider without touching core HR logic.
- **Frozen reports**: `hr_report` stores the full JSON payload at generation time. Historical reports are immutable regardless of schema or provider changes.
- **Single-use activation tokens**: Invite flow generates a SHA-256-hashed token stored in `account_activation_tokens`. `POST /auth/activate` consumes it in a single transaction (guarded by `consumedAt IS NULL`).

## Product

Nine HR modules wired end-to-end: **Positions** (org structure), **Employees** (profiles + assignments), **Compensation** (salary + bank), **Leave** (requests + balances), **Policies** (versioned + acknowledged), **Documents** (templates + generated), **Offboarding** (EOSG/gratuity), **Reports** (finance + exit, frozen snapshots), and **Org Chart** (visual hierarchy).

## Gotchas

- `app_user` is created as `NOLOGIN` by migration `0001`. Run `ALTER ROLE app_user LOGIN PASSWORD '...'` before connecting as it (see `DEPLOYMENT.md §4a`).
- Migration `0001` hardcodes `GRANT CONNECT ON DATABASE teamframe` — the DB must be named `teamframe` or that line needs editing.
- `DATABASE_URL` in production must point at `app_user`, not a superuser — a superuser bypasses RLS silently.
- Apply migrations in order (`0000` → `0011`) using a privileged connection; `drizzle push` only handles the base schema.
- CI uses `pnpm v10` — lockfile was generated with v10 overrides; do not downgrade.
