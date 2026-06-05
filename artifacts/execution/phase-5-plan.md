# Phase 5 Execution Plan (Locked)

**Created:** 2026-06-05  
**Status:** ACTIVE — DO NOT MODIFY OBJECTIVES

---

## A. Locked Objectives (immutable)

1. System stability is preserved — `test:system-certification-audit = PASS` always
2. Increase conversion clarity on 3 defined revenue flows
3. Reduce user comprehension time to under 5 seconds on every key screen
4. Raise UI/UX quality from below-average to premium
5. Instrument funnel events end-to-end on all 3 flows

---

## B. Scope Boundary (hard enforcement)

### IN SCOPE
- UI/UX redesign of top 3 revenue flows (Flow 1, 2, 3)
- Funnel event instrumentation (client-side)
- Design system adoption — use Tailwind + shadcn + Lucide already installed
- Loading/empty/error state quality

### OUT OF SCOPE
- Backend changes (unless directly blocking a UI render)
- New domain logic
- Event system modifications
- Certification logic changes
- Any refactor not targeting the active closure screen

---

## C. Active Closure

**Closure 1 — Flow #1: Onboarding → First Value Moment**

- Target file: `artifacts/mockup-sandbox/src/components/mockups/teamframe/TeamFrame.tsx`
- New files: `AppShell.tsx`, `LoadingScreen.tsx`, `EmptyOrgGuide.tsx`, `OrgReadyBanner.tsx`
- Target screens: loading state, empty org state, first position added
- Success criteria: see Section D

---

## D. Exit Criteria (binary — ALL must be true)

A closure is COMPLETE only when:

| Check | Required |
|---|---|
| `test:system-certification-audit` | PASS |
| UX checklist (`artifacts/ui/flow-1/ux-checklist.json`) | All true |
| Funnel events defined (`artifacts/ui/flow-1/funnel-events.json`) | Present |
| Loading screen communicates value in <5s | true |
| Empty state has one clear primary CTA | true |
| First-value moment is visually confirmed | true |
| No regressions in stability artifacts | true |

---

## E. Backlog (do not execute, log only)

- Flow #2: Core Operating Loop (position → assignment → evidence interaction)
- Flow #3: Value Confirmation / Retention Loop
- CI gate on cert harness
- `artifacts/stability/weekly-stability-report.json` automation
- Funnel metrics backend integration
- Pricing/upgrade hooks

---

## F. Anti-Drift Rules (enforced)

1. One active closure at a time
2. No scope expansion during active closure — log to backlog only
3. Every "done" requires: command executed + artifact path + hash/output
4. `test:system-certification-audit` is read-only and cannot be bypassed
5. Delta-only development — only modify target components

---

## G. Agent Roles

| Role | Mode | Task |
|---|---|---|
| Explorer | read-only | maps flows, identifies bottlenecks |
| Builder | mutating | implements one closure only |
| Auditor | read-only | runs UX checklist + cert gate |
