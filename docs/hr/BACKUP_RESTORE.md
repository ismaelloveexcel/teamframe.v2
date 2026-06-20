# Backup and Restore Runbook

> **Warning**: Never restore production casually. Confirm owner approval and the exact target timestamp before touching anything. A restore is irreversible on the branch it targets. When in doubt, create a safety branch first and restore there.

---

## 1. Purpose and When to Use This Runbook

TeamFrame holds HR and employee data: position records, compensation history, leave balances, policy acknowledgements, documents, and offboarding records. This data is legally sensitive and operationally critical. Loss or corruption requires a controlled, verifiable recovery process.

Use this runbook when:

- Data was accidentally deleted or corrupted via the application or a direct database operation.
- A failed migration left the database in a partially-applied state.
- A security incident requires rolling back to a known-clean state.
- A client requests point-in-time recovery of their tenant data.

Do **not** use this runbook to test or explore — use a development Neon branch for that.

---

## 2. Production Database Assumptions

| Assumption | Required value |
|---|---|
| Database provider | Neon Postgres |
| Database role used by the application | `app_user` (NOBYPASSRLS) |
| Row-Level Security | Enforced on all tenant tables via `FORCE ROW LEVEL SECURITY` |
| Migrations applied | `0000_hr_tables.sql` through `0011_offboarding_calculation_method.sql` |
| Connection string env var | `DATABASE_URL` in the api-server Vercel project |
| Neon project plan | Must be on a plan that supports branch restore history (Free tier supports 24 hours; paid plans support longer windows) |

The application **must not** connect as a superuser in production. If `DATABASE_URL` contains a superuser role, RLS is bypassed and tenant isolation is broken.

---

## 3. Confirming Backup and Restore Is Available

Before an incident, verify this during initial setup and again before any restore:

1. Open the [Neon Console](https://console.neon.tech) and select the TeamFrame project.
2. Go to **Branches** in the left sidebar.
3. Select the production branch (typically named `main` or `production`).
4. Click **Restore** (or check the **Backup & Restore** page if your plan exposes it separately).
5. Confirm the **restore history window** shown — this is how far back you can recover. Note the timestamp and store it in the incident log.

If restore history is not available (e.g., the project was just created), your only recovery path is from a manual `pg_dump` backup. See Section 5b.

---

## 4. Pre-Restore Safety Branch

Before restoring the production branch, create a safety branch to preserve the current (possibly corrupted) state for forensics.

In the Neon Console:

1. Go to **Branches** → select the production branch.
2. Click **Create branch**.
3. Name it: `incident/restore-YYYYMMDD-HHMM` (e.g., `incident/restore-20260620-1430`).
4. Select **Branch from: HEAD** (the current state).
5. Click **Create branch**.

This branch costs nothing to keep short-term and lets you inspect the corrupted state or export specific records before overwriting anything.

Alternatively, export the current state via `pg_dump` before proceeding:

```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-acl \
  --no-owner \
  --file="pre-restore-$(date +%Y%m%d-%H%M%S).dump"
```

Store the dump file somewhere safe outside Neon before continuing.

---

## 5. Restoring the Production Branch from History

### 5a. Neon Console (recommended)

1. Open the Neon Console → **Branches** → select the production branch.
2. Click **Restore**.
3. In the restore dialog, select **Restore to a point in time**.
4. Enter the target timestamp — the last known-good moment **before** the incident. Use UTC. Confirm this timestamp with the account owner before proceeding.
5. Review the warning: this will overwrite the branch. Click **Restore**.
6. Wait for the restore to complete (typically under 60 seconds).

### 5b. Manual restore from pg_dump (if Neon restore history is unavailable)

If you have a `pg_dump` file from before the incident:

```bash
# 1. Drop and recreate the database (requires a superuser connection — use only for this step)
psql "$SUPERUSER_DATABASE_URL" -c "DROP DATABASE teamframe;"
psql "$SUPERUSER_DATABASE_URL" -c "CREATE DATABASE teamframe OWNER app_user;"

# 2. Restore the dump
pg_restore \
  --dbname="$DATABASE_URL" \
  --no-acl \
  --no-owner \
  --verbose \
  pre-restore-YYYYMMDD-HHMMSS.dump

# 3. Re-apply any migrations that post-date the dump (see Section 7)
```

---

## 6. Verifying the Restored Database

After restore completes, verify before routing any application traffic back:

```bash
# Connect as app_user (not superuser) to confirm RLS is active
psql "$DATABASE_URL" -c "SELECT current_user, current_setting('app.company_id', true);"
# Expected: current_user = app_user, setting = empty string or null (no tenant set yet)

# Confirm tables exist
psql "$DATABASE_URL" -c "\dt"
# Should list all HR tables: companies, users, employees, positions, etc.

# Confirm RLS is enforced on a key table
psql "$DATABASE_URL" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'employees';"
# Expected: relrowsecurity = true, relforcerowsecurity = true

# Spot-check row counts (compare to known-good values from before the incident)
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM companies;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM users;"
```

---

## 7. Re-Applying Migrations After Restore

If the restore point predates one or more migrations, re-apply only the missing ones. Do not re-run migrations that are already present — they are not idempotent.

Check which migrations are recorded:

```bash
psql "$DATABASE_URL" -c "SELECT * FROM drizzle_migrations ORDER BY created_at;"
```

Then apply only the missing files in order:

```bash
# Example: if only 0000–0008 are present and 0009–0011 are missing
psql "$DATABASE_URL" -f lib/db/migrations/0009_leave_types.sql
psql "$DATABASE_URL" -f lib/db/migrations/0010_leave_type_code.sql
psql "$DATABASE_URL" -f lib/db/migrations/0011_offboarding_calculation_method.sql
```

After applying, re-verify with the row count and RLS checks above.

---

## 8. Re-Running RLS Gates After Restore

After restoring and re-applying any migrations, run the full RLS gate suite against the restored database. All gates must pass before declaring recovery complete.

From `artifacts/api-server/`, with `DATABASE_URL` pointing at the restored production database:

```bash
pnpm run rls-gate
pnpm run runtime-rls-gate
pnpm run appuser-prod-gate
pnpm run audit-gate
pnpm run position-gate
pnpm run employee-gate
pnpm run orgchart-gate
pnpm run compensation-gate
pnpm run leave-gate
pnpm run policy-gate
pnpm run document-gate
pnpm run offboarding-gate
pnpm run report-gate
pnpm run activation-gate
pnpm run report-render-gate
pnpm run provider-gate
pnpm run historical-integrity-gate
pnpm run migration-gate
```

Any failing gate must be resolved before restoring application traffic. Do not skip gates.

---

## 9. Post-Restore Application Verification

After all RLS gates pass, verify the application layer. Work through each module in order:

### Auth and account activation
- [ ] Register a test user — confirm activation email is triggered (or activation token generated)
- [ ] Activate the account — confirm login succeeds
- [ ] Confirm `POST /api/auth/bootstrap` creates the first admin company correctly
- [ ] Confirm `POST /api/auth/register` does not accept `companyId` or `role` from the request body

### Org structure and positions
- [ ] Create a position — confirm it appears in the org chart
- [ ] Assign an employee to the position — confirm occupancy
- [ ] Transfer the employee — confirm old seat vacated, new seat occupied

### Employees and profiles
- [ ] Create an employee record — confirm it is isolated to the correct company
- [ ] Fetch employees as a different tenant (should return empty)

### Compensation
- [ ] Update an employee's compensation — confirm audit trail entry is created
- [ ] Fetch compensation history — confirm append-only log is intact

### Leave
- [ ] Submit a leave request — confirm balance deduction
- [ ] Approve or reject — confirm state transition

### Documents and policies
- [ ] Upload or reference a document — confirm lifecycle state is `pending_signature` or appropriate initial state
- [ ] Acknowledge a policy — confirm acknowledgement is recorded

### Offboarding
- [ ] Initiate an offboarding — confirm checklist is generated
- [ ] Confirm offboarding calculation method is applied correctly

### Reports
- [ ] Fetch a headcount or org report — confirm data matches expected post-restore state
- [ ] Confirm report render does not error

---

## 10. Incident Log Template

Copy this template into a new file or your incident tracking system at the start of every restore operation:

```
# Incident Log — Database Restore

Date (UTC):
Reported by:
Owner approval obtained from:
Owner approval obtained at (UTC):

## Incident description


## Target restore timestamp (UTC):
## Rationale for choosing this timestamp:

## Safety branch created:
  Name:
  Created at (UTC):

## Pre-restore dump taken:
  File name:
  Location:

## Restore method:
  [ ] Neon Console point-in-time restore
  [ ] Manual pg_dump restore

## Restore completed at (UTC):

## Migrations re-applied (list files):


## RLS gate results:
  [ ] All 18 gates passed
  Failing gates (if any):

## Application verification:
  [ ] Auth / activation
  [ ] Positions / org chart
  [ ] Employees
  [ ] Compensation
  [ ] Leave
  [ ] Documents / policies
  [ ] Offboarding
  [ ] Reports

## Traffic restored at (UTC):
## Confirmed by:

## Post-incident actions:


```

---

## 11. Recovery Checklist

Use this as a quick reference during an active incident. Work top to bottom. Do not skip steps.

- [ ] Confirm the incident scope — what data is affected, which tenant(s), which time window
- [ ] Get explicit owner approval and the confirmed target restore timestamp
- [ ] Check Neon restore history window — confirm the target timestamp is within range
- [ ] Create a safety branch (`incident/restore-YYYYMMDD-HHMM`) from HEAD
- [ ] Take a `pg_dump` of current (corrupted) state
- [ ] Restore the production branch to the target timestamp
- [ ] Verify database: `current_user`, table list, RLS flags, row counts
- [ ] Re-apply any missing migrations
- [ ] Run all 18 RLS gates — confirm all pass
- [ ] Run application verification across all 8 modules
- [ ] Update the incident log with all timestamps and results
- [ ] Restore application traffic
- [ ] Schedule a post-incident review

---

## 12. Additional Notes

**Neon restore history window**: Free-tier projects retain 24 hours of history. Paid plans extend this. Check your project's plan in the Neon Console before an incident — not during one.

**Tenant isolation during recovery**: Even after a restore, RLS is enforced per-tenant. A restore affects all tenants on the database. If only one tenant's data is corrupted, consider exporting the affected rows from a safety branch and re-inserting them rather than performing a full database restore.

**Connection string after restore**: The Neon connection string (host, database name) does not change after a branch restore. The application `DATABASE_URL` does not need to be updated.

**Never use a superuser connection in production**: The `DATABASE_URL` in the api-server Vercel project must use `app_user`. A superuser bypasses all RLS policies. Only use a superuser connection for the specific steps in Section 5b that explicitly require it, and only in a controlled terminal session — never in the application config.
