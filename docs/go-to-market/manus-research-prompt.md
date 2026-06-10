# Manus Research Prompt — Target Company Identification

Use this prompt in Manus to generate a live list of target companies for outreach.

---

## Prompt

```
You are performing a targeted company research task. This is NOT market analysis. This is prospecting research.

OBJECTIVE: Identify 30 real UK companies that match the ideal customer profile for a fractional HR service targeting growing startups.

IDEAL CUSTOMER PROFILE:
- UK-based (London preferred but any UK city acceptable)
- 15–60 employees
- Raised seed or Series A funding in the last 12 months
- Technology or SaaS product company
- No dedicated HR person or People Operations role listed on their website or LinkedIn team page

RESEARCH TASKS:

1. FUNDED COMPANIES (find 15)
   Search for UK tech startups that:
   - Raised seed or Series A between June 2025 and June 2026
   - Have 15–60 employees
   - Are based in the UK
   Sources to check: Crunchbase, Tech.eu, Sifted, The Stack, LinkedIn

   For each company provide:
   - Company name
   - Website URL
   - Funding round and approximate amount
   - Approximate employee count
   - Founder/CEO name and LinkedIn URL (if findable)
   - Evidence of no HR person (e.g. "no People Ops role on LinkedIn team page")

2. ACTIVE HR JOB POSTINGS (find 15)
   Search for UK companies currently posting these roles:
   - "HR Manager" (remote or hybrid)
   - "People Operations Manager" (remote or hybrid)
   - "Head of People" (remote or hybrid)
   
   Filter to: companies with 15–60 employees, UK-based, posted in last 30 days
   Sources: LinkedIn Jobs, Glassdoor, Indeed UK, Workable job boards

   For each company provide:
   - Company name
   - Website URL
   - Job title posted
   - Date posted
   - Approximate employee count
   - Founder/CEO name and LinkedIn URL (if findable)

OUTPUT FORMAT:
Return two tables:
- Table 1: Funded companies (15 rows)
- Table 2: Companies with active HR job postings (15 rows)

Each row must include all fields listed above.

DO NOT include:
- Companies larger than 100 employees
- Non-UK companies
- Companies that already have a Head of People or HR Director listed on LinkedIn
- Recruitment agencies or HR companies themselves

This output will be used for direct personalised outreach. Accuracy matters more than quantity.
```

---

## What to do with the output

1. Copy the two tables into a spreadsheet
2. Add columns: Date contacted / Message sent / Response / Outcome
3. Start with the job posting companies (Sequence A) — they have higher urgency
4. Then work through the funded companies (Sequence B)
5. Log all responses in objection-log.md

---

## Note on accuracy

Manus may not have real-time access to all job boards. Cross-check job postings on LinkedIn directly before sending. A company that posted 6 weeks ago may have already hired.
