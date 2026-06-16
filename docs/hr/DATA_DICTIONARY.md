# DATA_DICTIONARY.md — consolidated from 5 prior HR systems

**Phase 0 deliverable.** Source of field truth for Prompts 3/4/6. Built from the
real models in the founder's prior systems (uploaded), not invented.

**Sources (S = tag used below):**
- `S-BAY` — baynunah-hr-portal (Prisma, Abu Dhabi/UAE) — most complete UAE model
- `S-REN` — Secure-Renewals-2 (FastAPI/SQLAlchemy) — document-renewal + compliance specialist
- `S-AZ` — HR-PORTAL-AZURE (FastAPI) + its real 41-column Employee CSV
- `S-POP` — people-ops-platform (Supabase/Postgres) — unified request + audit model
- `S-DP` — HR-DIGITAL-PASS (Drizzle/TS) — recruitment (mostly out of scope)
- `S-TF` — this teamframe repo's existing shells

> Money rule (overrides sources): store amounts as **integer minor units (fils) +
> explicit currency** (sources used Decimal/float; default currency observed = **AED**).
> `mand` = mandatory, `opt` = optional.

---

## Company (tenant root — extend existing `organizations`)
| field | type | m/o | source | notes |
|---|---|---|---|---|
| name | text | mand | S-BAY | |
| name_arabic | text | opt | S-BAY | UAE bilingual |
| license_number | text | opt(uniq) | S-BAY | trade licence |
| jurisdiction | text | mand | S-TF/spec | default 'UAE' |
| currency | text | mand | S-REN | default 'AED' |
| address / city / country | text | opt | S-BAY | city default 'Abu Dhabi' |
| config | jsonb | opt | spec | |

## User (auth identity, global)
| field | type | m/o | source | notes |
|---|---|---|---|---|
| email | text uniq | mand | all | |
| password_hash | text | mand | S-BAY/S-REN | bcrypt (already a dep) |
| role | enum | mand | S-BAY | admin/employee/super_admin (see RBAC) |
| status | enum | mand | S-BAY/S-REN | invited / active / inactive |
| invite_token | text | opt | S-BAY | one-time activation (`passToken`) |

## Position (core object 1)
| field | type | m/o | source | notes |
|---|---|---|---|---|
| title / job_title | text | mand | S-AZ/S-REN | |
| department | text | mand | all | |
| function | text | opt | S-AZ/S-REN | |
| line_manager_id | fk→Position | opt | all | self-ref hierarchy |
| grade | text | opt | spec | |
| location | text | opt | S-AZ/S-REN | |
| employment_type | enum | opt | S-POP/S-BAY | full_time/part_time/contract |
| work_schedule | text | opt | S-AZ/S-REN | |
| budgeted | bool | opt | spec | budgeted vs non-budgeted |
| job_description (file) | text/url | opt | S-REN | JD doc |
| status | enum | mand | spec | active / retired |

## Employee (core object 2) — HR-managed core
| field | type | m/o | source | notes |
|---|---|---|---|---|
| employee_no | text uniq | mand | all | |
| first_name / last_name (or name) | text | mand | S-BAY (split) / S-AZ (single) | **conflict:** BAY splits, AZ/REN single `name` → recommend split |
| date_of_birth | date | mand(REN)/opt(BAY) | S-REN/S-BAY | |
| gender | text | opt | S-AZ/S-REN | |
| nationality | text | opt | all | |
| personal_email | text | opt | S-REN | |
| company_email | text | opt | S-AZ | |
| mobile_number / company_phone | text | opt | S-REN/S-AZ | |
| address | text | opt | spec/S-REN | |
| emergency_contacts | jsonb | opt | spec | |
| join_date | date | mand | all | |
| date_of_exit | date | opt | S-REN | offboarding |
| probation_start/end | date | opt | S-REN | |
| one/three/six_month_eval_date | date | opt | S-AZ/S-REN | probation evals |
| last_promotion_date / last_increment_date | date | opt | S-AZ/S-REN | |
| profile_photo | url | opt | S-REN | |
| communication_channel | text | opt | S-REN | Email/WhatsApp |
| notes | text | opt | S-REN | |
| status | enum | mand | spec/S-BAY | Draft/Pending/Active/Notice/Exited (BAY: ACTIVE/ON_LEAVE/NOTICE_PERIOD/TERMINATED) |
| current position | via PositionAssignment | — | — | not a column |

## EmployeeCompliance (UAE — HR-only, 1:1 with Employee)  ← from S-REN, richest
| group | fields | source |
|---|---|---|
| Visa | visa_number, visa_type, visa_status, visa_issue_date, **visa_expiry_date**, visa_sponsor | S-REN/S-BAY |
| Emirates ID | emirates_id_number, emirates_id_issue_date, **emirates_id_expiry**, emirates_id_status | S-REN/S-BAY |
| Passport | passport_number, **passport_expiry** | S-BAY |
| Medical fitness | date, **expiry**, status, location | S-REN |
| ILOE (UAE unemployment ins.) | policy_number, status, provider, start, **expiry** | S-REN |
| Medical insurance | number, provider, category, start, **expiry** | S-REN/S-AZ |
| Contract | contract_type (UNLIMITED/LIMITED), contract_number, contract_start, contract_end | S-BAY/S-REN |
| Other | security_clearance | S-AZ |

> All **expiry** fields feed the compliance-alert view (see Findings #1).

## EmployeeBank (restricted; employee-entered, admin-verified)  ← S-REN
bank_name, bank_branch, account_holder_name, account_number, iban, swift_code,
currency (default AED), is_verified, verified_by/at, submitted_by/at, effective_date,
notes. *(Pending-change fields `pending_*` + `has_pending_changes` exist in S-REN —
treat as a simple verify flag, NOT an approval workflow.)*

## Compensation (pay record)  ← S-AZ CSV (real UAE structure)
amount components (each int minor units + currency): **basic_salary, housing,
transportation, air_ticket_entitlement, other_allowance, consultancy_fees,
air_fare_allowance, family_air_ticket_allowance** → **net_salary** (computed).
Plus: overtime_type, annual_leave_entitlement (days). Store components in
`components jsonb` or typed columns.

## Leave + LeaveBalance  ← S-BAY (clean), S-AZ (entitlement)
- **LeaveRequest:** type, start_date, end_date, days, paid_flag, status. (S-POP unifies
  requests; we keep Leave as its own CRUD record, no approval engine.)
- **LeaveBalance:** (employee, year, leave_type) unique → allocated, used, balance. ← S-BAY
- Leave types to pre-load: UAE statutory (annual/sick/maternity/...) + unpaid *(Ismael confirms exact set — open decision #2)*.

## Document / Template  ← S-REN (18 types), S-BAY
- **DocumentType:** passport, visa, emirates_id, work_permit, medical_fitness,
  driving_license, educational, contract, offer_letter, promotion_letter,
  experience_certificate, training_certificate, security_clearance, bank_letter,
  job_description, profile_photo, personal_document, other.  ← S-REN
- **Document:** employee_id, document_type, file_name, file_url, expiry_date,
  status (pending/verified/expired/**expiring_soon**). ← S-REN/S-BAY
- **Template:** name, body, merge fields (snapshot-only vars per spec §6).

## Offboarding (exit record)
employee_id, exit_date, reason, exit fields, **end-of-service gratuity** inputs/calc
*(open decision #1 — lean include)*, frozen exit snapshot. ← spec + S-REN date_of_exit.

## PolicyAcknowledgement, PositionAssignment — per spec §3 (no source change needed).

---

## Fresh-eyes findings — reusable, IN SCOPE (records & reports, no workflows)

1. **Compliance-expiry alert view (HIGH VALUE, trivial).** All three serious repos
   independently built this (S-BAY `ComplianceAlert`, S-AZ alert view with
   `days_until_expiry`, S-REN `EXPIRING_SOON`). It is just a **SELECT over expiry
   dates** (visa/EID/passport/medical-fitness/ILOE/insurance/contract) → "expiring in
   ≤30/60/90 days." Pure report, fits the guardrail perfectly, and is *the* daily-value
   feature for a UAE fractional-HR service (missed renewals = fines/illegal status).
   **Recommend adding as a derived view + a line on the dashboard.** Net-new effort: tiny.

2. **UAE compliance fields are now concrete** (visa/EID/medical-fitness/**ILOE**/
   insurance/contract) — replaces the spec's hand-wavy "documents (visa/EID + expiry)".
   ILOE (mandatory UAE unemployment insurance) is a real field you tracked; easy to keep.

3. **Real salary structure** (basic/housing/transport/air-ticket/allowances → net) —
   use these as Compensation components instead of a single `amount`.

4. **Bank-details verify flag** (`is_verified` + `submitted_by`/`verified_by`) — a
   field-level state, not a workflow. Satisfies "employee submits, admin verifies"
   without an approval engine.

5. **Probation eval dates (1/3/6-month)** — cheap onboarding-completeness fields you
   already used; good for the Employee record + a "probation due" report.

6. **LeaveBalance shape** (employee×year×type → allocated/used/balance) — adopt as-is.

## Found but DELIBERATELY OUT OF SCOPE (drift guard — flagged, not built)
Approval routing / unified requests (S-POP), grievances, disciplinary cases, acting-MD
delegation, suggestions (S-POP); recruitment/ATS — candidates, interviews, slots
(S-DP, S-BAY); time & attendance clock-in (S-BAY); notifications engine; reimbursement
*with approval*. All real, but they are workflow/approval-driven or outside the 7-module
product. The guardrail (spec §11) rejects them for now. Listed so the decision is conscious.
