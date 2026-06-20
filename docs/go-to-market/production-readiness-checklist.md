# Production Readiness Checklist

Complete this at the end of Week 2. Every item must pass before outreach begins.

Do not ask "does it feel ready?" Ask each question and record the result.

---

## Checklist

| Requirement | Pass / Fail | Notes |
|---|---|---|
| Can onboard a 25-person company from zero | | |
| Can model reporting structure accurately | | |
| Can create and manage positions | | |
| Can assign people to positions | | |
| Can process role changes (title, reporting line, department) | | |
| Can record a person leaving and vacate their position | | |
| Can add a new hire and assign them to a role | | |
| Can produce a written org health summary from system state | | |
| Can identify missing documentation per position | | |
| Can explain every screen to a non-technical person in under 60 seconds | | |
| No critical data-loss bugs discovered during simulation | | |
| Document storage hybrid works (TeamFrame status + Google Drive files) | | |
| Async communication workflow tested and documented | | |

---

## Simulation Scenarios (run all before scoring the checklist)

These test the system under change, not just at rest.

| Scenario | Completed | Issues found |
|---|---|---|
| New hire joins — role created, person assigned | | |
| Employee leaves — assignment ended, position vacated | | |
| Manager changes — reporting line updated across affected positions | | |
| New position created mid-month | | |
| Position frozen (role no longer active) | | |
| Missing document identified and flagged | | |
| JD drafted, moved to in-review, then signed | | |
| Role change processed (same person, new title or department) | | |
| Org health summary generated after all changes applied | | |

---

## Scoring Rule

**All checklist items must pass.**

If any item fails:
1. Decide whether it is trust-destroying (client would lose confidence or data) or just friction (inconvenient but workable).
2. Fix trust-destroying issues only.
3. Document friction issues on the gap list — do not fix them now.
4. Re-run the specific scenario that failed.
5. Mark pass only when it completes without workaround.

---

## Gap List (record all workarounds here)

| Gap | Severity (trust-destroying / friction) | Fix or workaround |
|---|---|---|
| | | |

---

## Sign-off

When all checklist items pass:

- [ ] Date completed:
- [ ] Product is frozen. No feature work until 3 paying clients exist.
- [ ] Outreach materials phase begins.
