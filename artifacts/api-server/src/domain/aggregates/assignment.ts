import { InvariantViolationError, type EventEnvelope } from "../event-core";

export type AssignmentStatus = "active" | "scheduled" | "ended" | "cancelled";

export type AssignmentTimeline = {
  assignmentId: string;
  positionId: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: AssignmentStatus;
  streamVersion: number;
};

export function deriveAssignments(events: EventEnvelope[]): AssignmentTimeline[] {
  const assignmentEvents = events
    .filter((event) => event.aggregateType === "assignment")
    .sort((a, b) => {
      const byOccurredAt = a.occurredAt.localeCompare(b.occurredAt);
      if (byOccurredAt !== 0) return byOccurredAt;
      const byVersion = a.version - b.version;
      if (byVersion !== 0) return byVersion;
      const byAggregateId = a.aggregateId.localeCompare(b.aggregateId);
      if (byAggregateId !== 0) return byAggregateId;
      const byEventType = a.eventType.localeCompare(b.eventType);
      if (byEventType !== 0) return byEventType;
      return stablePayloadOrderKey(a).localeCompare(stablePayloadOrderKey(b));
    });

  const map = new Map<string, AssignmentTimeline>();

  for (const event of assignmentEvents) {
    if (event.eventType === "assignment.started") {
      const payload = event.payload as Record<string, unknown>;
      const assignmentId = String(payload.assignmentId);
      map.set(assignmentId, {
        assignmentId,
        positionId: String(payload.positionId),
        employeeId: String(payload.employeeId),
        effectiveFrom: String(payload.effectiveFrom),
        effectiveTo:
          payload.effectiveTo === null || payload.effectiveTo === undefined
            ? null
            : String(payload.effectiveTo),
        status: "active",
        streamVersion: event.version,
      });
      continue;
    }

    if (event.eventType === "assignment.ended") {
      const payload = event.payload as Record<string, unknown>;
      const assignmentId = String(payload.assignmentId);
      const existing = map.get(assignmentId);
      if (!existing) continue;
      map.set(assignmentId, {
        ...existing,
        status: "ended",
        effectiveTo:
          payload.effectiveTo === null || payload.effectiveTo === undefined
            ? existing.effectiveTo
            : String(payload.effectiveTo),
        streamVersion: event.version,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.assignmentId.localeCompare(b.assignmentId));
}

export function isAssignmentActive(assignment: AssignmentTimeline, nowIso: string): boolean {
  const now = new Date(nowIso).getTime();
  const from = new Date(assignment.effectiveFrom).getTime();
  const to = assignment.effectiveTo ? new Date(assignment.effectiveTo).getTime() : null;
  if (Number.isNaN(now) || Number.isNaN(from)) return false;
  const inWindow = from <= now && (to === null || to > now);
  return inWindow && assignment.status === "active";
}

export function assertSingleActiveAssignmentPerPosition(
  assignments: AssignmentTimeline[],
  nowIso: string,
): void {
  const activeByPosition = new Map<string, string>();
  for (const assignment of assignments) {
    if (!isAssignmentActive(assignment, nowIso)) continue;
    const existing = activeByPosition.get(assignment.positionId);
    if (existing) {
      throw new InvariantViolationError(
        `Position ${assignment.positionId} has multiple active assignments (${existing}, ${assignment.assignmentId}).`,
      );
    }
    activeByPosition.set(assignment.positionId, assignment.assignmentId);
  }
}

export function assertNoEmployeeOverlap(
  assignments: AssignmentTimeline[],
  nowIso: string,
  maxActiveSeatsPerEmployee = 1,
): void {
  const activeCounts = new Map<string, number>();
  for (const assignment of assignments) {
    if (!isAssignmentActive(assignment, nowIso)) continue;
    const next = (activeCounts.get(assignment.employeeId) ?? 0) + 1;
    if (next > maxActiveSeatsPerEmployee) {
      throw new InvariantViolationError(
        `Employee ${assignment.employeeId} exceeds active seat limit (${maxActiveSeatsPerEmployee}).`,
      );
    }
    activeCounts.set(assignment.employeeId, next);
  }
}

export function buildAssignmentStartedEvent(input: {
  orgId: string;
  actorId: string;
  idempotencyKey: string;
  assignmentId: string;
  positionId: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}): EventEnvelope {
  return {
    orgId: input.orgId,
    aggregateType: "assignment",
    aggregateId: input.assignmentId,
    eventType: "assignment.started",
    version: 0,
    occurredAt: new Date().toISOString(),
    actorId: input.actorId,
    idempotencyKey: input.idempotencyKey,
    schemaVersion: 1,
    payload: {
      assignmentId: input.assignmentId,
      positionId: input.positionId,
      employeeId: input.employeeId,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo ?? null,
    },
    payloadHash: "",
  };
}

export function buildAssignmentEndedEvent(input: {
  orgId: string;
  actorId: string;
  idempotencyKey: string;
  assignmentId: string;
  effectiveTo: string;
}): EventEnvelope {
  return {
    orgId: input.orgId,
    aggregateType: "assignment",
    aggregateId: input.assignmentId,
    eventType: "assignment.ended",
    version: 0,
    occurredAt: new Date().toISOString(),
    actorId: input.actorId,
    idempotencyKey: input.idempotencyKey,
    schemaVersion: 1,
    payload: {
      assignmentId: input.assignmentId,
      effectiveTo: input.effectiveTo,
    },
    payloadHash: "",
  };
}

export function buildTransferEvents(input: {
  orgId: string;
  actorId: string;
  idempotencyKey: string;
  fromAssignmentId: string;
  toAssignmentId: string;
  toPositionId: string;
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string;
}): EventEnvelope[] {
  return [
    buildAssignmentEndedEvent({
      orgId: input.orgId,
      actorId: input.actorId,
      idempotencyKey: `${input.idempotencyKey}-end`,
      assignmentId: input.fromAssignmentId,
      effectiveTo: input.effectiveTo,
    }),
    buildAssignmentStartedEvent({
      orgId: input.orgId,
      actorId: input.actorId,
      idempotencyKey: `${input.idempotencyKey}-start`,
      assignmentId: input.toAssignmentId,
      positionId: input.toPositionId,
      employeeId: input.employeeId,
      effectiveFrom: input.effectiveFrom,
    }),
  ];
}


function stablePayloadOrderKey(event: EventEnvelope): string {
  const payload = event.payload as Record<string, unknown>;
  const assignmentId = payload.assignmentId;
  return typeof assignmentId === "string" ? assignmentId : event.aggregateId;
}
