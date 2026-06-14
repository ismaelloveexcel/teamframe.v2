# Determinism Root Cause Analysis

Result: **FAIL**

## Primary Root Cause
- Projection mutation bypass exists and direct state writes are not fully event-sourced.

## Secondary Causes
- Replay/live divergence persists in multiple projections across organizations.
- Quarantine service triggers replay side effects during detection/recovery flow.
- Projection repair uses direct table patching (state mutation) instead of pure event-driven correction.
- Legacy people.position_id column remains active in schema, increasing migration drift risk.

## Determinism Checks
- Determinism: FAIL
- Replay Purity: PASS
- Mutation Safety: FAIL
- Quarantine Isolation: FAIL
