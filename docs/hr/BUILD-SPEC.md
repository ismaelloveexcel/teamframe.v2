# TeamFrame — Build Spec (CRUD-first)

**Status:** Re-scoped + reviewed against repo. Supersedes the kernel-first `BUILD-SPEC-v2`.
**Architecture decision:** LOCKED — Option B (CRUD-first HR system + minimal audit).
**Last updated:** 2026-06-16 (rev 2 — incorporates Claude Code repo review)

> Recommend renaming branch/path off `hr-kernel` — that word *is* the framing
> being retired. e.g. `spec/hr-v2`, `docs/hr/BUILD-SPEC.md`.
> Note: `cleanup/ui-spine` removed HR UI surfaces (Hiring/Templates/Payroll).
> This spec **deliberately reintroduces** them as CRUD modules under the new model.

---

## 0. Product definition (one line)

A multi-tenant CRUD HR system with audit logging and document/report generation —
the operational backend for a fractional HR service.

It is **not** an ERP kernel, an event system, or a workflow engine.

---

## 1. Architecture decision (LOCKED — do not reopen)

**Truth model:** relational tables are the source of truth. Not events.

The oscillation across prior sessions came from one hidden assumption — *"we must
preserve the architectural purity of the event-sourced kernel."* It only earns its
cost under multi-service architecture, distributed consistency, or high-scale
concurrency. None are true at 5 clients. Dropped. **The cost now is not any one
paradigm — it's re-litigating the paradigm. Lock it.**

| Layer | Decision |
|---|---|
| Domain truth | **Relational tables** with audit fields |
| Audit | **Single `hr_audit_log` table**, written transactionally (§4). No replay, no projections, no sequence model |
| Tenant isolation | **App-layer scoping + Postgres RLS** (§9). Defense-in-depth, required |
| Event store / outbox / idempotency | **Dormant.** Left in place; not in the HR write path. Outbox only if an external integration needs it |
| Workflows | **None.** HR operations are state transitions, not orchestrations |

---

## 2. Keep / Dormant / Delete

### Keep (active product)
- The HR shells **confirmed present** in the repo — `peopleTable`,
  `documentsTable`, `compensationRecordsTable`, `offboardingCompletionsTable`,
  `policiesTable`. The CRUD foundation is already there.
- `db.transaction()` is **confirmed already in use** in services — atomic
  audit writes (§4) are immediately available.
- Existing app shell, React + shadcn + Tailwind + Express + Postgres + Drizzle.
- The org-chart view (§6).

### Dormant (infrastructure, hidden from product)
- Existing event store — left in place, **not** in the HR write path.
- `actionsTable` — present in repo; stop reading/writing it. Do not hard-drop.
- Outbox — only if an external integration justifies it.
- Idempotency-key system — optional, useful on report-generation endpoints.

### Delete from spec entirely
- Workflow engine and `workflow_id` on every entity
- Snapshot engine
- `global_sequence_number` dependency for HR logic
- Replay / integrity model as a product requirement
- Deterministic projection logic
- Event-as-domain-model assumption
- "Founder Dependency Report" / org-visibility product (retire; archive branch, do not hard-delete)

---

## 3. Core data model

Everything rests on **two core objects: Position and Employee.** Every other
entity is a relation, a view, or an export of those two.

All tables are plain relational tables with standard audit fields:
`id`, `company_id`, `created_at`, `updated_at`, `created_by`, `updated_by`.

| Entity | Role | Key fields |
|---|---|---|
| **Company** | Tenant root | name, jurisdiction, currency, config |
| **User** | Auth identity (global, not tenant-scoped) | email, password/OIDC, status |
| **Membership** | User↔Company + role | role (RBAC) |
| **Position** *(core)* | Org-structure object | title, department, line_manager (→ Position), budgeted/non-budgeted, grade, location, employment_type, JD, status |
| **Employee** *(core)* | People object | name, emp_no, DOB, nationality, contacts, address, emergency_contacts, join_date, documents (visa/passport/Emirates ID + expiry), status |
| **PositionAssignment** | Links Employee→Position | employee_id, position_id, start_date, end_date |
| **Compensation** | Pay record | amount (int minor units), **currency (explicit)**, components |
| **Leave** | Leave record | type, dates, days, balance, status |
| **Policy** | Policy + version | title, version, body |
| **PolicyAcknowledgement** | Ack tracking | policy_id, employee_id, acked_at |
| **Document** | Generated/stored doc | type, template_id, employee_id, attachments |
| **Template** | Merge template | name, body, mergeable fields |
| **Offboarding** | Exit record | employee_id, exit_date, exit snapshot, gratuity (§12) |

> **Field lists above are indicative, not final.** Exact mandatory/optional fields
> are produced in **Phase 0** (§10) by auditing the 4 HR repos into
> `DATA_DICTIONARY.md`. Until that file exists, do **not** finalize table schemas
> and do **not** invent fields.

### Data rules (preserve history without events)
- **Assignment history:** reassignment **end-dates the existing
  `PositionAssignment` row and inserts a new one. Never overwrite.** This is how
  org history survives in a CRUD model.
- **Backdated edits:** the DB stays mutable — a past salary/leave *can* be edited.
  Stance: **reports are point-in-time exports (the generated document is frozen);
  the DB is the live current state; the audit log captures any later change.**
  Editing a record after an export does not alter the already-generated document.

---

## 4. Audit layer (REQUIRED)

Single append-only table. Threaded through **every** mutation.

```
hr_audit_log
  id          uuid pk
  company_id  uuid        -- tenant scope
  entity_type text        -- 'employee' | 'position' | ...
  entity_id   uuid
  action      text        -- 'create' | 'update' | 'delete'
  before      jsonb
  after       jsonb
  actor_id    uuid        -- user who made the change
  timestamp   timestamptz
```

- **Transactional write (non-negotiable):** the `hr_audit_log` row is written in
  the **same `db.transaction()` as the mutation**. If the mutation rolls back, no
  audit row is written; if the audit write fails, the mutation rolls back. A dual
  write that can diverge is exactly the inconsistency that voids a legal-grade
  audit in a labour dispute. Support already exists in services.
- **PII notice (conscious):** `before`/`after` will contain salary and bank
  details. The audit table is therefore a PII store, covered by the managed-Postgres
  encryption posture (§9). This is desirable for disputes — just deliberate.

Delivers ~95% of event-sourcing's value at near-zero cost. No replay, no
projections, no sequence.

---

## 5. Auth + RBAC (NEW — the one genuinely novel piece)

Employee self-service requires real login. This is the only net-new system.

- **Users** — real identity (password and/or OIDC). Global table (not tenant-scoped).
- **Sessions** — replace the current header-trusted actor context.
- **RBAC** — minimum two roles: `admin` (operator/Ismael) and `employee`
  (self-service). Optional platform `super_admin`. Role gates field visibility
  (salary/bank split, §12).
- **Employee→User lifecycle (specify, don't fold silently into build):**
  - **Invite** — creating an Employee can issue a one-time invitation to activate a login.
  - **Activate** — invited employee sets credentials → becomes a `User` with an `employee`-role membership for that company.
  - **Deactivate** — offboarding sets the User `status` inactive; access revoked, record retained.

> Historical events were written under header-trust. The event store is now dormant
> and not the truth model, so this is closed, not a live concern.

---

## 6. Org chart (landing page) — NOT the retired org-visibility product

The landing page is a **visual org chart**, rendered as a read view over
`Position` + `PositionAssignment` + `Employee`. No actions, no ownership-
intelligence layer, no `actionsTable`. It is a derived view of the two core
objects — it **stays**. The org-*visibility SaaS* (Founder Dependency Report) is
what gets retired.

---

## 7. Modules → tabs

Seven surfaces. Each is either a record the operator maintains or a report
extracted from records. **No workflows, no approvals, no processing.**

| Tab | Backed by | Output |
|---|---|---|
| Positions | Position | feeds org chart |
| Employee | Employee + self-service | onboarding records |
| Payroll | Compensation + Leave (unpaid days) | **Finance report (export)** |
| Policies & Procedures | Policy + PolicyAcknowledgement | acknowledgement tracking |
| Offboarding | Offboarding | **exit report (export)** |
| Document Generation | Template + Document | template-merge + legal attachments |
| Templates | Template | — |

---

## 8. Reports / exports

Client deliverables. `SELECT` + render, not engines.

- **Finance/payroll report** — components + unpaid-leave handling, by period
  (`WHERE date <= cutoff`). No event cutoff, no snapshot engine.
- **Exit report** — serialize the employee's current record at offboarding into a
  frozen document. That *is* the "snapshot."

Both are point-in-time frozen outputs (§3 backdated-edits stance).

---

## 9. Tenant isolation + compliance posture

### RLS (REQUIRED — Phase 1, not "later")
You are a custodian of multiple clients' salaries, Emirates IDs, passports, and
bank details. A single missed `WHERE company_id` leaks one client's payroll to
another — business-ending for a service whose value proposition *is* confidentiality.
Module-by-module AI builds are exactly where that slips. RLS is the only layer that
catches it regardless of app code.

Implementation — RLS alone is not enough; it needs the context plumbing or it
locks out your own login:
- Enable RLS + a policy on every tenant-scoped table:
  `USING (company_id = current_setting('app.company_id')::uuid)`.
- App sets `SET LOCAL app.company_id = <session company>` at the **start of each
  request transaction** (use `SET LOCAL`, not session-level — safe under a
  transaction pooler).
- **Privileged path for identity resolution:** login/session establishment must
  resolve `User` (global) → `Membership` → company **before** a tenant context
  exists. Run this narrow path under a `BYPASSRLS` service role (or a
  `SECURITY DEFINER` function scoped to identity lookup). Super-admin operations
  use the same privileged path. Everything else runs RLS-enforced with
  `app.company_id` set.

### Compliance (infra, not built)
- Encryption-at-rest → choose a **managed Postgres with encryption by default**.
  Not custom crypto code.
- **Deleted:** crypto-shredding system, snapshot engine. RLS is kept (above);
  it was the one de-scope worth reversing.

---

## 10. Build order (data-dependency sequence) + acceptance gates

One module per Claude Code prompt. Schema changes isolated from app-layer changes.
Each step ships only when its gate is falsifiably true.

| # | Build | Falsifiable acceptance gate |
|---|---|---|
| **0** | **Data dictionary** — read-only audit of the 4 HR repos → `DATA_DICTIONARY.md` | File exists; lists every Position/Employee/Leave/Compensation field as mandatory/optional, typed, with source repo |
| **1** | Auth + Company + RBAC + **RLS** | (a) A query authenticated as Company A returns **0** of Company B's rows even with the `WHERE company_id` removed from app code. (b) Login resolves user→company without being locked out by RLS. (c) `employee` role cannot read another employee's salary field |
| **2** | `hr_audit_log` (cross-cutting) | Every create/update/delete on a core entity writes exactly one audit row **in the same transaction**; rolling back the mutation leaves no audit row |
| **3** | Position | Create/edit/list positions; org-chart query returns the reporting hierarchy |
| **4** | Employee + PositionAssignment | Create employee; assign to position; reassign → old assignment is **end-dated**, new row inserted, both present in history |
| **5** | Org-chart view (landing page) | Renders from positions+assignments+employees; contains **no** `actionsTable` reference |
| **6** | Compensation, Leave, Policy/Ack, Document/Template, Offboarding | Each module: CRUD + its export. Policy acknowledgement recorded per employee. Offboarding writes a frozen exit record |
| **7** | Reports | Finance report reflects unpaid-leave days for the period; exit report freezes the employee record at exit_date; editing a record **after** export does not change the already-generated document |

---

## 11. Anti-drift guardrail (replaces the org-visibility guardrail)

> Every feature is either **(a)** a record the operator maintains, or **(b)** a
> report extracted from records. **No workflows, no approvals, no processing,
> no event-sourced HR entities.** If a feature requires any of those → reject it.

---

## 12. Open decisions (Ismael — your domain, your call)

HR/UAE-law calls where your 15 years outweigh any default. Light leanings; confirm
before the relevant module is built.

1. **End-of-service gratuity in Offboarding** — *lean: include.* UAE EOS gratuity
   is statutory; an exit report without it is incomplete. Your call.
2. **Leave types to pre-load** — *lean: UAE statutory set + unpaid.* Exact list is yours.
3. **Salary vs bank details visibility** — *lean: salary `admin`-only, bank details
   `employee`-entered.* This is an RBAC field-gate (§5). Confirm.

---

## 13. Verification status

Repo verified by Claude Code (read-only):
- HR shell tables present; `db.transaction()` already used; `actionsTable` present.
- `DATA_DICTIONARY.md` **absent** → now an explicit Phase 0 (§10), not a dangling reference.

From the old kernel-first `BUILD-SPEC-v2`, exactly three things are carried forward
— **per-phase acceptance gates (§10), RLS (§9), transactional audit (§4)**. Everything
else event-sourced (snapshots, workflows, global sequence, multi-log model) is
correctly retired. With those folded in, the old spec is fully superseded; this
document is the single source of truth.
