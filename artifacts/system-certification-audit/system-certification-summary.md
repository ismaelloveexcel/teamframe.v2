# TeamFrame System Certification Audit

Result: **FAIL**

## Section Results
- A Event Authority: PASS
- B Replay Determinism: FAIL
- C Quarantine Isolation: PASS
- D Repair Safety: FAIL
- E Outbox Recovery: FAIL
- F Failure Injection: FAIL
- G Legacy Truth Surface: PASS
- H Global Determinism: FAIL

## Findings
- [B] Replay determinism mismatch detected in one or more organizations.
- [D] No projection.repair.requested event persisted at runtime.
- [D] Repair flow did not converge replay/live state.
- [D] Runtime repair execution failed: Failed query: insert into "org_events" ("id", "org_id", "aggregate_type", "aggregate_id", "event_type", "version", "occurred_at", "actor_user_id", "correlation_id", "causation_id", "idempotency_key", "schema_version", "payload", "payload_hash") values (default, $1, $2, $3, $4, $5, default, $6, default, default, $7, $8, $9, default) returning "id", "org_id", "aggregate_type", "aggregate_id", "event_type", "version", "occurred_at", "actor_user_id", "correlation_id", "causation_id", "idempotency_key", "schema_version", "payload", "payload_hash"
params: b8244e7d-764b-4e9f-b50e-942f256dfd99,system,projection:evidenceByAssignmentHash,projection.repair.requested,1,system,projection-repair-evidenceByAssignmentHash-526e4f30-a3a3-4fa0-a194-b3043754ce75,1,{"projectionName":"evidenceByAssignmentHash","liveHash":"2d097de9ed6c9465b02092f4379340fd0b17ab562a6d53020641f5bfd28b6454","replayedHash":"9cef2d3a98442b0d1b3ab127ce92533d430d0dde5b948ba4fe9dc64eb39f8e8e","reason":"drift_detected"}
- [E] Replay/live mismatch after outbox recovery scenarios.
- [F] Failed query: insert into "person_position_assignments" ("id", "organization_id", "person_id", "position_id", "started_at", "ended_at", "status", "created_at", "updated_at") values ($1, $2, $3, $4, $5, $6, $7, default, $8) on conflict ("id") do update set "organization_id" = $9, "person_id" = $10, "position_id" = $11, "started_at" = $12, "ended_at" = $13, "status" = $14, "updated_at" = $15
params: failure-gap-52e6be90-c6ce-429c-aebd-605f1ee6eae2,1568ed1f-a5bf-4ab9-b3f3-1b446932781e,557f6586-81b3-4afd-8e09-e0be9c33c620,5a4c3b2f-7371-4e58-a1fa-87a87e525138,2025-01-01T00:00:00.000Z,,active,2026-06-05T09:33:51.905Z,1568ed1f-a5bf-4ab9-b3f3-1b446932781e,557f6586-81b3-4afd-8e09-e0be9c33c620,5a4c3b2f-7371-4e58-a1fa-87a87e525138,2025-01-01T00:00:00.000Z,,active,2026-06-05T09:33:51.905Z
- [H] One or more organizations failed global hash determinism.
