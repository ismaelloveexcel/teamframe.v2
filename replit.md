# TeamFrame v2

TeamFrame is the **check-engine light for people operations** at founder-led
teams of 6–25. It tracks positions, people, contracts/documents, onboarding and
offboarding, surfaces people-ops risk, and produces finance and exit reports —
backed by Postgres RLS for tenant isolation.

It is delivered as a **managed people-ops readiness system**, not self-serve
software (see "Business model" below). Technically it is a multi-tenant
application; commercially it is a high-touch service that an operator sets up and
runs for each client.

## Business model (fixed)

- High-touch **productised service + software** — sold as a managed people-ops
  readiness system, **not** a self-serve SaaS.
- Target: **5 clients**, ~1 day/week per client, operator-led.
- **72-hour done-for-you setup**: the operator provisions the tenant and loads
  the team and documents; clients do **not** self-serve sign up.
- Offer: USD 2,500 setup + USD 2,000/month, 3-month minimum (founding pilot:
  USD 1,000 setup + USD 1,500/month). See `docs/go-to-market/`.

## Build status

Honest snapshot of what is real in the code vs. direction. Do not let marketing
copy outrun this list.

**Shipped (wired end-to-end, RLS-isolated `hr_*` model):**
- Positions, Employees, Compensation, Leave, Policies (versioned + acknowledged),
  Documents (templates + generated/merged), Offboarding (EOSG/gratuity),
  Reports (finance + exit, frozen snapshots), Org Chart.
- Tenant isolation via Postgres RLS (`app.company_id` + `app_user` NOBYPASSRLS),
  session auth, single-use invite/activation, append-only audit log.
- Operator demo seed (`scripts/seed-demo-org.mjs`).

**In progress / direction:**
- The consolidated "risk → fix → proof" dashboard (red/yellow/resolved lanes).
  Compliance/evidence-requirement signals currently live in the **legacy**
  `organizations/people/actions` surface, not the shipped `hr_*` product.

**Planned (V1.5, scoped):**
- One admin **weekly risk digest** of open red/yellow signals (see constraint
  below). Document-**expiry** tracking on `hr_document` (no expiry field today).

**Deliberately NOT building:**
- Self-serve signup / Stripe checkout / automated tenant provisioning.
- Payroll, ATS/recruiting, performance reviews, compensation benchmarking, EOR.
- AI advisor, integrations marketplace, a configurable reminders/notifications
  engine, multi-channel/Slack notifications, escalation workflows.

## Anti-drift constraints

- TeamFrame stays **operator-led**: no self-serve tenant signup.
- TeamFrame is **not** a reminders/notifications platform. V1 may include **one**
  scoped admin digest for open red/yellow signals, but it must not become a
  configurable reminders engine.
- It is **not** a full HRIS and gives **no** legal advice.
- RLS, RBAC, tenant scoping, Zod validation, stale-write guards, and the CI gate
  suite are load-bearing — do not weaken them.

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
