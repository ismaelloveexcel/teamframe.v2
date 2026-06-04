import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNoEmployeeOverlap,
  assertPositionTreeIsAcyclic,
  assertSingleActiveAssignmentPerPosition,
  applyReparent,
  buildPositionGraph,
  buildTransferEvents,
  deriveAssignments,
  type PositionNode,
} from "../../index";
import { InvariantViolationError, stableHash, type EventEnvelope } from "../../event-core";

const NOW = "2026-06-01T00:00:00.000Z";

function withVersion(events: EventEnvelope[]): EventEnvelope[] {
  return events.map((event, index) => ({
    ...event,
    version: index + 1,
    payloadHash: stableHash(event.payload),
  }));
}

test("Phase 2 gate: reparent maintains acyclic tree integrity", () => {
  const graph = buildPositionGraph([
    { id: "ceo", reportsToId: null, order: 0 },
    { id: "ops-head", reportsToId: "ceo", order: 1 },
    { id: "ops-manager", reportsToId: "ops-head", order: 2 },
  ] satisfies PositionNode[]);

  const next = applyReparent(graph, "ops-manager", "ceo");
  assert.equal(next.get("ops-manager")?.reportsToId, "ceo");
  assert.doesNotThrow(() => assertPositionTreeIsAcyclic(next));

  assert.throws(
    () => applyReparent(next, "ceo", "ops-manager"),
    (error: unknown) => error instanceof InvariantViolationError,
  );
});

test("Phase 2 gate: no position can have more than one active assignment", () => {
  const duplicateActiveAssignments = [
    {
      aggregateType: "assignment",
      aggregateId: "asg-1",
      eventType: "assignment.started",
      payload: {
        assignmentId: "asg-1",
        positionId: "position-1",
        employeeId: "person-1",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
    },
    {
      aggregateType: "assignment",
      aggregateId: "asg-2",
      eventType: "assignment.started",
      payload: {
        assignmentId: "asg-2",
        positionId: "position-1",
        employeeId: "person-2",
        effectiveFrom: "2026-01-02T00:00:00.000Z",
      },
    },
  ].map((entry, index) => ({
    orgId: "org-1",
    aggregateType: entry.aggregateType,
    aggregateId: entry.aggregateId,
    eventType: entry.eventType,
    version: index + 1,
    occurredAt: `2026-01-0${index + 1}T00:00:00.000Z`,
    actorId: "actor-1",
    idempotencyKey: `seed-${index + 1}`,
    schemaVersion: 1,
    payload: entry.payload,
    payloadHash: stableHash(entry.payload),
  })) as EventEnvelope[];

  const assignments = deriveAssignments(duplicateActiveAssignments);
  assert.throws(
    () => assertSingleActiveAssignmentPerPosition(assignments, NOW),
    (error: unknown) => error instanceof InvariantViolationError,
  );
});

test("Phase 2 gate: transfer emits end+start and keeps occupancy deterministic", () => {
  const seeded = withVersion([
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: "asg-1",
      eventType: "assignment.started",
      version: 0,
      occurredAt: "2026-02-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "seed-transfer-start",
      schemaVersion: 1,
      payload: {
        assignmentId: "asg-1",
        positionId: "position-1",
        employeeId: "person-1",
        effectiveFrom: "2026-02-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
  ]);

  const transferEvents = withVersion(
    buildTransferEvents({
      orgId: "org-1",
      actorId: "actor-1",
      idempotencyKey: "transfer-1",
      fromAssignmentId: "asg-1",
      toAssignmentId: "asg-2",
      toPositionId: "position-2",
      employeeId: "person-1",
      effectiveFrom: "2026-02-10T00:00:00.000Z",
      effectiveTo: "2026-02-10T00:00:00.000Z",
    }),
  );

  assert.equal(transferEvents.length, 2);
  assert.equal(transferEvents[0]?.eventType, "assignment.ended");
  assert.equal(transferEvents[1]?.eventType, "assignment.started");

  const replayed = deriveAssignments([...seeded, ...transferEvents]);
  assert.equal(replayed.find((assignment) => assignment.assignmentId === "asg-1")?.status, "ended");
  assert.equal(replayed.find((assignment) => assignment.assignmentId === "asg-2")?.status, "active");
  assert.doesNotThrow(() => assertSingleActiveAssignmentPerPosition(replayed, NOW));
  assert.doesNotThrow(() => assertNoEmployeeOverlap(replayed, NOW, 1));
});


test("Phase 2 gate: employee overlap invariant rejects concurrent active seats", () => {
  const events = [
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: "asg-10",
      eventType: "assignment.started",
      version: 1,
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "overlap-1",
      schemaVersion: 1,
      payload: {
        assignmentId: "asg-10",
        positionId: "position-a",
        employeeId: "person-z",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: "asg-11",
      eventType: "assignment.started",
      version: 2,
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "overlap-2",
      schemaVersion: 1,
      payload: {
        assignmentId: "asg-11",
        positionId: "position-b",
        employeeId: "person-z",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
  ] as EventEnvelope[];

  const replayed = deriveAssignments(events.map((event) => ({ ...event, payloadHash: stableHash(event.payload) })));

  assert.throws(
    () => assertNoEmployeeOverlap(replayed, NOW, 1),
    (error: unknown) => error instanceof InvariantViolationError,
  );
});

test("Phase 2 gate: replay ordering remains deterministic", () => {
  const seededEvents = withVersion([
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: "asg-1",
      eventType: "assignment.started",
      version: 0,
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "evt-1",
      schemaVersion: 1,
      payload: {
        assignmentId: "asg-1",
        positionId: "position-1",
        employeeId: "person-1",
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: "asg-1",
      eventType: "assignment.ended",
      version: 0,
      occurredAt: "2026-02-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "evt-2",
      schemaVersion: 1,
      payload: {
        assignmentId: "asg-1",
        effectiveTo: "2026-02-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
  ]);

  const resultA = deriveAssignments(seededEvents);
  const resultB = deriveAssignments(seededEvents);
  assert.deepEqual(resultA, resultB);
});

