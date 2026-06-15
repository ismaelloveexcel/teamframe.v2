# Handover: Stabilization Sprint — Execution Spec for Sonnet

**Audience:** the executing agent (Sonnet 4.6).
**Author/Orchestrator:** Opus 4.8 (reviews every diff before any merge).
**Human owner:** approves merges; sets priorities.

---

## 0. Mission & scope for TODAY

> **Today's single goal: make the baseline GREEN.** Nothing else ships today.

"Green baseline" = the codebase's own gates all pass, with **no false-greens**.
Feature work (Phases 1–7, below) is **roadmap context only** — do **not** start it
today. Today is **Phase 0** and Phase 0 only.

This is deliberately small. If Phase 0 looks like it's growing beyond one focused
commit, **stop and escalate to the orchestrator** — that is a signal something is
wrong, not a reason to push harder.

---

## 1. Operating rules (read before touching anything)

These exist to prevent loops. They are not optional.

1. **No merges.** You produce commits on the working branch and push. The
   orchestrator (Opus) reviews the diff. The human owner merges. You never merge.
2. **Two-strike rule.** If the *same* gate fails twice in a row after your fix
   attempts, **STOP**. Do not try a third variation. Write up what you tried, the
   exact error, and your hypothesis, then hand back to the orchestrator.
3. **Never weaken the proof to get green.** Do **not**:
   - delete or `.skip` a test,
   - relax an assertion to make it pass,
   - relax or remove the `isUuid()` guards in `assignment.ts` / `compensation.ts`
     (production correctness depends on them — see §4),
   - change production code to accommodate a stale test.
   If a test seems wrong, escalate; don't "fix" it by lowering the bar.
4. **One concern per commit.** Phase 0 is one commit. Message describes *what and
   why*, not "fix tests".
5. **Always run the FULL gate (§3) before declaring done.** A partial run is not
   a pass. Do not report success off `typecheck` alone.
6. **Stay additive.** Do not refactor `TeamFrame.tsx` (3,919-line monolith) or any
   working flow. Phase 0 touches test files only (see §4).
7. **Branch:** work on `cursor/phase4-stabilization-closure-sequence-df31`
   (the active branch). Do **not** create or switch branches without orchestrator
   sign-off. Push with `git push -u origin <branch>`.

**Escalation format** (when you stop): _what I changed → exact command run → exact
error/diff → my hypothesis → what I need decided._

---

## 2. Environment setup — the database IS available (do this first)

The earlier audit/plan claimed "DB-backed certification can't run: no
DATABASE_URL." **That is false in this environment.** A local Postgres 16 is
present. The DB-backed certification gate (`test:system-certification-audit`)
**already passes** today. Bring the DB up before running gates:

```bash
# 1. Start local Postgres (idempotent; ignore "another server might be running")
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/tf_pg \
  -o '-p 5433 -k /tmp' -l /tmp/tf_pg.log start"
sleep 3

# 2. Sanity check it accepts connections
su postgres -c "/usr/lib/postgresql/16/bin/psql -p 5433 -h /tmp -d postgres -c 'select 1;'"

# 3. Export the connection string used by all gates
export DATABASE_URL="postgresql://postgres@localhost:5433/teamframe?host=/tmp"

# 4. (Only if schema is missing/changed) push schema to the teamframe DB
DATABASE_URL="$DATABASE_URL" pnpm --filter @workspace/db run push-force
```

Notes / gotchas (observed this session):
- Postgres can stop when the container idles. If a gate errors with
  *"connection ... refused"* or *"Is the server running"*, re-run step 1, then retry.
- `DROP DATABASE` cannot run inside a transaction — if you ever need a throwaway
  DB, run `DROP` and `CREATE` as **separate** `psql -c` calls.
- Do not point gates at a throwaway DB and forget to drop it; the canonical DB is
  `teamframe`.

---

## 3. The pinned green-gate (the definition of "done")

Run **all four**, in order, with the DB up and `DATABASE_URL` exported. This exact
set is the gate for Phase 0 **and** for every future slice. Do not invent variants.

```bash
# Gate 1 — types across all workspace projects
pnpm run typecheck

# Gate 2 — domain unit gates (MUST be 20/20, zero fail)
pnpm --filter @workspace/api-server run test:phase-core

# Gate 3 — DB-backed system certification (MUST print: PASS)
DATABASE_URL="$DATABASE_URL" \
  pnpm --filter @workspace/api-server run test:system-certification-audit

# Gate 4 — frontend build (catches UI/codegen breakage)
pnpm --filter @workspace/mockup-sandbox run build
```

**Pass criteria:**
- Gate 1: exit 0, no errors.
- Gate 2: `# pass 20`, `# fail 0`.
- Gate 3: stdout contains `System certification audit result: PASS`.
- Gate 4: `✓ built`.

If any gate is red, the slice is **not done**. See §1 rule 2 before iterating.

---

## 4. PHASE 0 — the actual work for today

### 4.1 Current state (verified)

- `pnpm run typecheck` → **green**.
- `test:system-certification-audit` (DB-backed) → **PASS**.
- `test:phase-core` → **13 pass / 7 fail**. These 7 are the only thing standing
  between us and a fully green baseline:

```
not ok 2  Phase 2 gate: no position can have more than one active assignment
not ok 3  Phase 2 gate: transfer emits end+start and keeps occupancy deterministic
not ok 4  Phase 2 gate: employee overlap invariant rejects concurrent active seats
not ok 7  Phase 3 gate: replay determinism remains stable across event ordering
not ok 8  Phase 3 gate: profile evolution preserves historical replay
not ok 9  Phase 3 gate: document lifecycle transitions derive non-compliant states
not ok 10 Phase 3 gate: compensation audit trail is reconstructable and append-only
```

### 4.2 Root cause (verified — do not re-investigate from scratch)

The production derivations were hardened with an `isUuid()` guard that **silently
drops** any event whose ids are not RFC-4122 UUIDs:

- `artifacts/api-server/src/domain/aggregates/assignment.ts:45` (and `:66`)
- `artifacts/api-server/src/domain/aggregates/compensation.ts:41-43`

The guard regex (both files, identical):

```
/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
```

➡ Fixtures **must** be real UUIDs: version nibble `1–5`, variant nibble `8/9/a/b`.
`crypto.randomUUID()` (v4) satisfies this. Arbitrary strings like `"asg-1"`,
`"position-1"`, `"person-1"`, `"pos-a"`, `"doc-1"`, `"cmp-1"` do **not** — they get
dropped, derivations return empty, and the invariant assertions never fire → fail.

The fix is to **the test fixtures**, not production code. Production is correct;
production uses real UUIDs. This is stale-test-vs-hardened-code drift.

### 4.3 ⚠ The false-green trap (critical — do not miss this)

In `phase2-domain.test.ts`, **two tests currently PASS while testing nothing**:

- `:183` `Phase 2 gate: replay determinism holds for tie-order inputs`
- `:229` `Phase 2 gate: replay ordering remains deterministic`

They use non-UUID ids too, so both derivations return `[]`, and their only
assertion — `assert.deepEqual(resultA, resultB)` — is `deepEqual([], [])` → **true**.
They are false-greens. If you fix only the 7 red tests, these remain hollow.

**Therefore the fix must cover every fixture in both files, and every
derivation-backed assertion must be preceded by a non-empty guard** so an empty
derivation can never masquerade as a pass again.

### 4.4 Files in scope (ONLY these)

- `artifacts/api-server/src/domain/aggregates/__tests__/phase2-domain.test.ts`
- `artifacts/api-server/src/domain/aggregates/__tests__/phase3-domain.test.ts`
- (new) `artifacts/api-server/src/domain/aggregates/__tests__/uuid-fixture.ts`

Do **not** touch production `aggregates/*.ts`. If you believe production needs to
change, that is an escalation, not a Phase 0 edit.

### 4.5 Fix recipe

**Step 1 — add a deterministic label→UUID helper** so fixtures keep referential
integrity (the same label always maps to the same UUID, so a document's
`assignmentId` still matches its assignment) *and* satisfy the guard:

```ts
// artifacts/api-server/src/domain/aggregates/__tests__/uuid-fixture.ts
import { createHash } from "node:crypto";

/**
 * Deterministic RFC-4122 v4-shaped UUID derived from a stable label.
 * Same label -> same UUID, so cross-referenced fixtures stay linked while
 * satisfying the isUuid() guard in assignment.ts / compensation.ts.
 */
export function uid(label: string): string {
  const h = createHash("sha256").update(label).digest("hex");
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    `4${h.slice(13, 16)}`,            // version 4
    `${variant}${h.slice(17, 20)}`,   // variant 8/9/a/b
    h.slice(20, 32),
  ].join("-");
}
```

**Step 2 — replace every non-UUID fixture id** in both test files with
`uid("<old-label>")`, preserving the labels so links hold. Replace the *values*,
not the payload keys. Examples:

```ts
// before
aggregateId: "asg-1",
payload: { assignmentId: "asg-1", positionId: "position-1", employeeId: "person-1", ... }
// after
aggregateId: uid("asg-1"),
payload: { assignmentId: uid("asg-1"), positionId: uid("position-1"), employeeId: uid("person-1"), ... }
```

Apply to all ids that flow through the guarded derivations: `assignmentId`,
`positionId`/`pos-*`, `employeeId`/`person-*`/`emp-*`, `compensationRecordId`/`cmp-*`,
`sourceDocumentId`/`doc-*`, and the matching `aggregateId` fields. (`orgId`,
`actorId`, `idempotencyKey` are not guarded — leave them, or convert for
consistency; either is fine as long as gates pass.)

> Position-*graph* ids in the reparent test (`"ceo"`, `"ops-head"`, …) go through
> `buildPositionGraph`, **not** `isUuid`, so that test already passes — you may
> leave those as-is.

**Step 3 — add non-empty guards** so no test can pass on an empty derivation.
Before each assertion that reads a derived array/map, assert it is populated:

```ts
const replayed = deriveAssignments(events);
assert.ok(replayed.length > 0, "derivation dropped all events — check fixture UUIDs");
// ...existing assertions...
```

For the two false-green tests (§4.3), add this guard explicitly so they now prove
the derivation actually produced rows before comparing determinism.

**Step 4 — run the full gate (§3).** Expect `test:phase-core` → `# pass 20 / # fail 0`.

### 4.6 Definition of done for Phase 0

- [ ] `test:phase-core` → **20/20**, no skips.
- [ ] Both false-green tests now assert non-empty derivations.
- [ ] `typecheck`, `test:system-certification-audit` (PASS), and frontend build all green (§3).
- [ ] No production `aggregates/*.ts` changed; guards untouched.
- [ ] One commit, pushed, **not merged**. Orchestrator review requested.

Suggested commit message:

```
Fix stale non-UUID fixtures in phase2/phase3 domain gates

The isUuid() guards in deriveAssignments/compensation silently drop
non-UUID ids, so fixtures using "asg-1"/"pos-1" derived to empty and the
invariant assertions never fired. Replace fixtures with deterministic
v4 UUIDs via a uid() helper that preserves referential links, and add
non-empty guards so an empty derivation can no longer pass (closes two
prior false-greens that compared deepEqual([], [])).
```

---

## 5. Roadmap AFTER today (context only — do NOT execute now)

Recorded so you understand where Phase 0 leads. Each phase is an independent,
green-gated slice; each ends with the §3 gate and an orchestrator diff review
before merge. **Dependency edges are mandatory ordering — do not start a phase
before its prerequisites are merged.**

| Phase | Deliverable | Depends on | Risk | Notes |
|---|---|---|---|---|
| **0** | Green baseline (this doc) | — | low | TODAY |
| 1 | Complete people record: employment type, bank, tax ref, national ID, emergency contact | 0 | low | **First confirm people's persistence model** — if people are projected-from-events (not plain CRUD), new fields touch event payloads → replay impact. Verify before coding. |
| 2a | Route `CompensationService` (+ OpenAPI + regen client + UI wiring) | 0 | low-med | Follow `routes/organizations.ts` pattern |
| 2b | Route `EvidenceService`/documents (+ spec + client + UI) | 0 | low-med | Independent slice |
| 2c | Route `OffboardingService` (+ spec + client + UI) | 0 | low-med | Independent slice |
| 3 | Real payroll export: salary, bank, tax, employment type, pay frequency | 1, 2a | low | Extend `downloadPayrollCsv` |
| 4 | Persisted compliance: rewire UI gaps to evidence projections; add contract + emergency-contact checks | 1, 2b | **medium** | Touches determinism — orchestrator reviews closely |
| 5 | Offboarding exit report (join date, last day, role history) | 2c | low-med | Compose from existing person+assignment data |
| 6 | Leave recording (employee, type, start/end, note) + per-employee history | 0 | **medium, isolated** | Model as **plain CRUD, NOT event-sourced** — keeps it off the replay machinery |
| 7 | Surface already-computed gaps on-screen (single-person teams, coverage, unrouted/overdue) | 0 | low | Area-7 quick wins; no new data |

**Why 2a/2b/2c are split:** each routed service = spec + regenerated client + UI
wiring (3 coordinated edits). Splitting keeps every slice independently green,
per the small-slice method.

**Highest-leverage risk call (already decided):** new net-new entities (esp.
leave, Phase 6) are **plain CRUD, not event-sourced**. The event-sourcing /
replay-determinism machinery is exactly what the Phase 0 tests guard; keep simple
entities off it.

---

## 6. How the three roles interlock

- **Sonnet (you):** execute one slice → run full gate (§3) → push (not merge) →
  request orchestrator review. Obey the two-strike rule; escalate rather than loop.
- **Orchestrator (Opus):** reviews each pushed diff before merge; keeps sequencing
  honest; breaks ties; owns "are we stuck?" judgement.
- **Human owner:** approves merges; sets priorities; runs separate research on the
  2–3 day polish/upgrades track (out of scope here).

**Today's exit condition:** Phase 0 committed, pushed, gates green, awaiting
orchestrator review. Then stop. Do not roll into Phase 1.
