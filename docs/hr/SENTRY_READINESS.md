# Sentry / Error Observability Readiness

> **Status: NOT INTEGRATED.** The application does **not** currently initialise
> Sentry. The only reference in the codebase is an esbuild `external` marker for
> `@sentry/profiling-node` in `artifacts/api-server/build.mjs` — there is no SDK
> init, no DSN usage, and no error capture wired in. This document is the
> contract + procedure for turning it on; it does **not** claim Sentry is live.

Production errors should be observable before a paying pilot. Today they are
visible only in process logs (Pino → stdout, captured by the host/Vercel). That
is acceptable for a single founding pilot but should be upgraded before scaling.

---

## Environment contract

| Variable | Scope | Notes |
|---|---|---|
| `SENTRY_DSN` | Server (`api-server`) | Server-side error reporting. |
| `VITE_SENTRY_DSN` | Client (`hr-web`) | Injected at **build time** by Vite. The audit said `NEXT_PUBLIC_SENTRY_DSN`; this app is Vite, not Next.js, so the public prefix is `VITE_`. |

Check presence before launch (does not require Sentry to be integrated yet):

```bash
# Warns if DSNs are absent:
pnpm --filter @workspace/scripts run check:env
# Treat missing observability DSNs as a hard failure (use in a deploy gate):
node scripts/check-env.mjs --strict
```

`check-env` prints `[WARN]`/`[FAIL]` for missing `SENTRY_DSN` / `VITE_SENTRY_DSN`
so they cannot silently be forgotten.

---

## Integration steps (operator — when ready to turn it on)

The repo does not pre-install the Sentry SDK (it would add a runtime dependency
subject to the `minimumReleaseAge` supply-chain guard). When you choose to
enable it:

1. **Server** — add `@sentry/node`, and at the very top of
   `artifacts/api-server/src/index.ts`:
   ```ts
   import * as Sentry from "@sentry/node";
   if (process.env.SENTRY_DSN) {
     Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
   }
   ```
   Then register `Sentry.setupExpressErrorHandler(app)` (or equivalent) in
   `app.ts` **before** the existing error-handler middleware.
2. **Client** — add `@sentry/react`, and in `artifacts/hr-web/src/main.tsx`:
   ```ts
   import * as Sentry from "@sentry/react";
   if (import.meta.env.VITE_SENTRY_DSN) {
     Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
   }
   ```
3. Guard both behind the DSN being present so local/dev runs without a DSN are
   unaffected. **Never commit a DSN.**

---

## Verifying a test event (after DSNs are added)

Once the SDK is initialised and a DSN is set in the environment:

- **Server:** add a temporary throwaway route or a one-off script that calls
  `Sentry.captureException(new Error("teamframe sentry smoke test"))`, run it
  against the deployed environment, and confirm the event appears in the Sentry
  project. Remove the temporary code afterward.
- **Client:** trigger a deliberate error in a throwaway dev build and confirm it
  lands in Sentry.

Do **not** create a Sentry account, generate, or embed DSNs as part of this
codebase. This is an operator action.

---

## Pre-pilot checklist

- [ ] `SENTRY_DSN` set in the api-server production environment
- [ ] `VITE_SENTRY_DSN` set in the hr-web build environment
- [ ] `node scripts/check-env.mjs --strict` passes
- [ ] SDK init merged (server + client) per steps above
- [ ] One test event confirmed received in Sentry, then test code removed
