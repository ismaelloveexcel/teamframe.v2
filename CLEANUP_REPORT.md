# Cleanup Report — Collapse to Product Spine

One-time cleanup. Branch: `cleanup/product-spine` (cut from `cursor/phase4-stabilization-closure-sequence-df31`).

## Did the app run — before / after

| | Command | Result |
|---|---|---|
| Before | `pnpm run build` (typecheck + build all) | PASS |
| After | `pnpm run build` | PASS |
| After | API server `node dist/index.mjs` → `GET /api/healthz` | `{"status":"ok"}`, "Server listening port 5000" |
| After | frontend `vite build` + `vite preview` | built OK, HTTP 200 |
| After | `test:phase-core` (kept domain unit tests) | 20 pass / 0 fail |

The product builds and runs unchanged. No product code (routes, domain, db, frontend, lib) was modified except removing dead `test:*` script entries.

## Lines: before → after

**54,948 → 39,188** tracked lines (excluding `pnpm-lock.yaml`). **Net −15,760.** 155 files removed, ~15,793 lines deleted. Net is DOWN.

## What was deleted (and why)

Every deletion was grounded in a file read + a usage check. None of the removed files are imported by the running server (`index.ts → app.ts`) or the frontend; verified by grep across `routes/`, `domain/`, `app.ts`, `mockup-sandbox/src`, and `lib/`.

### 1. Certification / stability / phase audit *output* (whole directories)
Pure JSON/MD artifacts written by audit harnesses. Not code, not imported, not needed to run/build/deploy.

| Path | Reason |
|---|---|
| `artifacts/execution/` | phase-5 plans, `branch-integrity-model.md`, `release-ledger.json` — branch-contract + phase ceremony |
| `artifacts/phase-execution/` | per-phase audit/engineer/review/test reports + "certified-v1" baselines |
| `artifacts/phase4-independent-verification/` | determinism/replay/repair audit JSON |
| `artifacts/phase4-stabilization/` | stabilization audit JSON + summary |
| `artifacts/phase4-validation/` | concurrency/idempotency/replay audit JSON |
| `artifacts/stability/` | replay-divergence maps, certification + ratification artifacts |
| `artifacts/system-certification-audit/` | sections A–H + `system-certification-result.json` (the "cert gate" output) |
| `artifacts/system-stability-audit/` | root-cause / mutation-path / replay-diff reports |
| `artifacts/ui/` | `ux-checklist.json`, `funnel-events.json`, `audit-result.json` per flow — UX ceremony |

### 2. Certification / stability harness scripts (`artifacts/api-server/src/`, 12 files)
Standalone `tsx` scripts run only via `test:*` package scripts. Not imported by `app.ts`/`index.ts`; `build.mjs` bundles only `src/index.ts`.

`founder-flow-certification.ts`, `phase3-certification.ts`, `phase4-certification.ts`, `phase4-determinism-validation.ts`, `phase4-independent-verification.ts`, `phase4-stabilization.ts`, `stability-closure1-replay.ts`, `stability-closure3-repair-cert.ts`, `stability-closure4-malformed-cert.ts`, `system-certification-audit.ts`, `system-stability-audit.ts`, `determinism-enforcement.test.ts`

…and their 12 `test:*` entries removed from `artifacts/api-server/package.json` (kept: `dev`, `build`, `start`, `typecheck`, `test:phase-core`).

### 3. Governance / process docs (`docs/`, 6 files)
| Path | Reason |
|---|---|
| `docs/DECISION_LOG.md` | decision-log scar tissue (named in mission) |
| `docs/ASSUMPTIONS.md` | assumptions scar tissue (named in mission) |
| `docs/PRODUCT_REALITY.md` | governance product-thesis doc; product definition now lives outside the repo |
| `docs/VALIDATION_MATRIX.md` | roadmap-control governance |
| `docs/handover/PHASE-0-STABILIZATION.md` | phase handover spec (created earlier today — removed without special pleading) |
| `docs/go-to-market/repo-audit-prompt.md` | audit-process prompt |

## KEPT (proven load-bearing, do not mistake for ceremony)

- `artifacts/api-server/src/domain/migration/phase0*` — **product** code (exported from `domain/index.ts`), despite the "phase" name.
- `artifacts/api-server/src/domain/**/__tests__/*.test.ts` — ordinary unit tests of the engine (phase0, command-processor, phase2/phase3 aggregates). Kept as QA, run by `test:phase-core`. Not a governance/branch gate.
- `lib/*` (`db`, `api-spec`, `api-zod`, `api-client-react`), `scripts/` (`post-merge.sh` = install + db push), `.replit`, `replit.md` — run/build/deploy infrastructure.

## UNKNOWN — needs your decision (not deleted)

1. **UI scope-creep (Step 3) — flagged, NOT removed.** The nav surface in `mockup-sandbox/.../TeamFrame.tsx` (a single ~3,900-line file) includes sections beyond the 5-item spine: **Hiring** (HR-flavoured), the position-panel **Evidence/Documents** tab (compliance-flavoured), **Templates**, **Administration**. Excising these from the monolith is non-trivial and risks breaking the running app, which would violate "app must still run." Recommend a separate, careful follow-up (app running, one section at a time, verify each). I did not guess-and-cut.
2. **GTM / sales material** (not code governance): `docs/COO_WALKTHROUGH_SCRIPT.md`, `docs/pilot/*` (OFFER_TIERS, ONBOARDING_RUNBOOK, PILOT_PROPOSAL_TEMPLATE, VALIDATION_SCORECARD). Business docs, harmless, kept. Delete if you don't want them in-repo.
3. **Root leftovers**: `attached_assets/`, `screenshots/` — not referenced by product code. Kept (assets, not scar tissue). Your call.
4. **`replit.md`** still has template placeholders; it's the natural home for a one-line product description. Left untouched to avoid creating governance.

## Step 4 — Converge to one truth (commands for YOU to run; NOT executed)

**(a) Make this branch the new `main`** (main is an 8-commit scaffold; this rewrites it to the working product):
```bash
git push -u origin cleanup/product-spine
# Replace main with the cleaned product:
git checkout main
git reset --hard cleanup/product-spine
git push --force-with-lease origin main
```
*(Alternative if you prefer a PR trail: open a PR `cleanup/product-spine → main` and merge it, instead of the reset/force-push.)*

**(b) Close the superseded PRs** (#1, #2, #3, #5 — stale re-attempts; #4 is the draft for the source branch, also superseded once main = product). Close via the GitHub UI as "superseded by cleanup → main", or tell me to close them via the GitHub integration.

## Stop

Definition of Done met: app runs after, report exists, net lines down, zero new governance/tooling files created (only this report), no immutability/certification/phase ceremony left in the running product. Awaiting your go for Step 4.
