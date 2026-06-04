# TeamFrame Pilot Onboarding Runbook

Purpose: run every pilot onboarding the same way, with no improvisation.

Execution principle:
> You are not selling software. You are testing whether the organization becomes legible through the system.

## Session setup (before call, 3 minutes)

- Confirm operator has admin access.
- Open TeamFrame and go to `Administration`.
- Click **Reset Deterministic Demo** to start from a clean baseline.
- Start a timer for the onboarding session.

---

## Step 1 — Org Initialization (5-10 min)

Operator actions:
1. Create organization workspace for the pilot company.
2. Build top-level structure in Org Map:
   - CEO position
   - departments
   - teams under each department
3. Validate org map completeness:
   - no duplicate teams
   - no missing core department
   - all top-level reporting lines mapped

Completion check:
- [ ] Org exists
- [ ] CEO to department to team structure is visible
- [ ] Operator confirms map is complete enough for pilot use

Failure rule:
- If structure is unclear after 10 minutes, stop and request a corrected org list before continuing.

---

## Step 2 — Ownership Mapping (critical moment)

Operator actions:
1. In Team view, assign owner for each active team.
2. Assign owner for key positions (at minimum: CEO, department heads, operational manager roles).
3. Scan for orphan responsibility nodes.

Completion check:
- [ ] Team ownership assigned for all active teams
- [ ] Position ownership assigned for all key positions
- [ ] Zero orphan responsibility nodes

Failure rule:
- If ownership is disputed, mark node as unresolved and continue. Do not invent owner assignments.

---

## Step 3 — Action Seeding (execution layer)

Operator actions:
1. Create 5-10 real actions from current operating priorities.
2. Enforce hard constraints on every action:
   - owner assigned
   - structural link attached (team, position, or person)
3. Ensure at least 2 actions are urgent/overdue simulated.

Completion check:
- [ ] Minimum 5 actions created
- [ ] 100% actions have owners
- [ ] 100% actions linked to structure
- [ ] >=2 actions are urgent/overdue simulated

Failure rule:
- Reject any free-floating action with no structural link.

---

## Step 4 — Policy Attachment (context layer)

Operator actions:
1. Add 2-3 operational policies.
2. Attach policy scopes explicitly:
   - organization OR
   - team OR
   - position
3. Verify each policy has visible applicability in the UI.

Completion check:
- [ ] 2-3 policies attached
- [ ] Every policy has explicit scope
- [ ] Users can identify where each policy applies

Failure rule:
- If scope is ambiguous, do not publish policy. Resolve scope first.

---

## Step 5 — COO Clarity Test (final validation)

Ask only these four questions:
1. How is the org structured?
2. Who owns what?
3. What needs attention now?
4. What rules apply where?

Success condition:
- Pilot passes if stakeholder answers all 4 questions in under 5 minutes using TeamFrame only.

Completion check:
- [ ] Q1 answered
- [ ] Q2 answered
- [ ] Q3 answered
- [ ] Q4 answered
- [ ] Total answer time <5 minutes

---

## End-of-session outputs (required)

- Fill `VALIDATION_SCORECARD.md` for this session.
- Capture max 3 friction points only.
- Record conversion likelihood: low / medium / high.
- Schedule next step (close-lost, continue pilot, or conversion proposal).
