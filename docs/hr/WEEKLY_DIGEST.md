# Weekly Admin Digest (V1.5) — Runbook

> **Scope guard:** this is **one** scoped admin digest of open red/yellow
> signals — **not** a reminders engine. Do not add per-signal rules, user
> notification preferences, employee nudges, multi-channel/Slack delivery, or
> escalation workflows. If a change would make this configurable per-signal,
> it is out of scope.

## What ships today

A pure, tested **generator**:

- `artifacts/api-server/src/services/weekly-digest.ts` — `buildWeeklyDigest()`
  turns a list of open red/yellow signals into a digest payload: tenant name,
  red count, yellow count, top 5 (red first, then most-overdue first), dashboard
  link, and the footer **"TeamFrame is not legal advice."**
- Tests: `pnpm --filter @workspace/api-server run test:digest`.

It deliberately **does not** fetch data or send email — the repo has no email
provider, and we do not fake delivery. Sourcing and delivery are wired by the
operator as described below.

## Wiring it up (operator, when ready)

The generator is intentionally data-source-agnostic so it stays testable. To run
it on a schedule:

1. **Source the signals** (admin-only, per tenant). Map existing open work to
   severities — e.g. from the people-ops action model:
   - `red` = open actions that are **overdue** (or owned by a vacant position).
   - `yellow` = open/in-progress actions that are **not yet overdue**.
   - Resolved/`done` items are excluded.
   Build a `DigestSignal[]` from that query. Send **only to tenant admins**
   (look up `memberships.role = 'admin'`).
2. **Add a server-side route** that a scheduler can call, e.g.
   `POST /internal/digests/weekly` guarded by an internal secret (not a public
   route). It loops tenants, builds signals, calls `buildWeeklyDigest`, and hands
   the result to your delivery step. Keep the loop tenant-scoped via
   `runWithTenant()` so RLS applies.
3. **Deliver.** Only when an email provider exists, pass `digest.subject` /
   `digest.text` to it. Until then, log/store the payload or surface it in the
   weekly review. **Do not fake email sending.**
4. **Schedule** with Vercel Cron (or equivalent) — e.g. weekly:

   ```json
   // vercel.json (api-server project)
   {
     "crons": [{ "path": "/internal/digests/weekly", "schedule": "0 8 * * 1" }]
   }
   ```

   Protect the endpoint with a shared secret header so only the cron can invoke it.

## Digest content (fixed)

- Tenant name
- Count of urgent/red signals
- Count of important/yellow signals
- Top 5 open signals (red first, most-overdue first)
- Link to the dashboard
- Footer: "TeamFrame is not legal advice."

## Explicitly not building

Configurable reminders · employee nudges · notification preferences ·
multi-channel/Slack notifications · escalation workflows.
