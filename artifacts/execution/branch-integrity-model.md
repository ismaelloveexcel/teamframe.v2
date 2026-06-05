# Branch-to-Production Integrity Model

**Established:** 2026-06-05  
**Trigger:** Introspection against wrong branch revealed deployment coherence gap.

---

## Problem statement

At any point in this project there are **two different truths**:

| Branch | What it contains |
|---|---|
| `main` | Minimal scaffold. Safe reset point. Does not reflect system capability. |
| `cursor/phase4-stabilization-closure-sequence-df31` | Full event-sourced platform. Certified A–H. Phase 5 complete. |

An introspection tool that measures `main` will conclude the system is empty. This is correct within its input graph and wrong globally. That mismatch is a deployment coherence failure — not a code failure.

---

## The three-branch contract

```
main                     — scaffold, never deployed directly
  │
  └── cursor/<feature>   — development, active work, certification target
        │
        └── release/certified-v1  — production pointer, immutable after each release
```

### Rules for each branch

**`main`**
- Accepts only: PRs from `release/certified-v1` (post-release merges)
- Does NOT receive: direct feature pushes
- Does NOT receive: CI hotfixes
- Is NOT the deployment source

**`cursor/<feature>` branches**
- All development work happens here
- Certification harness must pass before any merge
- `test:system-certification-audit = PASS` is a required gate

**`release/certified-v1`**
- Immutable after creation — no direct commits
- Receives merges ONLY when certification passes on the source branch
- Is the **single deployment source of truth**
- Is what CI/CD deploys
- Git tag on every promotion: `teamframe-stable-core-v1`, `teamframe-phase5-certified-v1`, etc.

---

## Certification gate (enforced before any release promotion)

All of the following must be true before a commit moves from `cursor/*` to `release/certified-v1`:

```
□ pnpm --filter @workspace/api-server test:system-certification-audit = PASS
□ A–H sections all true
□ replayMismatchedOrgs = 0
□ globalMismatchedOrgs = 0
□ repairFailures = 0
□ outboxDivergences = 0
□ projectorCrashes = 0
□ pnpm --filter @workspace/mockup-sandbox typecheck = PASS (0 errors)
□ design-system-compliance.json gates all pass
```

No narrative claim ("it passed in the previous session") substitutes for a live harness run on the commit being promoted.

---

## Release promotion procedure

```bash
# 1. On development branch, run harness
DATABASE_URL=... pnpm --filter @workspace/api-server test:system-certification-audit

# 2. If PASS, update release branch
git checkout release/certified-v1
git merge --no-ff cursor/<feature> -m "Release: <version>"

# 3. Tag the release
git tag -a teamframe-<version> -m "<version description>"
git push origin release/certified-v1 --tags

# 4. Update artifacts/execution/release-ledger.json
```

---

## What prevents the mismatch from recurring

| Risk | Mitigation |
|---|---|
| Introspection / CI runs against wrong branch | `release/certified-v1` is the explicitly named deployment source. Any tooling must target this branch by name. |
| Feature branch diverges from release without notice | Certification gate required on every promotion. Gap is always measurable. |
| Main silently diverges | Main only receives release merges. Its state is always a known subset of a certified release. |
| New agent starts on main, builds on empty scaffold | README (see below) names `release/certified-v1` as the development base. |

---

## Release ledger

Track every promotion in `artifacts/execution/release-ledger.json`.

```json
{
  "releases": [
    {
      "tag": "teamframe-stable-core-v1",
      "branch": "cursor/phase4-stabilization-closure-sequence-df31",
      "certifiedAt": "2026-06-05",
      "sections": { "A": true, "B": true, "C": true, "D": true, "E": true, "F": true, "G": true, "H": true },
      "harnessHash": "e3d81881b739a1a0ddfd0fb172966ab38e8c568a62eea646ea01accd1348d4ab"
    },
    {
      "tag": "teamframe-phase5-certified-v1",
      "branch": "cursor/phase4-stabilization-closure-sequence-df31",
      "certifiedAt": "2026-06-05",
      "sections": { "A": true, "B": true, "C": true, "D": true, "E": true, "F": true, "G": true, "H": true },
      "harnessHash": "e3d81881b739a1a0ddfd0fb172966ab38e8c568a62eea646ea01accd1348d4ab",
      "additionalGates": {
        "frontendTypecheck": "PASS",
        "designSystemCompliance": "PASS",
        "fontSizes": 5,
        "radiusValues": 4,
        "focusCoverage": "100%"
      }
    }
  ]
}
```

---

## Deployment environment requirements

When deploying from `release/certified-v1`:

```bash
# API server
DATABASE_URL=postgresql://<user>:<pass>@<host>/<db>

# Frontend
VITE_API_BASE_URL=https://<api-host>
```

Without `DATABASE_URL`: API server exits at startup.  
Without `VITE_API_BASE_URL`: TeamFrame falls back to local demo mode (read-only, no persistence).

Both must be present for the full connected system to operate.

---

## Summary

The introspection was not wrong. It found an empty system on the branch it measured.  
The correct response is not to dispute it — it is to ensure the introspection always measures the right branch.

`release/certified-v1` is that branch. It is pushed. It contains the full certified platform.
