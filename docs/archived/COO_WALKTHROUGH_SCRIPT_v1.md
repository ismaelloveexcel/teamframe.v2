# TeamFrame COO Walkthrough Script (Gate 4)

This walkthrough is the deterministic validation artifact for TeamFrame V1.
Run it after pressing **Administration → Reset Deterministic Demo**.

## 1) Org view (structure baseline)

1. Open **Org Map**.
2. Confirm three teams render: `Executive`, `Engineering`, `Operations`.
3. Confirm reporting chain is visible from CEO down to specialist/engineer positions.

Expected result:
- Org structure renders without missing cards or blank sections.

## 2) Structure inspection (position clarity)

1. In **Org Map**, inspect position cards.
2. Verify each card includes:
   - Team
   - Status
   - Occupant(s) or `Vacant`
   - Owner label

Expected result:
- Every position card is legible and has deterministic content.

## 3) Ownership clarity (accountability)

1. Open **Team**.
2. Confirm ownership is visible for Engineering and Operations teams.
3. Confirm position ownership records exist for:
   - Engineering Manager
   - Operations Specialist

Expected result:
- Ownership is persisted and queryable after reload.

## 4) Action urgency visibility (operational pressure)

1. Open **Actions**.
2. Verify KPI strip values are present for:
   - Overdue actions
   - Blocked actions
3. Confirm blocked actions exist in the list.

Expected result:
- Urgency is visible in less than 5 seconds from page load.

## 5) Policy context mapping (governance)

1. Open **Policies**.
2. Confirm policy set includes:
   - Organization policy
   - Team-scoped policy (Engineering)
   - Position-scoped policy (Operations Specialist)

Expected result:
- Scope context is explicit and maps to real structure entities.

## 6) Failure-path verification

1. Open **Administration**.
2. Click **Run Invalid-Org Recovery Check**.
3. Wait for recovery message and confirm app remains usable.

Expected result:
- Invalid org context does not leave the UI in a broken state.
- App automatically recovers and reloads a valid organization context.

