# TeamFrame — Build Runbook (paste into Claude Code, in order)

Run these sequentially in Claude Code with the repo open. Each prompt builds one
thing, has a falsifiable gate at the end, and says "stop when the gate passes."
**Only come back to chat if a gate fails or Phase 0 surfaces a real surprise.**

Repo: `github.com/ismaelloveexcel/teamframe.v2`
Rename branch to `spec/hr-v2` first if you want (optional, non-blocking).

---

## GLOBAL RULES (these apply to every prompt below)

```
GLOBAL RULES FOR THIS BUILD:
- Truth model is relational tables. NOT events.
- Do NOT touch, extend, or route through: the event store, outbox, projections,
  global sequence, or actionsTable. They are dormant. Leave them as-is.
- No workflow engine. No workflow_id. No snapshots. No approvals. No processing.
- Every feature is either a record the operator maintains or a report extracted
  from records. If a task seems to need a workflow, stop and flag it.
- From Prompt 2 onward: every create/update/delete writes one hr_audit_log row
  IN THE SAME db.transaction() as the mutation.
- Build only what the current prompt asks. Do not scope-creep into later modules.
- When the gate passes, STOP and report. Do not continue to the next module.
```

---

## PROMPT 0 — Data Dictionary (READ-ONLY, build nothing)

```
Read-only audit. Do NOT modify, build, refactor, or scaffold anything.
Produce ONE file: docs/hr/DATA_DICTIONARY.md. When done, stop.

Read these repos (clone read-only as needed):
- github.com/ismaelloveexcel/baynunah-hr-portal-2026
- github.com/ismaelloveexcel/HR-DIGITAL-PASS
- github.com/ismaelloveexcel/Secure-Renewals-2
- github.com/ismaelloveexcel/baynunah-hr-portal
- (local) this teamframe repo, including the existing peopleTable,
  documentsTable, compensationRecordsTable, offboardingCompletionsTable,
  policiesTable schemas.

For each repo, extract the real data model: DB schemas, type defs, form fields,
validation rules. Produce a consolidated dictionary grouped by entity:

  POSITION    — every field found (title, department, line_manager,
                budgeted/non-budgeted, grade, headcount, location,
                employment_type, JD, salary band, status, ...)
  EMPLOYEE    — every field (name, emp_no, DOB, nationality, contacts, address,
                emergency_contacts, join_date, position link, manager, salary,
                bank details, documents: visa/passport/Emirates ID + expiry, ...)
  LEAVE       — type (annual/sick/unpaid), dates, days, balance, status
  COMPENSATION— components, currency, bank, deductions, unpaid-leave handling
  POLICY      — title, version, body, acknowledgement fields
  OFFBOARDING — exit fields, gratuity inputs, exit-report fields
  DOCUMENT/TEMPLATE — template fields, merge fields, attachment handling

For EACH field: mark mandatory/optional, give type, and name the source repo.
Where repos disagree, list both and flag the conflict. Do not invent fields.

GATE: docs/hr/DATA_DICTIONARY.md exists and lists every Position/Employee/Leave/
Compensation field as mandatory-or-optional, typed, with source repo. Stop.
```

---

## PROMPT 1 — Auth + Company + RBAC + RLS

```
[Apply GLOBAL RULES above.]

Build the multi-tenant foundation. Relational tables only.

Tables:
- users (GLOBAL, not tenant-scoped): id, email (unique), password_hash or
  oidc_subject, status ('invited'|'active'|'inactive'), created_at.
- companies: id, name, jurisdiction, currency, config (jsonb).
- memberships: id, user_id, company_id, role ('admin'|'employee'|'super_admin').
- sessions: replace any header-trusted actor context with real sessions.

RBAC: admin = operator (full access within their companies). employee =
self-service (own record only). super_admin = platform/all companies.

RLS (REQUIRED — defense-in-depth on confidential client data):
1. Enable RLS on every tenant-scoped table and add a policy:
     USING (company_id = current_setting('app.company_id')::uuid)
2. At the start of each request transaction, set the tenant context:
     SET LOCAL app.company_id = '<authenticated session company_id>'
   Use SET LOCAL (transaction-scoped), never session-level — safe under a pooler.
3. PRIVILEGED PATH (critical, or login breaks): identity resolution must read
   users (global) -> memberships -> company BEFORE any tenant context exists.
   Run login/session-establishment and super_admin ops under a BYPASSRLS service
   role OR a SECURITY DEFINER function scoped to identity lookup only.
   All other queries run RLS-enforced with app.company_id set.

GATE (all three must pass):
(a) A query authenticated as Company A returns ZERO of Company B's rows EVEN IF
    the WHERE company_id clause is removed from the app code (prove RLS works).
(b) Login succeeds and resolves user -> company without being locked out by RLS.
(c) An employee-role user cannot read another employee's salary field.
Stop when all three pass.
```

---

## PROMPT 2 — Audit log (transactional)

```
[Apply GLOBAL RULES above.]

Create hr_audit_log:
  id uuid pk, company_id uuid, entity_type text, entity_id uuid,
  action text ('create'|'update'|'delete'), before jsonb, after jsonb,
  actor_id uuid, timestamp timestamptz.

Provide a single mutation helper that all CRUD goes through. It MUST write the
audit row inside the SAME db.transaction() as the mutation (db.transaction is
already used in services). If the mutation rolls back, no audit row. If the audit
insert fails, the mutation rolls back. No dual-write outside the transaction.

GATE: every create/update/delete on a core entity writes exactly ONE audit row
in the same transaction; forcing the mutation to roll back leaves NO audit row.
Stop.
```

---

## PROMPT 3 — Position (core object 1)

```
[Apply GLOBAL RULES above. Use field definitions from docs/hr/DATA_DICTIONARY.md.]

Build the Position table + admin CRUD (create/edit/list/view). Include the
self-referential line_manager (Position -> Position) for hierarchy. All mutations
go through the Prompt-2 audit helper. RLS-scoped.

GATE: admin can create/edit/list positions; a hierarchy query returns the
reporting tree (line_manager chain). Stop.
```

---

## PROMPT 4 — Employee + PositionAssignment (core object 2 + link)

```
[Apply GLOBAL RULES above. Use field definitions from docs/hr/DATA_DICTIONARY.md.]

Build:
- Employee table + admin CRUD. Include emergency_contacts and document fields
  (visa/passport/Emirates ID + expiry) per the dictionary.
- PositionAssignment: employee_id, position_id, start_date, end_date.
  REASSIGNMENT RULE: never overwrite. Reassigning end-dates the existing
  assignment row and inserts a new one. History is preserved by rows, not events.
- Employee -> User invitation hook: creating an Employee can issue a one-time
  invite that lets them activate an 'employee' login (status invited -> active).

All mutations through the audit helper. RLS-scoped.

GATE: create employee; assign to a position; reassign -> the old assignment is
end-dated and a new row inserted, BOTH visible in history. Invite creates an
'invited' user. Stop.
```

---

## PROMPT 5 — Org chart (landing page view)

```
[Apply GLOBAL RULES above.]

Build the landing-page org chart as a READ-ONLY view rendered from Position +
PositionAssignment + Employee. It is a derived view of the two core objects.
It must NOT reference actionsTable and must NOT introduce any
ownership/actions/intelligence layer.

GATE: the org chart renders the current structure from positions+assignments+
employees, and grep confirms no actionsTable reference in the view code. Stop.
```

---

## PROMPT 6 — CRUD modules (Compensation, Leave, Policies, Documents/Templates, Offboarding)

```
[Apply GLOBAL RULES above. Use docs/hr/DATA_DICTIONARY.md for all fields.]

Build these as plain CRUD, each with admin management. All mutations through the
audit helper. RLS-scoped. Build them one at a time; gate each before the next.

- Compensation: amount (int minor units), currency (explicit), components.
  DEFAULT: salary is admin-only; bank details are employee-entered (RBAC field
  gate). [Override later if Ismael decides otherwise.]
- Leave: type, dates, days, balance, status.
  DEFAULT pre-loaded types: UAE statutory set + unpaid. [Override list later.]
- Policy + PolicyAcknowledgement: policy versioning + per-employee ack record.
- Document + Template: template-merge generation + legal attachments.
- Offboarding: employee_id, exit_date, exit fields.
  DEFAULT: include end-of-service gratuity inputs/calc. [Confirm with Ismael.]

GATE (per sub-module): CRUD works; policy ack is recorded per employee;
offboarding writes a frozen exit record. Stop after the last one.
```

---

## PROMPT 7 — Reports (the client deliverables)

```
[Apply GLOBAL RULES above.]

Build two exports as SELECT + render (no engines, no snapshots):
- Finance/payroll report: components + unpaid-leave days for a period
  (WHERE date <= cutoff). This is the Finance handoff.
- Exit report: serialize the employee's record at exit_date into a FROZEN
  document.

POINT-IN-TIME RULE: generated reports/documents are frozen. The DB stays mutable;
editing a record AFTER a report is generated does NOT change the already-generated
document. The audit log captures the later change.

GATE: Finance report reflects unpaid-leave days for the period; exit report is
frozen at exit_date; editing a source record after export leaves the generated
document unchanged. Stop.
```

---

## After the runbook

Build steps complete = a working multi-tenant CRUD HR system with audit logging,
org chart, and the two client deliverables. Then UX polish on the report outputs
(the Finance handoff + exit report) is where "surprising and premium" actually
matters — that's the next session, not now.
