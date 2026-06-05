# Fix Plan — Next Steps

1. **Eliminate non-event position truth path**
   - Add position events for create/update/delete and rebuild `positions_current` strictly from replay output.
   - Remove/disable direct projection-derived mutation paths that bypass `org_events`.

2. **Refactor projection repair to event-based recovery**
   - Replace direct table patching in projection-integrity-service with replay job intents + event emission.
   - Enforce single-shot repair idempotency guard to stop repair loops.

3. **Isolate quarantine from replay/repair side effects**
   - Quarantine detect should flag/block only.
   - Move replay/recovery into explicit operator-triggered flow with separate command path and audit trail.

4. **Complete legacy truth migration**
   - Remove active `people.position_id` structural dependency or mark read-only deprecated with migration plan.

5. **Re-run global assertion gate**
   - Recompute `replay(org_events) == current_database_state` across all audited entities and organizations.
