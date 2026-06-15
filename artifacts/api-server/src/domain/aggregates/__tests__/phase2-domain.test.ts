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
  type AssignmentTimeline,
  type PositionNode,
} from "../../index";
import { InvariantViolationError, stableHash, type EventEnvelope } from "../../event-core";
import { uid } from "./uuid-fixture";

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
  // Construct AssignmentTimeline[] directly to test the invariant guard.
  // deriveAssignments() itself deduplicates, so we must bypass it here to
  // verify that assertSingleActiveAssignmentPerPosition detects the violation.
  const duplicateActiveAssignments: AssignmentTimeline[] = [
    {
      assignmentId: uid("asg-1"),
      positionId: uid("position-1"),
      employeeId: uid("person-1"),
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      status: "active",
      streamVersion: 1,
    },
    {
      assignmentId: uid("asg-2"),
      positionId: uid("position-1"),
      employeeId: uid("person-2"),
      effectiveFrom: "2026-01-02T00:00:00.000Z",
      effectiveTo: null,
      status: "active",
      streamVersion: 2,
    },
  ];

  assert.ok(duplicateActiveAssignments.length > 0, "fixture is empty — check test setup");
  assert.throws(
    () => assertSingleActiveAssignmentPerPosition(duplicateActiveAssignments, NOW),
    (error: unknown) => error instanceof InvariantViolationError,
  );
});

test("Phase 2 gate: transfer emits end+start and keeps occupancy deterministic", () => {
  const seeded = withVersion([
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: uid("asg-1"),
      eventType: "assignment.started",
      version: 0,
      occurredAt: "2026-02-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "seed-transfer-start",
      schemaVersion: 1,
      payload: {
        assignmentId: uid("asg-1"),
        positionId: uid("position-1"),
        employeeId: uid("person-1"),
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
      fromAssignmentId: uid("asg-1"),
      toAssignmentId: uid("asg-2"),
      toPositionId: uid("position-2"),
      employeeId: uid("person-1"),
      effectiveFrom: "2026-02-10T00:00:00.000Z",
      effectiveTo: "2026-02-10T00:00:00.000Z",
    }),
  );

  assert.equal(transferEvents.length, 2);
  assert.equal(transferEvents[0]?.eventType, "assignment.ended");
  assert.equal(transferEvents[1]?.eventType, "assignment.started");

  const replayed = deriveAssignments([...seeded, ...transferEvents]);
  assert.ok(replayed.length > 0, "derivation dropped all events — check fixture UUIDs");
  assert.equal(replayed.find((assignment) => assignment.assignmentId === uid("asg-1"))?.status, "ended");
  assert.equal(replayed.find((assignment) => assignment.assignmentId === uid("asg-2"))?.status, "active");
  assert.doesNotThrow(() => assertSingleActiveAssignmentPerPosition(replayed, NOW));
  assert.doesNotThrow(() => assertNoEmployeeOverlap(replayed, NOW, 1));
});


test("Phase 2 gate: employee overlap invariant rejects concurrent active seats", () => {
  // Construct AssignmentTimeline[] directly to test the invariant guard.
  // deriveAssignments() itself deduplicates overlapping employees, so we must
  // bypass it here to verify assertNoEmployeeOverlap detects the violation.
  const overlappingAssignments: AssignmentTimeline[] = [
    {
      assignmentId: uid("asg-10"),
      positionId: uid("position-a"),
      employeeId: uid("person-z"),
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      status: "active",
      streamVersion: 1,
    },
    {
      assignmentId: uid("asg-11"),
      positionId: uid("position-b"),
      employeeId: uid("person-z"),
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      effectiveTo: null,
      status: "active",
      streamVersion: 2,
    },
  ];

  assert.ok(overlappingAssignments.length > 0, "fixture is empty — check test setup");
  assert.throws(
    () => assertNoEmployeeOverlap(overlappingAssignments, NOW, 1),
    (error: unknown) => error instanceof InvariantViolationError,
  );
});

test("Phase 2 gate: replay determinism holds for tie-order inputs", () => {
  const tieA = [
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: uid("asg-a"),
      eventType: "assignment.started",
      version: 1,
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "tie-1",
      schemaVersion: 1,
      payload: {
        assignmentId: uid("asg-a"),
        positionId: uid("pos-a"),
        employeeId: uid("emp-a"),
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: uid("asg-b"),
      eventType: "assignment.started",
      version: 1,
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "tie-2",
      schemaVersion: 1,
      payload: {
        assignmentId: uid("asg-b"),
        positionId: uid("pos-b"),
        employeeId: uid("emp-b"),
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
  ] as EventEnvelope[];

  const tieB = [tieA[1]!, tieA[0]!];
  const resultA = deriveAssignments(tieA.map((event) => ({ ...event, payloadHash: stableHash(event.payload) })));
  const resultB = deriveAssignments(tieB.map((event) => ({ ...event, payloadHash: stableHash(event.payload) })));
  assert.ok(resultA.length > 0, "derivation dropped all events — check fixture UUIDs");
  assert.ok(resultB.length > 0, "derivation dropped all events — check fixture UUIDs");
  assert.deepEqual(resultA, resultB);
});

test("Phase 2 gate: replay ordering remains deterministic", () => {
  const seededEvents = withVersion([
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: uid("asg-1"),
      eventType: "assignment.started",
      version: 0,
      occurredAt: "2026-01-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "evt-1",
      schemaVersion: 1,
      payload: {
        assignmentId: uid("asg-1"),
        positionId: uid("position-1"),
        employeeId: uid("person-1"),
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
    {
      orgId: "org-1",
      aggregateType: "assignment",
      aggregateId: uid("asg-1"),
      eventType: "assignment.ended",
      version: 0,
      occurredAt: "2026-02-01T00:00:00.000Z",
      actorId: "actor-1",
      idempotencyKey: "evt-2",
      schemaVersion: 1,
      payload: {
        assignmentId: uid("asg-1"),
        effectiveTo: "2026-02-01T00:00:00.000Z",
      },
      payloadHash: "",
    },
  ]);

  const resultA = deriveAssignments(seededEvents);
  const resultB = deriveAssignments(seededEvents);
  assert.ok(resultA.length > 0, "derivation dropped all events — check fixture UUIDs");
  assert.deepEqual(resultA, resultB);
});
