# HR Operating Kernel — Build Spec v2 (execution input)

A multi-tenant, event-sourced HR operating kernel for founder-led companies without
internal HR, delivered as an operator-led managed service. This is the single source
of truth for the build. It is a **build input, not governance** — when the build is
done, it can be archived or removed.

> Executor note: every decision below is **locked**. Do not re-derive or re-open them.
> If you hit a question this spec does not answer, add it to **§9 Open Questions** and
> stop — do not invent an answer.

---

## 1. Existing repo reality (grounded — read before building)

This is an **evolution** of the current repo, not a greenfield build. Verified facts:

**Reuse as-is (already built):**
- Event-sourced core: `artifacts/api-server/src/domain/` (event-core, aggregates, projections, migration) with replay/projection model and an **outbox** (`outboxEventsTable`).
- Tenant scoping: every domain row + event carries `orgId`/`organizationId`. **`organizationId` IS the tenant key (`company_id`).** Do not invent a parallel tenant model.
- `orgEventsTable` already has: `orgId`, `aggregateType`, `aggregateId`, `version` (per-aggregate sequence, unique on `(orgId,aggregateType,aggregateId,version)`), `occurredAt`, `actorUserId`, `correlationId`, `causationId`, `idempotencyKey`, `schemaVersion`, `payload`, `payloadHash`.
- **Idempotency is already enforced** — unique index `(orgId, idempotencyKey)`. Decision #10 is DONE; just keep it.
- `usersTable` (shell: id, email, fullName, timestamps) and `organizationMembershipsTable` (user↔org) already exist.
- `correlationId` + `causationId` already on events — workflow correlation has a foundation.

**Net-new (must be built — do NOT assume these exist):**
- **Global per-company sequence.** There is **no `global_sequence_number`** today — only per-aggregate `version`. Global ordering currently leans on `occurredAt`/insertion. The sequence-based determinism backbone (§3.2) is **new work + a migration**, not a confirmation.
- **Real auth / sessions / RBAC roles / super-admin.** `usersTable` is an identity shell with no auth, no roles, no sessions. The whole Access Layer is greenfield.
- **Access/Security audit log** (§3, log B).
- **Snapshots, Workflows-as-entities, Leave, Documents/Templates, Payroll engine, Compliance modules, Employee self-service.**
- **Postgres RLS** — not present today.
- **Encryption-at-rest for snapshot payloads.**

**Migration, not just "don't build":** an `auditEventsTable` already exists. Decision #3
removes the domain-audit mirror — plan its removal/repurpose explicitly (see §9 Q7).

**Verify-before-trust (do these in Phase 0, do not assume):**
1. Confirm the core is truly events-as-truth (state tables are projections, not the source). If any state table is written independently of events, that path must be converted.
2. Confirm/replace global ordering: add an atomic, monotonic, never-reused **per-company** sequence (§3.2). Per-aggregate `version` alone is insufficient for cross-entity payroll/snapshot cutoffs.
3. Confirm auth is header-based today (`requireActorContext` reading `x-user-*`) — it is to be replaced, not extended.

---

## 2. What this is / is NOT

**IS:** an event-sourced HR kernel with deterministic replay, a snapshot truth layer for
legal/payroll output, workflow orchestration, and a managed-service multi-tenant control plane.

**IS NOT:** a payroll processor, tax engine, ATS, accounting system, or banking system.
No payments, no tax computation, no banking integration.

---

## 3. Core invariants (NON-NEGOTIABLE)

### 3.1 Multi-tenant isolation — enforced at the DATABASE layer
- Every record carries `company_id` (= existing `organizationId`).
- Isolation enforced via **Postgres Row-Level Security**, not application scoping alone.
  Application scoping stays as belt; RLS is the enforced guardrail. No cross-tenant joins.

### 3.2 Determinism — `global_sequence_number` is the ONLY ordering key
- Add a **per-company** `global_sequence_number`: generated at commit, **monotonic per
  company, concurrency-safe, never reused** (DB sequence per company, or a locked
  allocator table). Assigned in commit order.
- **Timestamps are never used** for ordering, snapshot reconstruction, or payroll cutoff.
- Snapshot = deterministic projection of all events with
  `global_sequence_number <= cutoff_sequence_number`.

### 3.3 Events are the ONLY domain write model
- `Command → Event → Projection → Query`. State tables are projections.
- **No AuditEvent / mirror / post-commit dual write.** Domain audit = a projection of the event log.

### 3.4 THREE distinct log systems (never merged)
- **A. Domain Event Log** — state truth; domain mutations only (employee/position/payroll-run/
  document-lifecycle events). Drives projections + deterministic replay. Excludes reads/logins/access.
- **B. Access / Security Audit Log** — *separate* compliance subsystem. `AccessEvent { actor_user_id,
  target_company_id, action_type (LOGIN|VIEW_PAYROLL|IMPERSONATE|EXPORT|…), resource_type, resource_id,
  timestamp, ip/device/session_id, correlation_id }`. Captures logins, sessions, **cross-tenant
  access, impersonation, sensitive reads/exports**. NOT part of the domain event stream.
- **C. Snapshot System** — legal output truth (payroll/documents/offboarding). Derived from the
  event log only; records no reads/access.
- Rule: Events = *what changed*; Access log = *who saw/used what*. Both required; neither replaces the other.

### 3.5 Identity separation
- `User` (auth identity) ≠ `Employee` (HR entity). Employee may or may not map to a User.
  User-without-Employee = operator/admin. Employee-without-User = system-created HR record.
  Access resolution at the auth middleware layer.

### 3.6 Money
- Integer **minor units** + **explicit currency** (per company). **No floats** anywhere in the domain layer.

### 3.7 Snapshots
- Write-once, immutable, self-contained JSON. `data_blob` **encrypted at rest**; support key
  rotation and a **tombstone / crypto-shred** model for erasure compliance. Carry `schema_version`,
  `workflow_id`, `cutoff_sequence_number`, `deterministic_hash`.

### 3.8 Workflows
- State machine: `pending | running | partially_failed | failed | completed`.
- Every event/snapshot/document references a `workflow_id`. A snapshot is **valid only if its
  workflow = completed**.

---

## 4. RBAC (three roles)
- **Platform Super Admin** (provider): cross-company access. **Every cross-tenant action MUST write
  an AccessEvent.** Impersonation optional but always logged.
- **Company Operator**: scoped to one `company_id`; full HR ops for that company.
- **Employee**: self-service only (own profile/documents/leave/acknowledgements).
- Salary = operator-only. Org structure = operator-only. Bank details = employee-editable,
  operator-viewable. Cross-employee access forbidden.

---

## 5. Domain model (corrected)
- **Company** (extend `organizations`): + jurisdiction, active_modules[], payroll_config, branding_config, **currency**.
- **Position**: + department, location, reporting_position_id, grade, job_description_file, budgeted_salary (int+currency), status (active|retired), occupancy (filled|vacant|reserved). Max 1 active employee per position; positions independent of employees; may be vacant indefinitely.
- **Employee**: status `Draft → Pending → Active → Notice → Exited` (Exited read-only; Notice in payroll; Pending excluded from payroll + org visibility); employee_number, position_id, joining_date, finalised_salary (int+currency), personal_details (json), bank_details (json), workflow_id.
- **PositionAssignment**: employee_id, position_id, start/end, workflow_id (full org-history reconstruction).
- **Leave**: type, dates, days, paid_flag, status `Draft|Submitted|Approved|Rejected|Cancelled`, workflow_id. Only **Approved** leaves with `global_sequence_number <= payroll cutoff` affect payroll.
- **Policy** + **PolicyAcknowledgement** (versioned).
- **Document / DocumentRequest**: lifecycle `Draft→Generated→Issued→Signed→Archived`; templates compile **only** from snapshot JSON (allowed: `{{employee.*}} {{position.*}} {{company.*}} {{snapshot.*}}`; forbidden: live DB lookups).
- **User / Session / Membership(role)** (Access Layer).
- **AccessEvent** (log B). **Snapshot** (§3.7). **Workflow** (§3.8).

---

## 6. Payroll (snapshot engine only)
- Core defines the **pipeline**: cycle, inclusion rules, **proration** (mid-cycle joiners, mid-cycle
  exits, notice-period partial inclusion), **leave-overlap precedence**, leave aggregation, snapshot generation.
- Jurisdiction module defines the **formula** (salary calc, deductions, EOSG). Interface:
  `PayrollEngine.compute(inputSnapshot, jurisdictionModule) -> result`.
- Cutoff is a **sequence boundary** (`cutoff_sequence_number`), never a timestamp. Post-cutoff
  changes excluded even if backdated. Each run emits a snapshot (employee+position+salary+leave
  adjustments+bank+company context+workflow ref). No payments/tax/banking.

---

## 7. Compliance modules
- Jurisdiction-agnostic core. UAE module default-enabled. Modules may only change
  **calculations / templates / validation** — never the core schema. EOSG indicative only.

---

## 8. Build order (KERNEL-FIRST) with acceptance gates

Each phase ends with its falsifiable gate green (lightweight checks, **not** heavyweight
certification ceremony). Domain entities are **always** built emitting events — never CRUD-then-retrofit.

| # | Phase | Depends | Acceptance gate (falsifiable) |
|---|---|---|---|
| 0 | Kernel verify + harden: confirm events-as-truth; add per-company `global_sequence_number` (atomic); add **RLS** on all company-scoped tables; confirm idempotency | existing core | replay ordered by global_sequence == projection; 2 concurrent writes never collide on sequence; cross-tenant SELECT returns 0 rows under RLS; duplicate idempotency key applies once |
| 1 | Identity & Access: auth + sessions + roles (extend `usersTable`/memberships); replace header actor-context; **Access log (B)**; super-admin + impersonation→AccessEvent | 0 | no route resolves identity from headers; every cross-tenant/impersonation/sensitive-read writes an AccessEvent; employee cannot read another employee |
| 2 | Company model: extend `organizations` (jurisdiction, modules, currency, configs) | 1 | company carries jurisdiction + currency; modules toggle on/off |
| 3 | Snapshot engine: sequence-based, encrypted, `schema_version`, workflow-bound | 0,2 | same (entity, cutoff_seq) → identical hash; blob encrypted at rest; recompute from events == stored blob |
| 4 | Workflow engine: states + failure/compensation; correlation | 0 | failed workflow ⇒ its snapshots are invalid; illegal transition rejected |
| 5 | Domain entities (event-emitting): Position, Employee (state machine), PositionAssignment; Employee↔User invite/activate/deactivate | 0,1,4 | max 1 active employee/position; org history reconstructs from events; employee status transitions enforced; exited = read-only |
| 6 | Leave | 4,5 | only Approved leave ≤ cutoff_seq affects a payroll snapshot |
| 7 | Employee self-service | 1,5 | employee sees only own records; can edit bank, cannot see salary policy of others |
| 8 | Payroll engine: core pipeline + proration + leave precedence; `compute(snapshot, module)` | 3,5,6,7 | mid-cycle joiner/exit prorated correctly; no floats; re-run with same cutoff_seq ⇒ identical snapshot hash |
| 9 | Documents + template engine (snapshot-only vars) | 3,5 | template referencing a live lookup is rejected; issued doc bound to its snapshot |
| 10 | Policies + acknowledgements | 5 | versioned ack recorded as event; ack of old version distinct from new |
| 11 | Offboarding | 4,5 | exit produces a completed workflow + snapshot; employee→Exited→read-only |
| 12 | Viewers: Audit (event projection), Workflow, Access-log | all | audit view == replay of events; access-log view shows impersonation entries |
| 13 | UAE module: formula/templates/validation only (EOSG indicative) | 8,9 | swapping module changes calc/templates only; core schema untouched |

---

## 9. Open Questions for the human (DECIDE before/with the build — do not guess)

1. **Relationship to the current product.** This branches off `cleanup/ui-spine` (the cleaned
   org-visibility app). Does the HR kernel **replace** that product, or live as a separate line?
   What happens to the pending `main` convergence and the org-visibility "Founder Dependency
   Report / Actions / Policies" surfaces — carried forward or dropped?
2. **Auth mechanism** (Phase 1): password, magic-link, or OIDC/SSO? Determines the whole Access Layer.
3. **Currency**: one currency per company, or multi-currency? Any cross-company provider/billing currency?
4. **Encryption mechanism** (snapshots): app-layer envelope encryption via a KMS, or Postgres pgcrypto?
   Where do keys live, and who can rotate/shred?
5. **Hosting / data residency**: where does this deploy (the earlier Neon discussion), and are there
   UAE PII data-residency requirements that constrain hosting?
6. **`auditEventsTable` disposition**: remove it (per decision #3) or repurpose it as the Access log (B)?
7. **Super-admin identity**: is the provider a single account, or a team with its own roles/audit?
8. **Migration of existing org data**: is there real data in the current org-visibility system to
   migrate into Company/Employee, or does the HR kernel start clean?

---

## 10. Hard rules for the executor
- Spec-faithful: build exactly §1–§8; anything missing → §9, then stop.
- Every domain mutation goes through an event; every external output goes through a snapshot.
- No floats; no timestamp-ordering; no cross-tenant query without an AccessEvent.
- One phase at a time; its acceptance gate green before the next. App builds + runs after each phase.
- Create no governance/certification ceremony. Lightweight gates only.
