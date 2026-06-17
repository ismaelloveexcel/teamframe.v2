# TeamFrame V1 — Retirement Reference

The original TeamFrame V1 frontend and its toolchain were retired on 2026-06-17
when the repository was consolidated around the HR v2 product.

## What Was Retired

| Artifact | Path |
|---|---|
| V1 React frontend | `artifacts/mockup-sandbox/` |
| Generated API client | `lib/api-client-react/` |
| OpenAPI spec + Orval codegen | `lib/api-spec/` |

## Final Branch References

| Branch | Final Commit | Description |
|---|---|---|
| `release/certified-v1` | `befd75b` | Production pointer for v1 certified release |
| `cursor/phase4-stabilization-closure-sequence-df31` | `3f1cab9` | Most advanced v1 cursor agent branch |
| `cursor/ux-excellence-sprint-df31` | `a15ffc4` | Phase 4 determinism validation |
| `cursor/system-introspection-harvest-e034` | `e2b3cd6` | Ground-truth feature extraction |
| `cursor/employee-centric-hr-platform-df31` | `a457946` | Org-first operational graph |
| `cursor/dev-environment-setup-04de` | `877b88b` | Dev environment setup docs |

## What V1 Was

A deterministic UI simulation engine for organisational risk intelligence.
Architecture: React 19 + Vite (mockup-sandbox) + Express API + Drizzle ORM +
event-sourced domain (CQRS, outbox, projections, replay, quarantine).

The frontend was a pure in-memory simulation: `UI = computeUIState(SEED, controlState)`.
State reset on page refresh. No persistent writes from the UI layer.

## Why Retired

V1 was superseded by TeamFrame V2 — a real multi-tenant HR SaaS with:
- Postgres RLS-enforced tenant isolation
- Persistent CRUD across 9 HR modules
- Full React frontend wired to a live API (`artifacts/hr-web`)
- CI-verified via 18-gate suite on every push

## Tier 3 Note (not yet retired)

The V1 backend routes (`/api/organizations`, `/api/ops`) and their supporting
services (event store, replay, quarantine, CQRS domain code) remain dormant in
`artifacts/api-server` and `lib/db/schema`. They are mounted but unreachable from
the HR frontend. Scheduled for retirement after first pilot cohort (see repo issues).
