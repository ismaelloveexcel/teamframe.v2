# Demo Runbook — "Meridian Advisory Group"

How to seed and present the TeamFrame demo so it tells the **risk → fix → proof**
story.

> **Which surface this drives (audit assumption corrected):** the seed targets
> the **Founder Dependency / people-ops risk** domain (the `organizations /
> people / positions / actions` model) over HTTP — this is where TeamFrame's
> risk signals and red/yellow/resolved lanes live. It does **not** populate the
> authenticated `hr-web` SPA's `hr_*` modules (employees/leave/documents), which
> are a separate surface. Document-expiry, leave requests, and offboarding cases
> are `hr_*` features and are **not** part of this risk demo (the `hr_document`
> table has no expiry field today). Demo the risk story below; do not promise
> document-expiry tracking as shipped.

---

## What the seed creates

`scripts/seed-demo-org.mjs` builds a deliberately-flawed advisory firm with
**obviously fictional** names and an `@meridian-advisory.example` domain:

- **6 teams**, **22 positions** (several intentionally **vacant** or **orphaned**
  — no reporting line), **12 people** assigned.
- **Team & position ownerships** — sized so ownership coverage lands at ~45–55%.
- **10 actions** spanning the lanes:
  - **Open + overdue → RED** (urgent risk): compliance audit (-7d), tech upgrade
    (-14d), BD pipeline (-5d), finance migration (-3d) — several owned by **vacant
    positions** (work routed to an empty seat = a visible dependency).
  - **In progress → YELLOW** (a fix underway / markable item): Apex onboarding,
    Technology Lead recruitment brief.
  - **Done → RESOLVED** (proof the loop closes): Q3 client review, TechBridge
    renewal.

This produces the full **risk → fix → proof** spread plus enough structure to
generate and export the **Founder Dependency Report**.

---

## How to run

```bash
# Default target is the deployed demo API (override with TF_API_BASE):
npm run seed:demo
# or, equivalently:
node scripts/seed-demo-org.mjs

# Against a different environment:
TF_API_BASE="https://<your-api-host>" node scripts/seed-demo-org.mjs
```

The script is **idempotent and resumable** — every entity is matched by a natural
key and only created/advanced when missing, so it is safe to re-run after a
mid-way failure.

### Account used

The seed acts as a fixed **demo operator** via header-trusted actor context
(legacy routes):

- `x-user-id: a1b2c3d4-e5f6-4a90-abcd-ef1234567890`
- `x-user-email: demo@teamframe.app`
- `x-user-name: Demo Operator`

This actor is the admin/owner of the seeded organisation. (The `hr-web` SPA uses
session login instead; that is a different surface — see the note above.)

---

## Demo story & screen order

Tell it as "the check-engine light for people operations":

1. **Org structure** — show the org/positions. Point out vacant and orphaned
   roles: "work is happening, but several seats are empty and one role reports to
   no one." → *this is the risk surface.*
2. **Actions / signals (RED)** — show the open + overdue actions, especially the
   ones **owned by vacant positions**: "these are routed to an empty seat — no
   one actually owns them." → *risk made concrete.*
3. **In progress (YELLOW)** — show the actions being worked: "here's what's
   mid-fix; the operator drives these in the weekly review." → *fix.*
4. **Resolved (DONE)** — show the closed actions: "and here's proof the loop
   closes — resolved, on the record." → *proof.*
5. **Founder Dependency Report** — generate/export it. Expected:
   - Ownership coverage: ~45–55%
   - Single points of failure: 6–8+ items
   - Recommended handoffs: 3 items
   → *the one-page artifact a founder actually keeps; also the exportable proof.*

End on the report: it is the tangible "what's about to break, and what we did
about it" deliverable that anchors the managed-service offer.

---

## Do / don't

- **Do** keep names obviously fictional (the seed already does — `.example`
  domain, "Meridian Advisory Group").
- **Don't** demo document-expiry, leave approvals, or offboarding as part of this
  risk story — they are separate `hr_*` modules, not in this seed.
- **Don't** point the seed at a real client tenant.
