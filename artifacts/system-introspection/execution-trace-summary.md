# Execution Trace Summary

**Generated:** 2026-06-05T16:35:00Z  
**Method:** Static import-graph traversal from each process entry point  
**Scope:** Code that is reachable vs unreachable from a running process

---

## What Actually Runs When the System Starts

### Backend Process: `artifacts/api-server`

Entry: `artifacts/api-server/src/index.ts`

Execution sequence on `node dist/index.mjs`:

```
index.ts
  → reads process.env.PORT — throws if absent or non-numeric
  → imports app.ts
      → creates Express instance
      → app.use(pinoHttp(...))     [ACTIVE — all requests logged]
      → app.use(cors())            [ACTIVE — all requests get CORS headers]
      → app.use(express.json())    [ACTIVE — parses JSON bodies]
      → app.use(express.urlencoded()) [ACTIVE — parses form bodies, never receives data]
      → app.use('/api', router)    [ACTIVE — routes mounted]
          → routes/index.ts
              → router.use(healthRouter)
                  → routes/health.ts
                      → GET /healthz registered [ACTIVE — handles requests]
  → app.listen(port)
  → logger.info({ port }, "Server listening")
```

**Result:** HTTP server starts on `PORT`. Serves exactly 1 route.

---

### Frontend Process: `artifacts/mockup-sandbox`

Entry: Vite dev server → `src/main.tsx`

Execution sequence on browser load at `{BASE_PATH}/preview/teamframe/TeamFrame`:

```
main.tsx
  → createRoot(document.getElementById('root')).render(<App />)
      → App()
          → getBasePath()                     [reads import.meta.env.BASE_URL]
          → getPreviewPath()                  [matches /preview/teamframe/TeamFrame]
          → renders PreviewRenderer(componentPath="teamframe/TeamFrame")
              → useState(Component=null, error=null)
              → useEffect fires:
                  → key = "./components/mockups/teamframe/TeamFrame.tsx"
                  → loader = discoveredModules[key]   [found in .generated file]
                  → loader()                           [dynamic import resolves]
                  → _resolveComponent(mod, "TeamFrame")
                      → returns mod.default (TeamFrame function)
                  → setComponent(TeamFrame)
              → renders <TeamFrame />
                  → useState(activeNav='org')
                  → useState(controlState={scenarioId:'DEFAULT_VIEW', ...})
                  → useState(expandedAction=null)
                  → useState(employeeSearch='')
                  → useState(showJson=false)
                  → useState(editingPosition=null)
                  → useMemo: computeUIState(SEED, controlState)
                      → applyPositionEdits(SEED, [])   → returns SEED unchanged
                      → merges SCENARIOS['DEFAULT_VIEW'] into controlState
                      → computeSignals(SEED, [])        → produces Signal[]
                      → buildOrgTree(SEED, signals, null) → produces OrgNode[]
                      → computeActions(signals, [])     → produces Action[]
                      → computeRisks(SEED, signals)     → produces RiskItem[]
                      → returns UIState
                  → renders org tree view (activeNav='org')
```

**Result:** TeamFrame dashboard renders entirely in-memory. No network calls made.

---

### Vite Plugin: `mockupPreviewPlugin`

Runs in Vite dev server process (not browser):

```
mockupPreviewPlugin.ts
  → configureServer hook fires on dev server start
  → scans src/components/mockups/**/*.tsx
      → finds 4 files:
          EmployeesDenseTable.tsx
          EmployeesRichGrid.tsx
          EmployeesStatusGrouped.tsx
          TeamFrame.tsx
  → writes src/.generated/mockup-components.ts
  → chokidar watcher starts watching src/components/mockups/**/*.tsx
  → on add/unlink: rescans and rewrites .generated file
```

**Result:** Module map kept in sync with mockup directory.

---

## What Is Idle Code (Exists But Never Invoked at Runtime)

### Backend — Idle

| Code | File | Reason Never Invoked |
|------|------|---------------------|
| `express.urlencoded()` middleware | `app.ts:30` | Registered, but no form-encoded request routes or clients exist |
| `cookie-parser` package | `package.json` | Listed as dependency, never imported in any src/ file |
| `@workspace/db` package | `package.json` | Listed as dependency, never imported in any src/ file |

### Frontend — Idle

| Code | File | Reason Never Invoked |
|------|------|---------------------|
| All 50 shadcn/ui components | `src/components/ui/*.tsx` | Not imported by App.tsx, TeamFrame.tsx, or any other mockup |
| `useIsMobile` hook | `src/hooks/use-mobile.tsx` | Only imported by sidebar.tsx; sidebar.tsx is not mounted |
| `useToast` / `toast` | `src/hooks/use-toast.ts` | Only imported by toaster.tsx; toaster.tsx is not mounted |
| `Gallery` component | `src/App.tsx` | Only rendered on non-preview URLs; irrelevant to mockup workflows |

### Shared Libraries — Idle

| Code | File | Reason Never Invoked |
|------|------|---------------------|
| `useHealthCheck` hook | `lib/api-client-react/src/generated/api.ts` | Generated and exported; never imported by any consuming package |
| `healthCheck` fetch function | `lib/api-client-react/src/generated/api.ts` | Same — zero consumers |
| `getHealthCheckQueryOptions` | `lib/api-client-react/src/generated/api.ts` | Same |
| `customFetch` | `lib/api-client-react/src/custom-fetch.ts` | Never called — no component imports api-client-react |
| `setBaseUrl` / `setAuthTokenGetter` | `lib/api-client-react/src/custom-fetch.ts` | Never called |
| `lib/db` Drizzle instance | `lib/db/src/index.ts` | Never imported; schema is empty |

### Scripts — Idle

| Code | File | Reason Never Invoked |
|------|------|---------------------|
| `hello.ts` script | `scripts/src/hello.ts` | Sample file; no package references it as a build dependency |
| `post-merge.sh` | `scripts/post-merge.sh` | Only run by Replit post-merge hook; runs `db push` which pushes empty schema |

---

## What Is Never Invoked (Dead Architecture)

These are not merely idle — they have no path to invocation from any runtime entry point.

| System | Evidence |
|--------|---------|
| Event Store | No files exist. Referenced in `attached_assets/` design docs only. |
| Command Bus / Command Handlers | No files exist. |
| Event Projectors | No files exist. |
| Replay Engine | No files exist. |
| Outbox Processor | No files exist. |
| Quarantine Handler | No files exist. |
| Database Tables | `lib/db/src/schema/index.ts` = `export {}`. Zero tables. |
| Authentication Middleware | `artifacts/api-server/src/middlewares/` = `.gitkeep` only. |
| Frontend ↔ Backend Integration | Zero `fetch()` calls or API client imports in `mockup-sandbox/`. |
| `lib/integrations/*` | Referenced in `pnpm-workspace.yaml` but directory does not exist. |

---

## What Is Partially Wired

| System | What Works | What Is Missing |
|--------|-----------|----------------|
| `lib/api-client-react` | Hook is correctly generated. Backend `/api/healthz` route exists and functions. | No `QueryClientProvider` in frontend. Hook never imported. `setBaseUrl()` never called. The two ends exist but are not connected. |
| `lib/db` | `pg.Pool` + Drizzle setup is correct in `lib/db/src/index.ts`. `drizzle.config.ts` is valid. | Schema file is empty. Not imported by api-server. `DATABASE_URL` not set in runtime. Cannot be used without all three gaps closed. |

---

## Execution Boundary Summary

```
┌─────────────────────────────────────────────────────────────┐
│  ACTUALLY EXECUTES                                          │
│                                                             │
│  Backend:                                                   │
│    Express server → pinoHttp → cors → json parser          │
│    → GET /api/healthz → HealthCheckResponse.parse()        │
│    → { status: "ok" }                                       │
│                                                             │
│  Frontend:                                                  │
│    Vite → main.tsx → App → PreviewRenderer                 │
│    → dynamic import(TeamFrame.tsx)                         │
│    → computeUIState(SEED, controlState)                    │
│    → render org tree / risk heatmap / employee list        │
│    → user interactions → setState → recompute → re-render  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  EXISTS BUT NEVER EXECUTES                                  │
│                                                             │
│  - 50 shadcn/ui components                                 │
│  - useHealthCheck hook                                      │
│  - lib/db (Drizzle + pg)                                    │
│  - Event store / CQRS / projectors / outbox / replay       │
│    (these do not exist even as files)                       │
│  - Any frontend → backend data flow                        │
│  - Any database write                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Code-Backed Conclusions

1. **The system is two isolated processes.** The backend (Express) and frontend (Vite/React) have zero runtime communication beyond the health check endpoint — which itself is never called by the frontend.

2. **The frontend is a self-contained simulation.** `UI = computeUIState(SEED, controlState)` — deterministic, pure function, no side effects, no persistence. All state resets on page refresh.

3. **The database layer is inert.** The schema is empty, the library is not wired into the server, and no `DATABASE_URL` is expected at runtime.

4. **The event/CQRS architecture described in design documents does not exist in source code.** No files, no imports, no hooks, no tables — nothing.

5. **50 UI library components ship with the build but contribute zero rendered pixels.** All mockup components use raw HTML elements with inline styles.

6. **The generated API client is correct code that is never called.** The implementation gap is 3 lines: import the client, add `QueryClientProvider`, call `setBaseUrl()`.
