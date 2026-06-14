# TeamFrame Repository Audit Prompt

Use this prompt with Claude, ChatGPT, or Perplexity for a structured product viability review.

---

```
TEAMFRAME PRODUCT AUDIT — MANAGED HR SERVICE FOR SMALL TEAMS

Repository: https://github.com/ismaelloveexcel/teamframe.v2
Branch: cursor/phase4-stabilization-closure-sequence-df31

---

AUDIT OBJECTIVE

The objective is not to determine whether features exist.
The objective is to determine whether a founder with 10–30 employees could
realistically use this area in production without spreadsheets, emails, or
manual tracking outside the system.

When evaluating each area, assess operational usability, not feature presence.

The central question is:
"Can TeamFrame be sold as a managed HR service to a 10–30 employee company
right now, and if not, what are the few highest-impact gaps?"

---

PRODUCT CONTEXT

TeamFrame is a managed HR operations tool for companies with 10–30 employees.
It is operated by a fractional HR professional on behalf of founders and small
team leaders who do not have HR expertise.

The target user is a CEO or founder who:
- Is building their org chart for the first time
- Does not know what HR compliance they are legally required to maintain
- Is onboarding employees without knowing what data they need to collect
- Needs a basic payroll report for their finance team
- Has no process for recording leave or managing offboarding

The tool must cover these basics without being a full HRIS.
Simple, not complex.

This is a MANAGED SERVICE. A fractional HR operator uses TeamFrame on behalf
of clients. Clients do not log in. The operator produces monthly deliverables.

---

WHAT NOT TO EVALUATE

Do not evaluate:
- Backend architecture, event sourcing, or certification status
- Features outside the eight areas below
- Enterprise features or HRIS parity
- Country-specific legal requirements unless explicitly supported in the codebase
- Self-serve onboarding (not part of the model)
- Anything that would require a full rebuild

Do not speculate. If something does not exist in the code, say it does not exist.

---

SEVERITY CLASSIFICATION

For every missing capability, classify it as:

CRITICAL — Prevents real-world use of this area entirely
IMPORTANT — Creates operational friction but workarounds exist
OPTIONAL — Useful improvement but not required for launch

---

AREA 1 — ORG CHART AND POSITION SETUP

A CEO opens the tool to build their org chart from scratch.

Evaluate:
1. Can they create positions with titles and reporting lines?
2. Does the system guide them on what basic positions a small team needs?
3. Does the system prompt them that each position needs a Job Description?
4. Is there any grading or level structure (e.g. Junior / Senior / Lead)?
5. Does the system flag when a position has no reporting line defined?
6. If I launched tomorrow to a 10–30 employee company, could a founder build
   their org chart without needing a spreadsheet alongside it?

For each missing capability state severity: CRITICAL / IMPORTANT / OPTIONAL

---

AREA 2 — EMPLOYEE ONBOARDING COMPLIANCE

A founder is onboarding a new employee and does not know what data to collect.

Evaluate:
1. Does the system capture: full name, email, phone, start date, position,
   employment type?
2. Does the system capture: emergency contact, bank details, tax reference,
   national ID or equivalent?
3. Does the system capture: right-to-work documentation, signed contract,
   KYC documents?
4. Does the system prompt the operator when required onboarding data is missing?
5. Is there a checklist or structured onboarding flow an operator can follow?

Important: Identify onboarding information commonly required across most
jurisdictions for payroll administration, identity verification, employment
documentation, and emergency contact purposes.
Do not assume any country-specific legal requirement unless explicitly
supported by the codebase.

For each missing capability state severity: CRITICAL / IMPORTANT / OPTIONAL

---

AREA 3 — PAYROLL REPORT

Finance needs a basic monthly report to run payroll.

Evaluate:
1. Does the system export or display: name, position, start date, salary,
   employment type?
2. Does it include: bank details, tax reference, pay frequency?
3. Does it distinguish between full-time, part-time, and contractor employees?
4. Is there a report or export that a finance team could actually use without
   reformatting in a spreadsheet?
5. What is missing from the current export for it to be payroll-usable?

For each missing capability state severity: CRITICAL / IMPORTANT / OPTIONAL

---

AREA 4 — LEAVE RECORDING

No approval workflow needed. Just basic recording of leave taken.

Evaluate:
1. Is there any leave recording in the system (annual leave, sick leave, unpaid)?
2. Can an operator log leave taken for an employee?
3. Is there a leave balance or leave history view per employee?
4. Could an operator produce a leave summary for a single employee on demand?
5. What would need to be built for basic leave recording to work?

For each missing capability state severity: CRITICAL / IMPORTANT / OPTIONAL

---

AREA 5 — OFFBOARDING

No complex workflow. Basic record of departure and a simple exit report.

Evaluate:
1. Can an operator record an employee's last working day?
2. Does the system produce an exit summary: join date, last day, leave taken,
   role history?
3. Is the offboarding flow accessible from the UI (not just in backend code)?
4. What is the minimum needed for a usable offboarding record?

For each missing capability state severity: CRITICAL / IMPORTANT / OPTIONAL

---

AREA 6 — COMPLIANCE GAP DETECTION

The core promise: surfacing what small team leaders miss.

Evaluate:
1. Does the system flag missing employment contracts?
2. Does it flag missing identity or onboarding documentation?
3. Does it flag employees with no emergency contact recorded?
4. Does it flag positions with no Job Description?
5. Does it surface these gaps in a way a non-HR founder would understand —
   plain language, not technical labels?
6. Is the gap between current compliance detection and minimum viable coverage
   large enough to prevent a paying client from trusting the system?

For each missing capability state severity: CRITICAL / IMPORTANT / OPTIONAL

---

AREA 7 — DATA THAT EXISTS BUT IS NOT SURFACED

The system already collects significant data about employees, positions,
assignments, compliance status, and org structure. Identify cases where
the data exists in the codebase but is not presented in a useful way.

Focus only on additions that:
- Require no new data collection (data already exists)
- Require no new backend endpoints (computed from existing state)
- Would be a single view, report, or panel addition
- Would be immediately useful to an operator or founder

For each finding, answer these questions:

Expected Question:
What would a founder reasonably ask when looking at this area?
Example: "Which employees are not compliant?"

Current Experience:
How many screens must a user navigate to find the answer?
Can they find it at all?

Ideal Existing-Data Solution:
How could the answer be surfaced using data already in the system?
One sentence only.

Then classify each finding:
LOW complexity — single component, data already wired
MEDIUM complexity — requires connecting two existing data sources
HIGH complexity — requires new data collection (exclude these)

Report only LOW and MEDIUM complexity items. Maximum 10 items.

---

AREA 8 — SELLABILITY TEST

Assume TeamFrame launches tomorrow.
A founder with 15 employees purchases the managed HR service.

For each of the following, evaluate: PASS / PARTIAL / FAIL

- Org structure setup
- Employee records
- New hire onboarding
- Basic compliance tracking
- Leave tracking
- Payroll preparation
- Employee exits

Then answer this single question with YES or NO and one paragraph of
justification grounded in the codebase:

"Would you personally allow a fractional HR consultant to manage a paying
client's HR function using this system as their primary tool?"

---

OUTPUT FORMAT

For Areas 1–6 return:

AREA NAME
STATUS: READY / NEAR READY / NOT READY
WHAT EXISTS: one paragraph of what is actually in the codebase (file references)
CRITICAL GAPS: bulleted list with severity classification
MINIMUM TO FIX: what would need to be built or changed, in order of priority

For Area 7 return:
Numbered list. For each item: Expected Question / Current Experience /
Ideal Existing-Data Solution / Complexity rating.

For Area 8 return:
The pass/partial/fail table, then the YES/NO answer with justification.

Then provide:

LAUNCH READINESS ASSESSMENT
For each area: READY / NEAR READY / NOT READY

TOP 10 ITEMS TO COMPLETE BEFORE FIRST PAYING CLIENT
Ranked by business impact.
Only include items that materially affect the value proposition.
Do not include optional or nice-to-have items.

---

FINAL RULES

Ground every finding in specific files and line numbers.
Do not speculate. If something does not exist in the code, say it does not exist.
Do not suggest features outside these eight areas.
Do not suggest rebuilding existing components.
Do not recommend enterprise features.
Do not add items to the top 10 list that are not supported by findings above.
```
