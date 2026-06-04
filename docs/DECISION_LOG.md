# TeamFrame Decision Log

## 2026-06-04 — Manus evidence audit interpretation

### Context

Reviewed:
- `teamframe_report_37b4.md`
- `teamframe_evidence_dataset_f9cf.csv`

The dataset was useful but not fully decision-grade:
- 28 rows (below target)
- heavy dependence on directory aggregators
- mostly medium/low confidence
- incomplete schema coverage against requested fields

### Decisions

1. **Accept core thesis**
   - TeamFrame focuses on organizational visibility, ownership clarity, accountability, and coordination.
   - Status: Accepted

2. **Accept core product spine**
   - Org Map and Actions remain core.
   - Team Directory is treated as a structural capability produced by the org model, not a standalone product wedge.
   - Status: Accepted

3. **Keep policies attached to teams/owners**
   - Avoid expanding into standalone policy platform behavior.
   - Status: Accepted

4. **Keep administration and payroll export minimal**
   - Not strategic differentiators; retain as supporting utility.
   - Status: Accepted

5. **Do not promote inferred modules**
   - No standalone Ownership Registry module (ownership should emerge across team/role/action/policy surfaces).
   - No organizational change tracking module yet.
   - No approval workflow expansion yet.
   - Status: Accepted

6. **Do not lock ICP to "remote Series A"**
   - Treat as sample-biased hypothesis pending primary interviews.
   - Status: Accepted

## 2026-06-04 — Validation matrix operating update

### Decision

Adopt a standing validation matrix for roadmap control with fields:
- Capability
- Evidence level
- Build status
- Validation method

### Initial classification

- Org Map: High evidence, Build
- Actions: Medium-High evidence, Build
- Team Directory: Medium evidence, Build as structural capability
- Team-linked Policies: Medium evidence, Build Minimal
- Administration: Low evidence, Minimal
- Payroll Export: Low evidence, Utility Only
- Ownership Registry: Low evidence, Defer
- Change Tracking: Low evidence, Defer

### Operating rule reaffirmed

Any new feature must show:
1. User problem
2. Existing workflow affected
3. Why current modules cannot solve it
4. Revenue impact
5. Scope impact

If these are not answered with evidence, reject or defer.
