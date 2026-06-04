# TeamFrame Pilot Validation Scorecard

Purpose: produce decision-grade evidence after each pilot session.  
Rule: this is a dataset artifact, not meeting notes.

---

## A) Session record (fill once per pilot)

| Field | Value |
|---|---|
| Session date | [YYYY-MM-DD] |
| Company | [company_name] |
| Sponsor | [name + role] |
| Operator | [name] |
| Tier | [A / B] |
| Org complexity | [small / medium / high] |
| Onboarding time (minutes) | [number] |
| Clarity test time (minutes) | [number] |
| Clarity success | [yes / no / partial] |
| Conversion likelihood | [low / medium / high] |

---

## B) Core metrics (clarity emergence)

### 1) Time-to-clarity
- Definition: minutes until stakeholder can answer all 4 clarity questions.
- Target: `< 5 minutes`.
- Observed value: [number]
- Result: [pass/fail]

### 2) Ownership completeness ratio
- Formula: `owned_nodes / total_nodes * 100`
- Owned nodes: [number]
- Total nodes: [number]
- Ratio (%): [number]

### 3) Action linkage density
- Formula: `linked_actions / total_actions * 100`
- Linked actions: [number]
- Total actions: [number]
- Density (%): [number]

### 4) Policy comprehension
- Prompt: "Explain where this policy applies and who is accountable."
- Score:
  - 2 = clear explanation with correct scope
  - 1 = partial explanation
  - 0 = unclear or incorrect
- Organization scope score: [0/1/2]
- Team scope score: [0/1/2]
- Position scope score: [0/1/2]
- Total comprehension score: [0-6]

### 5) Friction markers
- Capture only points where user hesitates or asks "what should I do here?"
- Max 3 markers per session.

| Marker # | Screen/Step | User quote or behavior | Severity (L/M/H) |
|---|---|---|---|
| 1 | [screen] | [observation] | [L/M/H] |
| 2 | [screen] | [observation] | [L/M/H] |
| 3 | [screen] | [observation] | [L/M/H] |

---

## C) Commercial signals

| Signal type | Observation |
|---|---|
| Objections raised | [top objections] |
| Pricing resistance signals | [none / mild / strong + notes] |
| Buying trigger observed | [yes/no + trigger detail] |
| Pilot continuation decision | [continue / stop / convert] |

---

## D) Operator verdict (mandatory)

- Top 1 clarity win: [single sentence]
- Top 1 blocking friction: [single sentence]
- Recommended next action: [continue pilot / conversion proposal / disqualify]

---

## E) Anti-drift enforcement check

Confirm all are true:
- [ ] No feature requests accepted during pilot
- [ ] No roadmap discussions committed
- [ ] No custom development promised
- [ ] No architecture justification debate entered

Standard boundary response:
> We are currently validating core operational clarity before expanding scope.
