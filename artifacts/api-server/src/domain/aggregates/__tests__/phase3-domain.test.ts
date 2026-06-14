import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveCompensationCurrentByAssignment,
  deriveCompensationRecordsFromEvents,
  deriveDocumentSnapshotsFromEvents,
  deriveEvidenceStatusByAssignment,
  deriveRequirementRulesFromEvents,
} from "../../index";
import { stableHash, type EventEnvelope } from "../../event-core";

function event(input: Partial<EventEnvelope> & Pick<EventEnvelope, "eventType" | "aggregateType" | "aggregateId">): EventEnvelope {
  const payload = (input.payload ?? {}) as Record<string, unknown>;
  return {
    orgId: "org-1",
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    eventType: input.eventType,
    version: input.version ?? 1,
    occurredAt: input.occurredAt ?? "2026-01-01T00:00:00.000Z",
    actorId: input.actorId ?? "actor-1",
    idempotencyKey: input.idempotencyKey ?? `idem-${input.aggregateId}-${input.eventType}`,
    schemaVersion: 1,
    payload,
    payloadHash: stableHash(payload),
  };
}

test("Phase 3 gate: replay determinism remains stable across event ordering", () => {
  const ordered: EventEnvelope[] = [
    event({
      aggregateType: "assignment",
      aggregateId: "asg-1",
      eventType: "assignment.started",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: {
        assignmentId: "asg-1",
        positionId: "pos-1",
        employeeId: "person-1",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    }),
    event({
      aggregateType: "position",
      aggregateId: "pos-1",
      eventType: "evidence.profile.upserted",
      occurredAt: "2026-01-01T00:00:01.000Z",
      payload: {
        positionId: "pos-1",
        requirements: [
          { requirementKey: "id_document", isRequired: true },
          { requirementKey: "nda", isRequired: true },
        ],
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-1",
      eventType: "document.uploaded",
      occurredAt: "2026-01-01T00:00:02.000Z",
      payload: {
        documentId: "doc-1",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "id_document",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-1",
      eventType: "document.signed",
      occurredAt: "2026-01-01T00:00:03.000Z",
      payload: {
        documentId: "doc-1",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "id_document",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-2",
      eventType: "document.uploaded",
      occurredAt: "2026-01-01T00:00:04.000Z",
      payload: {
        documentId: "doc-2",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "nda",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-2",
      eventType: "document.signed",
      occurredAt: "2026-01-01T00:00:05.000Z",
      payload: {
        documentId: "doc-2",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "nda",
      },
    }),
  ];

  const shuffled = [ordered[2]!, ordered[0]!, ordered[5]!, ordered[3]!, ordered[1]!, ordered[4]!];

  const resultA = deriveEvidenceStatusByAssignment({
    requirementRules: deriveRequirementRulesFromEvents(ordered),
    documentSnapshots: deriveDocumentSnapshotsFromEvents(ordered),
    events: ordered,
  });
  const resultB = deriveEvidenceStatusByAssignment({
    requirementRules: deriveRequirementRulesFromEvents(shuffled),
    documentSnapshots: deriveDocumentSnapshotsFromEvents(shuffled),
    events: shuffled,
  });

  assert.deepEqual(resultA, resultB);
  assert.equal(resultA[0]?.status, "compliant");
});

test("Phase 3 gate: profile evolution preserves historical replay", () => {
  const beforeEvolution: EventEnvelope[] = [
    event({
      aggregateType: "assignment",
      aggregateId: "asg-1",
      eventType: "assignment.started",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: {
        assignmentId: "asg-1",
        positionId: "pos-1",
        employeeId: "person-1",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    }),
    event({
      aggregateType: "position",
      aggregateId: "pos-1",
      eventType: "evidence.profile.upserted",
      occurredAt: "2026-01-01T00:00:01.000Z",
      payload: {
        positionId: "pos-1",
        requirements: [{ requirementKey: "nda", isRequired: true }],
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-1",
      eventType: "document.uploaded",
      occurredAt: "2026-01-01T00:00:02.000Z",
      payload: {
        documentId: "doc-1",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "nda",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-1",
      eventType: "document.signed",
      occurredAt: "2026-01-01T00:00:03.000Z",
      payload: {
        documentId: "doc-1",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "nda",
      },
    }),
  ];

  const afterEvolution: EventEnvelope[] = [
    ...beforeEvolution,
    event({
      aggregateType: "position",
      aggregateId: "pos-1",
      eventType: "evidence.profile.upserted",
      occurredAt: "2026-01-01T00:00:04.000Z",
      payload: {
        positionId: "pos-1",
        requirements: [
          { requirementKey: "nda", isRequired: true },
          { requirementKey: "background_check", isRequired: true },
        ],
      },
    }),
  ];

  const replayBefore = deriveEvidenceStatusByAssignment({
    requirementRules: deriveRequirementRulesFromEvents(beforeEvolution),
    documentSnapshots: deriveDocumentSnapshotsFromEvents(beforeEvolution),
    events: beforeEvolution,
  });
  const replayAfter = deriveEvidenceStatusByAssignment({
    requirementRules: deriveRequirementRulesFromEvents(afterEvolution),
    documentSnapshots: deriveDocumentSnapshotsFromEvents(afterEvolution),
    events: afterEvolution,
  });

  assert.equal(replayBefore[0]?.status, "compliant");
  assert.equal(replayAfter[0]?.status, "missing");
});

test("Phase 3 gate: document lifecycle transitions derive non-compliant states", () => {
  const events: EventEnvelope[] = [
    event({
      aggregateType: "assignment",
      aggregateId: "asg-1",
      eventType: "assignment.started",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: {
        assignmentId: "asg-1",
        positionId: "pos-1",
        employeeId: "person-1",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    }),
    event({
      aggregateType: "position",
      aggregateId: "pos-1",
      eventType: "evidence.profile.upserted",
      occurredAt: "2026-01-01T00:00:01.000Z",
      payload: {
        positionId: "pos-1",
        requirements: [
          { requirementKey: "id_document", isRequired: true },
          { requirementKey: "background_check", isRequired: true },
        ],
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-1",
      eventType: "document.uploaded",
      occurredAt: "2026-01-01T00:00:02.000Z",
      payload: {
        documentId: "doc-1",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "id_document",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-1",
      eventType: "document.signed",
      occurredAt: "2026-01-01T00:00:03.000Z",
      payload: {
        documentId: "doc-1",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "id_document",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-1",
      eventType: "document.expired",
      occurredAt: "2026-01-01T00:00:04.000Z",
      payload: {
        documentId: "doc-1",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "id_document",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-2",
      eventType: "document.uploaded",
      occurredAt: "2026-01-01T00:00:05.000Z",
      payload: {
        documentId: "doc-2",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "background_check",
      },
    }),
    event({
      aggregateType: "document",
      aggregateId: "doc-2",
      eventType: "document.revoked",
      occurredAt: "2026-01-01T00:00:06.000Z",
      payload: {
        documentId: "doc-2",
        assignmentId: "asg-1",
        positionId: "pos-1",
        requirementKey: "background_check",
      },
    }),
  ];

  const replay = deriveEvidenceStatusByAssignment({
    requirementRules: deriveRequirementRulesFromEvents(events),
    documentSnapshots: deriveDocumentSnapshotsFromEvents(events),
    events,
  });

  assert.equal(replay[0]?.status, "non_compliant");
  assert.equal(replay[0]?.nonCompliantCount, 2);
});

test("Phase 3 gate: compensation audit trail is reconstructable and append-only", () => {
  const events: EventEnvelope[] = [
    event({
      aggregateType: "compensation",
      aggregateId: "cmp-1",
      eventType: "compensation.recorded",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: {
        compensationRecordId: "cmp-1",
        assignmentId: "asg-1",
        sourceDocumentId: "doc-1",
        amount: 10000000,
        currency: "USD",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    }),
    event({
      aggregateType: "compensation",
      aggregateId: "cmp-2",
      eventType: "compensation.recorded",
      occurredAt: "2026-02-01T00:00:00.000Z",
      payload: {
        compensationRecordId: "cmp-2",
        assignmentId: "asg-1",
        sourceDocumentId: "doc-1",
        amount: 12000000,
        currency: "USD",
        effectiveFrom: "2026-02-01T00:00:00.000Z",
      },
    }),
  ];

  const records = deriveCompensationRecordsFromEvents(events);
  const current = deriveCompensationCurrentByAssignment(records).get("asg-1");
  assert.equal(records.length, 2);
  assert.equal(current?.compensationRecordId, "cmp-2");
  assert.equal(current?.amount, 12000000);
});
