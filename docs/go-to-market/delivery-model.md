# Delivery Model

This document describes how engagements are run day-to-day. It is written for the operator (you) and any contractor who may eventually support delivery.

---

## TeamFrame as the Internal Execution System

TeamFrame is used as the system of record for every client engagement. It is not shown to clients as a product. It is the tool used to run the work.

For each active client, TeamFrame holds:

| Data | What it tracks |
|---|---|
| Positions | Every role in the org, with title, department, reporting line, lifecycle status |
| Assignments | Who is in each role, start date, assignment history |
| People | Every employee, employment status, contact completeness |
| Compliance status | Missing JDs, unsigned documents, incomplete records per position |
| Org health signals | Vacancies, compliance gaps, action items, overdue items |

This structure means that at any point, for any client, the current state of their org is visible and auditable without asking the client.

---

## Document Storage

TeamFrame tracks the status of documents. It does not store the files.

File storage uses Google Drive or Notion (client-provided workspace) as the primary store.

The hybrid works as follows:

| Layer | Tool | What it holds |
|---|---|---|
| Status and tracking | TeamFrame | "JD exists, signed, dated X" |
| Actual files | Google Drive / Notion | The JD document itself |
| Communication | Email / agreed async channel | Delivery confirmations, updates |

This is the current working model. File persistence within TeamFrame is a future capability. Do not wait for it before starting client work.

---

## Operating Rhythm by Package

### Package 1 — Monthly Cycle

| Week | Activity |
|---|---|
| Week 1 | Review org state in TeamFrame; identify any changes since last month |
| Week 4 | Write and deliver monthly org health summary (1 page, plain English) |
| Ongoing | Monitor async channel; respond within 48 hours |

Monthly org health summary format:
- What changed this month (if anything)
- What gaps currently exist (named specifically)
- What was resolved since last report
- One recommended action (optional)

---

### Package 2 — Bi-Monthly Structured Blocks

| Timing | Activity |
|---|---|
| Day 1 of month | Send proposed block dates and output list for agreement |
| Block 1 (week 1–2) | Structured 4-hour HR work block — execute pre-agreed outputs |
| Block 2 (week 3–4) | Second structured block |
| Week 4 | Monthly org health summary delivered |
| Ongoing | Async support, 24-hour response window |

Block execution process:
1. Open TeamFrame for the client
2. Review current org state (positions, assignments, compliance gaps)
3. Execute agreed outputs in order
4. Update TeamFrame to reflect changes
5. Store any new documents in client Google Drive
6. Send a brief completion note confirming what was done

---

### Package 3 — Weekly Structured Blocks

| Timing | Activity |
|---|---|
| Day 1 of month | Send monthly output plan for all 4 blocks |
| Every week | 4-hour embedded HR operations block on agreed day |
| End of month | Expanded org health report with action items |
| Ongoing | Async team query handling during defined daily window |

Weekly block structure (example):
- 30 min: review org state and any changes since last week
- 2.5 hrs: execute pre-agreed outputs (hiring support, JDs, role setups, policy work)
- 30 min: update TeamFrame to reflect all changes
- 30 min: prep next week's output list, send to client for confirmation

---

## Client Onboarding (All Packages)

Every new client goes through the same onboarding before the retainer begins.

### Step 1 — Discovery call (30 minutes)
- Understand current org structure (how many people, which roles exist, who reports to whom)
- Identify immediate compliance gaps (missing JDs, undocumented roles)
- Agree setup fee tier

### Step 2 — Setup (1–2 days, covered by setup fee)
- Build org in TeamFrame (all positions, people, assignments)
- Draft JDs for the 3–5 most critical roles
- Establish compliance baseline (which documents exist, which are missing)
- Produce and deliver the **First Look Report**

### The First Look Report

Delivered at the end of every setup engagement. Contains:
- What a fresh set of eyes sees in the org that the internal team has stopped seeing
- Roles with no clear owner
- Responsibilities held only in someone's head or undocumented
- Structural gaps visible from outside the organisation

Do not frame this as "here is what is broken." Frame it as:

> "Here is what a fresh set of eyes sees in your org that your team can no longer see because they built it."

This is one of the most valuable things you deliver and it costs no extra time — the observations come naturally from building the org in TeamFrame. The report takes 30–45 minutes to write. Send it as a PDF with the initial org health summary.

### Step 3 — Handover
- Share org health summary with founder
- Agree async channel and response window
- Confirm first month's block dates (Package 2 and 3)
- Begin retainer

---

## Quality Standard

Every client engagement must meet this baseline at all times:

- TeamFrame is current and accurate (updated within 48 hours of any known org change)
- Monthly org health summary is delivered without prompting
- No async message goes unanswered beyond the SLA
- Every structured block has a written completion note

If any of these fail for a client in a given month, that is a service failure. Identify the cause and prevent it the following month.
