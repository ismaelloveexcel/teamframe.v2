# Phase 5.4 — Design System Consolidation & Premium Polish

**Created:** 2026-06-05  
**Status:** ACTIVE — succeeds Flow #3 completion  
**Evidence base:** `artifacts/ui/phase-5-4/design-system-audit.json`

---

## Why this phase exists

Flows #1–#3 proved the interaction model. What remains is visual entropy:
- 10 distinct font sizes with no shared scale
- 11 distinct border-radius values across 7 files
- 3 different primary button implementations, 0 shared
- Tailwind + CSS tokens installed in `index.css`, used by 0 components
- 0 keyboard focus states across all interactive elements
- Competing page backgrounds (#F1F5F9 vs #EEF2F7)

None of this causes user confusion. All of it reduces perceived quality and slows future development.

---

## Objective (single sentence)

Replace hardcoded inline values with a shared, token-backed system so that the product looks and behaves consistently without changing any user-visible workflow.

---

## Locked Scope

### IN SCOPE
- Create `design-tokens.ts` — single source of truth for colors, typography, radii, spacing
- Audit and standardize `AppShell.tsx`, `OrgHealthSummary.tsx`, `DrillDownPanel.tsx`, `SetupProgressCard.tsx`, `OrgReadyBanner.tsx`, `EmptyOrgGuide.tsx`, `LoadingScreen.tsx`
- Eliminate STYLE constant from `TeamFrame.tsx` legacy page background conflict
- Create `PrimaryButton.tsx` — one shared button component replacing 3 divergent CTAs
- Create `DarkToast.tsx` — one shared toast shell replacing OrgReadyBanner and SetupProgressCard containers
- Add keyboard focus rings to all interactive elements (`:focus-visible`)

### OUT OF SCOPE
- No new features
- No workflow changes
- No changes to certification harness or backend
- No new props or API surface on AppShell beyond token adoption
- No new shadcn component installs beyond what is already installed

---

## Deliverable structure

### Closure 5.4-A: Design Tokens
- Create: `artifacts/mockup-sandbox/src/components/mockups/teamframe/design-tokens.ts`
- Contains: `TEXT`, `COLOR`, `RADIUS`, `SPACE` — all values, no logic
- Exit: all subsequent closures import from this file, not hardcode

### Closure 5.4-B: Shared Primitives
- Create: `PrimaryButton.tsx` (size sm/md/lg, tone primary/danger/ghost)
- Create: `DarkToast.tsx` (shared shell for OrgReadyBanner + SetupProgressCard)
- Exit: EmptyOrgGuide, OrgReadyBanner, SetupProgressCard CTAs all use PrimaryButton

### Closure 5.4-C: Component Standardization
- Migrate all 7 Phase 5 components to import from design-tokens.ts
- Remove duplicate/divergent inline values
- Fix page background conflict (STYLE.page → AppShell surface-page token)
- Exit: typecheck pass, zero hardcoded color/radius values outside tokens file

### Closure 5.4-D: Focus States
- Add `:focus-visible` ring to all interactive elements using a shared focus style from tokens
- Exit: keyboard navigation works visually end-to-end

---

## Anti-Drift Rules

1. Tokens file has no logic — only constants
2. No component changes behavior — only how it looks
3. Each closure is independently typechecked before proceeding
4. No certification harness modifications
5. Anything new goes to backlog, not active scope

---

## Exit Criteria (all must be true)

| Check | Requirement |
|---|---|
| `pnpm --filter @workspace/mockup-sandbox typecheck` | PASS |
| All Phase 5 components import from design-tokens.ts | Verified |
| Zero hardcoded color values outside design-tokens.ts | Verified |
| PrimaryButton used in EmptyOrgGuide, OrgReadyBanner, SetupProgressCard | Verified |
| Page background conflict resolved | Verified |
| Focus rings present on all interactive elements | Verified |
| No workflow behavior change in any component | Verified |

---

## Backlog (do not execute)
- Tailwind className migration (design-tokens.ts bridges the gap; full className migration is a larger project)
- shadcn component adoption for native inputs/selects
- Animation consistency pass (Framer Motion available but unused)
- Mobile/responsive pass
- Theme switching (dark mode)
