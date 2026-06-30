# Launch Audit — Corrected Assumptions

The paid-pilot readiness audit was written against an assumed architecture
(Supabase + JWT RLS, object-storage document uploads, a service-role dashboard
client). This repository does not use that architecture. This note records each
corrected assumption and where the real work landed, so the audit trail stays
honest.

| Audit assumption | Reality in this repo | Resolution |
|---|---|---|
| Tenant RLS via Supabase `tenancy_rls_v2.sql` / `current_actor_tenant_id()` (JWT, email fallback) | Postgres RLS via the `app.company_id` GUC set by `runWithTenant()` on a `NOBYPASSRLS` `app_user` role. No Supabase, no JWT, no email fallback. | Phase 1 verifies the equivalent guarantees: `verify:rls:prod` + `docs/hr/PROD_RLS_VERIFICATION.md`. |
| Landing page at `app/page.tsx` (Next.js) | No public marketing site; an authenticated React/Vite SPA. Commercial copy lives in `docs/go-to-market/`. | Phases 2–3 land in `docs/go-to-market/`; a future public site is scoped in `docs/go-to-market/landing-page-copy.md`. |
| Document upload: storage upload succeeds, DB insert fails → orphaned storage object (unchecked compensating delete) | **No object storage exists.** `hr-document-service` merges templates into text and inserts a single DB row; `attachments` is a JSON metadata column (links to externally-held Drive files per the hybrid model). | **Not applicable — see below.** No compensating delete to fix. |
| Dashboard reads via a service-role client with manual `.eq(tenant_id)` filtering | No service-role/Supabase client. Dashboard reads are session-authed HR routes behind `requireSessionAuth`, which wraps the request in `runWithTenant()` so RLS scopes every query. | Phase 8 adds `dashboard-tenant-scope-gate` proving the middleware still establishes the tenant scope. |
| Sentry is provisioned | Only an esbuild `external` marker referenced `@sentry/profiling-node`; no SDK, no init, no DSN. | Phase 6 adds an env check + runbook; no DSN is fabricated. |

---

## Phase 7 — document storage cleanup: not applicable (with evidence)

**Audit finding:** "If storage upload succeeds but DB record creation fails, the
compensating storage delete result may be unchecked, leaving orphaned storage
objects."

**Why it cannot occur here:**

1. **TeamFrame performs no object-storage upload.** A repo-wide search for
   `multer`, `s3`, `@aws-sdk`, `getSignedUrl`/`putObject`, `supabase storage`,
   `bucket`, `busboy`/`formidable`, and `multipart/form-data` finds none in the
   server or web app. The only `blob` identifiers are `responseBlob` (an
   idempotency-record JSON column) and JSON `eosgInputs`/`attachments` payloads.
2. **Document creation is a single atomic DB write.** `createDocument` and
   `generateDocument` run through `mutateWithAudit`, which performs the document
   insert *and* its audit row inside one `db.transaction(...)`. If any step
   fails, the whole transaction rolls back — there is no two-phase
   "external write then DB write" sequence and therefore nothing to orphan.

**Equivalent-risk check (as instructed):** the document write path has no
compensating-action weakness. The `attachments` JSON may reference files stored
in Google Drive (the documented hybrid model), but TeamFrame neither uploads nor
deletes those files, so it owns no storage-cleanup obligation. No code change is
warranted; making one would fabricate an unused storage layer.

If object storage is ever added, re-open this item: the upload + DB-insert
sequence must delete the uploaded object on DB failure, check the delete result,
log delete failures server-side, and keep user-facing errors non-leaky.
