# Execution Plan — Next 60 Days

This is an operational plan, not a strategy document. Each phase has a clear output and a clear next trigger.

---

## Starting Position (Current State)

- TeamFrame is built and Phase 5 certified (all A–H certification gates passing)
- Backend: event-sourced, replay-deterministic, certified stable
- Frontend: three UX flows complete (onboarding, core loop, value confirmation)
- Design system consolidated (design-tokens, component library, focus states)
- Release branch exists: `release/certified-v1`
- No paying clients yet
- Outreach not started

The system is production-ready. The work in this plan is not building — it is validating for live client use, then acquiring clients.

---

## Phase 1 — Client Readiness Verification (Week 1–2)

**Goal:** Confirm the system works reliably as a live HR tool, not just a certified technical system.

**Output:** A documented "client readiness checklist" confirming the system can support a live client from day one.

### Tasks

- [ ] Run a simulated onboarding for one fictional 25-person company
  - Create org structure (positions, reporting lines, departments)
  - Add 25 fictional employees with realistic data
  - Create 5 JDs (draft → in review → signed lifecycle)
  - Record 3 role changes over a simulated month
  - Generate monthly org health summary from the system state
- [ ] Identify anything that breaks, is confusing, or requires a workaround
- [ ] Document all workarounds (these are the gaps to close later, not now)
- [ ] Confirm document storage hybrid works (TeamFrame status + Google Drive files)
- [ ] Confirm async communication workflow (how a client sends a request, how it is processed, how it is confirmed)

**Trigger to move to Phase 2:** Simulation completed with no blockers that would prevent live client use.

---

## Phase 2 — Internal Workflow Testing (Week 2–4)

**Goal:** Run the actual delivery model as if 2 clients exist. Identify any operational gaps before real money is on the table.

**Output:** A tested, working delivery workflow for all three packages.

### Tasks

- [ ] Simulate Package 1 delivery for one fictional client (full monthly cycle)
  - Week 1: review org state, identify changes
  - Week 4: write and deliver org health summary
  - Test: does the summary format work? Is it clear? Would a founder understand it?
- [ ] Simulate Package 2 delivery for one fictional client
  - Plan two structured blocks
  - Execute pre-agreed outputs
  - Write completion notes
  - Deliver monthly summary
- [ ] Test the scope boundary in practice
  - Deliberately introduce an out-of-scope request in the simulation
  - Practice the response (use language from scope-and-boundaries.md)
- [ ] Refine the monthly org health summary format until it is genuinely useful
- [ ] Create reusable templates:
  - Monthly output planning message (sent to client at start of month)
  - Block completion note (sent after each structured day)
  - Org health summary template (1 page)

**Trigger to move to Phase 3:** All three package delivery models tested. Templates ready. No operational blockers.

---

## Phase 3 — Outreach Preparation (Week 4–6)

**Goal:** Build the materials needed to generate the first paying client conversations.

**Output:** Three documents and one target list.

### Documents to create

- [ ] One-page offer sheet (what is sent after a call or in a cold outreach follow-up)
  - One sentence offer
  - Three packages with prices
  - Who it is for
  - What happens next (setup call)
- [ ] Cold outreach message (Package 2 as the anchor offer)
  - One sentence naming the trigger event
  - One sentence describing the outcome
  - One question
  - Maximum 5 lines total
- [ ] Objection responses (written in advance)
  - "We're too small for this"
  - "We already have a spreadsheet"
  - "Can we just pay per hour?"
  - "We'll think about it"

### Target list

- [ ] Identify 30 companies that match the ideal customer profile:
  - 20–50 employees
  - Raised seed or Series A in the last 12 months
  - Based in UK (or remote-first UK-adjacent)
  - No HR person listed on LinkedIn
- [ ] Sources: LinkedIn, Companies House filings, Crunchbase funding announcements
- [ ] Record in a simple spreadsheet: company name, size, funding date, founder name, LinkedIn URL, outreach status

**Trigger to move to Phase 4:** 30 targets identified. All three documents ready. Offer sheet reviewed and considered honest and accurate.

---

## Phase 4 — First Client Acquisition (Week 6–8)

**Goal:** Acquire 3–5 paying clients. Paid pilots only — no free trials, no equity deals, no "let's see how it goes" arrangements.

**Output:** Signed contracts with setup fees received.

### Outreach process

- Send cold outreach to 5 targets per week (not more — quality over volume at this stage)
- Follow up once after 5 days if no response
- If interested: 30-minute discovery call
- If fit confirmed: send one-page offer sheet within 24 hours
- If they want to proceed: setup fee invoice sent within 48 hours
- Setup begins on receipt of payment

### What counts as a yes

A signed 3-month minimum contract and a paid setup fee. Nothing else counts as a client.

### Constraints

- Do not start scaling outreach until 3 paying clients exist
- Do not accept a client below the minimum commitment
- Do not discount to close — adjust scope if price is an objection
- Do not take on more than 5 Package 3 clients total (hard cap)

---

## What Happens After Day 60

This plan stops at day 60 deliberately.

After 3–5 paying clients exist, the following will be clear:
- Which package is most commonly chosen
- What the actual time demand is per client
- Which parts of the delivery model need adjustment
- Whether document persistence in TeamFrame needs to be built

Do not plan beyond 60 days until those signals exist. Build from client reality, not from projections.

---

## Single Most Important Metric

At day 60, one number determines success:

**Number of clients with signed contracts and paid setup fees.**

- 0 clients: review outreach message and target list quality
- 1–2 clients: continue outreach, refine pitch
- 3–5 clients: model is working, focus on delivery quality
- 5+ clients: capacity management becomes the priority
