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

2. **Accept core module spine**
   - Org Map, Actions, Team Directory remain core.
   - Status: Accepted

3. **Keep policies attached to teams/owners**
   - Avoid expanding into standalone policy platform behavior.
   - Status: Accepted

4. **Keep administration and payroll export minimal**
   - Not strategic differentiators; retain as supporting utility.
   - Status: Accepted

5. **Do not promote inferred modules**
   - No standalone Ownership Registry module yet.
   - No organizational change tracking module yet.
   - No approval workflow expansion yet.
   - Status: Accepted

6. **Do not lock ICP to "remote Series A"**
   - Treat as sample-biased hypothesis pending primary interviews.
   - Status: Accepted

### Operating rule reaffirmed

Any new feature must show:
1. User problem
2. Existing workflow affected
3. Why current modules cannot solve it
4. Revenue impact
5. Scope impact

If these are not answered with evidence, reject or defer.
