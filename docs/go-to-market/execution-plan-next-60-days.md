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

**Goal:** Confirm the system works reliably as a live HR tool under real conditions, including change — not just initial data entry.

**Output:** A completed production readiness checklist (see `production-readiness-checklist.md`) with all items passing.

### Week 1 — Simulation

Run a full simulated onboarding for one fictional 25-person company. Then force change through the system.

Static setup:
- [ ] Create org structure (positions, reporting lines, departments)
- [ ] Add 25 fictional employees with realistic data
- [ ] Create 5 JDs (draft → in review → signed lifecycle)

Change scenarios (run all of these — the system must survive change, not just initial entry):
- [ ] New hire joins — create role, assign person
- [ ] Employee leaves — end assignment, vacate position
- [ ] Manager changes — update reporting lines across affected positions
- [ ] New position created mid-month
- [ ] Position frozen (role no longer active)
- [ ] Missing document identified and flagged in org health
- [ ] JD updated and re-signed after a role change
- [ ] Monthly org health summary generated from the changed state

### Week 2 — Fix and Freeze

- [ ] Score the production readiness checklist against all 13 requirements
- [ ] Classify every gap found as trust-destroying or friction
- [ ] Fix trust-destroying issues only
- [ ] Document all friction workarounds — do not fix them now
- [ ] Re-run failed scenarios until they pass
- [ ] Freeze the product. No feature work after this point.

**Trigger to move to Phase 3:** All 13 checklist items pass. Product is frozen.

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

## Phase 3 — Outreach Preparation (Week 3)

**Goal:** Build the materials needed to generate the first paying client conversations.

**Output:** Three documents, one target list, objection log initialised.

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
- [ ] Objection responses (written in advance for the 8 most common — see objection-log.md)

### Target list

- [ ] Identify 30 companies that match the ideal customer profile:
  - 20–50 employees
  - Raised seed or Series A in the last 12 months
  - Based in UK (or remote-first UK-adjacent)
  - No HR person listed on LinkedIn
- [ ] Sources: LinkedIn, Companies House filings, Crunchbase funding announcements
- [ ] Record in a simple spreadsheet: company name, size, funding date, founder name, LinkedIn URL, outreach status

### Objection log

- [ ] Open `objection-log.md`
- [ ] Pre-populate the tally table with the 8 known objections
- [ ] Ready to log from first conversation

**Trigger to move to Phase 4:** 30 targets identified. All three documents ready. Objection log initialised.

---

## Phase 4 — First Client Acquisition (Week 4–8)

**Goal:** Acquire 3–5 paying clients. Paid pilots only — no free trials, no equity deals, no "let's see how it goes" arrangements.

**Output:** Signed contracts with setup fees received. Or, if no sales: a clear evidence base explaining why prospects are not buying.

### Week 4 — Send first outreach

- [ ] Send 15–20 personalised outreach messages by end of week (not 5 — too few to generate meaningful signal)
- Each message personalised to the specific company trigger (recent funding, hiring announcement, no HR person visible)
- Follow up once after 5 days if no response

### Weeks 5–8 — Work the pipeline

- If interested: 30-minute discovery call
- Log every response (yes, no, objection, silence) in objection-log.md immediately after
- If fit confirmed: send one-page offer sheet within 24 hours
- If they want to proceed: setup fee invoice sent within 48 hours
- Setup begins on receipt of payment

### What counts as a yes

A signed 3-month minimum contract and a paid setup fee. Nothing else counts as a client.

### What counts as useful even without a sale

20+ outreach messages sent, 8+ discovery calls completed, objection log with 10+ entries and clear patterns identified.

That is not failure. That is evidence. Use it to refine the message, not the product.

### Constraints

- Do not scale outreach volume before the message is validated (first 15–20 messages are the test)
- Do not accept a client below the minimum commitment
- Do not discount to close — adjust scope if price is an objection
- Do not take on more than 5 Package 3 clients total (hard cap)
- Do not trigger any feature work based on prospect assumptions — only based on repeated friction observed in discovery calls (same issue raised 3+ times)

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

- 0 clients + fewer than 15 outreach messages sent: you stayed in the loop. Start outreach immediately.
- 0 clients + 20+ conversations + clear objection pattern: messaging problem, not product problem. Adjust pitch.
- 1–2 clients: model is working. Continue outreach, focus on delivery quality for existing clients.
- 3–5 clients: strong validation. Capacity management becomes the priority.
- 5+ clients: do not take more until delivery is stable.

Both outcomes — sales and a clear "why they are not buying" — are valid at day 60. The only failure is reaching day 60 having built more features and spoken to nobody.

---

## The Anti-Loop Rule

At the end of every week, answer one question:

> "Did I speak to a potential client this week?"

If yes: on track.

If no: stop all other work. Send an outreach message before doing anything else that day.
