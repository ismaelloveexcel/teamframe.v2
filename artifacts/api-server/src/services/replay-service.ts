import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  compensationRecordsTable,
  db,
  evidenceStatusByAssignmentTable,
  evidenceStatusByPositionTable,
  orgEventsTable,
  personPositionAssignmentsTable,
  positionsTable,
  replayRunsTable,
} from "@workspace/db";
import {
  deriveAssignments,
  deriveCompensationCurrentByAssignment,
  deriveCompensationRecordsFromEvents,
  deriveDocumentSnapshotsFromEvents,
  deriveEvidenceStatusByAssignment,
  deriveEvidenceStatusByPosition,
  derivePositionsFromEvents,
  deriveRequirementRulesFromEvents,
  stableHash,
  type AggregateType,
  type EventEnvelope,
} from "../domain";

type ProjectionHashes = {
  positionsCurrentHash: string;
  assignmentProjectionHash: string;
  evidenceByAssignmentHash: string;
  evidenceByPositionHash: string;
  compensationCurrentHash: string;
};

type ReplayDiagnostics = {
  continuityErrors: Array<{
    aggregateType: string;
    aggregateId: string;
    expectedVersion: number;
    actualVersion: number;
    eventId: string;
  }>;
  eventCount: number;
};

function toEventEnvelope(row: typeof orgEventsTable.$inferSelect): EventEnvelope {
  return {
    orgId: row.orgId,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    version: row.version,
    occurredAt: row.occurredAt.toISOString(),
    actorId: row.actorUserId ?? "system",
    correlationId: row.correlationId ?? undefined,
    causationId: row.causationId ?? undefined,
    schemaVersion: row.schemaVersion,
    idempotencyKey: row.idempotencyKey,
    payload: row.payload,
    payloadHash: row.payloadHash ?? stableHash(row.payload),
  };
}

function sortRows(rows: Array<typeof orgEventsTable.$inferSelect>) {
  return [...rows].sort((a, b) => {
    const byOccurred = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (byOccurred !== 0) return byOccurred;
    const byAggregateType = a.aggregateType.localeCompare(b.aggregateType);
    if (byAggregateType !== 0) return byAggregateType;
    const byAggregate = a.aggregateId.localeCompare(b.aggregateId);
    if (byAggregate !== 0) return byAggregate;
    const byVersion = a.version - b.version;
    if (byVersion !== 0) return byVersion;
    const byType = a.eventType.localeCompare(b.eventType);
    if (byType !== 0) return byType;
    return a.id.localeCompare(b.id);
  });
}

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function detectContinuityErrors(rows: Array<typeof orgEventsTable.$inferSelect>): ReplayDiagnostics["continuityErrors"] {
  const byAggregate = new Map<string, Array<typeof orgEventsTable.$inferSelect>>();
  for (const row of rows) {
    const key = `${row.aggregateType}:${row.aggregateId}`;
    const list = byAggregate.get(key) ?? [];
    list.push(row);
    byAggregate.set(key, list);
  }

  const errors: ReplayDiagnostics["continuityErrors"] = [];
  for (const [key, aggregateRows] of byAggregate.entries()) {
    const [aggregateType, aggregateId] = key.split(":");
    const sorted = [...aggregateRows].sort((a, b) => a.version - b.version);
    let expected = 1;
    for (const row of sorted) {
      if (row.version !== expected) {
        errors.push({
          aggregateType,
          aggregateId,
          expectedVersion: expected,
          actualVersion: row.version,
          eventId: row.id,
        });
        expected = row.version + 1;
      } else {
        expected += 1;
      }
    }
  }
  return errors;
}

export class ReplayService {
  async loadOrganizationEvents(organizationId: string) {
    const rows = await db.select().from(orgEventsTable).where(eq(orgEventsTable.orgId, organizationId));
    return sortRows(rows);
  }

  async replayAggregate(organizationId: string, aggregateType: AggregateType, aggregateId: string) {
    const runStartedAt = new Date();
    const rows = await db
      .select()
      .from(orgEventsTable)
      .where(
        and(
          eq(orgEventsTable.orgId, organizationId),
          eq(orgEventsTable.aggregateType, aggregateType),
          eq(orgEventsTable.aggregateId, aggregateId),
        ),
      );

    const sortedRows = sortRows(rows);
    const continuityErrors = detectContinuityErrors(sortedRows);
    const events = sortedRows.map(toEventEnvelope);

    const diagnostics: ReplayDiagnostics = {
      continuityErrors,
      eventCount: events.length,
    };

    await db.insert(replayRunsTable).values({
      orgId: organizationId,
      scope: "aggregate",
      aggregateType,
      aggregateId,
      status: continuityErrors.length === 0 ? "succeeded" : "failed",
      diagnostics: {
        eventCount: events.length,
        continuityErrors,
      },
      startedAt: runStartedAt,
      completedAt: new Date(),
    });

    return {
      aggregateType,
      aggregateId,
      events,
      diagnostics,
    };
  }

  async replayOrganization(organizationId: string) {
    const runStartedAt = new Date();
    const rows = await this.loadOrganizationEvents(organizationId);
    const continuityErrors = detectContinuityErrors(rows);
    const events = rows.map(toEventEnvelope);

    const positionsCurrent = derivePositionsFromEvents(events).map((position) => ({
      positionId: position.positionId,
      title: position.title,
      teamId: position.teamId,
      reportsToPositionId: position.reportsToPositionId,
      lifecycleStatus: position.lifecycleStatus,
    }));
    const assignmentTimelines = deriveAssignments(events).map((assignment) => ({
      assignmentId: assignment.assignmentId,
      positionId: assignment.positionId,
      employeeId: assignment.employeeId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
      status: assignment.status,
    }));
    const requirementRules = deriveRequirementRulesFromEvents(events);
    const documentSnapshots = deriveDocumentSnapshotsFromEvents(events);
    const evidenceByAssignment = deriveEvidenceStatusByAssignment({
      requirementRules,
      documentSnapshots,
      events,
    });
    const evidenceByPosition = deriveEvidenceStatusByPosition(evidenceByAssignment);
    const compensationRecords = deriveCompensationRecordsFromEvents(events).map((record) => ({
      compensationRecordId: record.compensationRecordId,
      assignmentId: record.assignmentId,
      sourceDocumentId: record.sourceDocumentId,
      amount: record.amount,
      currency: record.currency,
      effectiveFrom: record.effectiveFrom,
    }));
    const compensationCurrentMap = deriveCompensationCurrentByAssignment(
      deriveCompensationRecordsFromEvents(events),
    );
    const compensationCurrent = [...compensationCurrentMap.values()].map((record) => ({
      assignmentId: record.assignmentId,
      compensationRecordId: record.compensationRecordId,
      sourceDocumentId: record.sourceDocumentId,
      amount: record.amount,
      currency: record.currency,
      effectiveFrom: record.effectiveFrom,
    }));

    const replayed = {
      positionsCurrent: normalizeRows(positionsCurrent),
      assignmentTimelines: normalizeRows(assignmentTimelines),
      evidenceByAssignment: normalizeRows(
        evidenceByAssignment.map((status) => ({
          assignmentId: status.assignmentId,
          positionId: status.positionId,
          status: status.status,
          missingCount: status.missingCount,
          pendingCount: status.pendingCount,
          nonCompliantCount: status.nonCompliantCount,
        })),
      ),
      evidenceByPosition: normalizeRows(
        evidenceByPosition.map((status) => ({
          positionId: status.positionId,
          status: status.status,
          missingCount: status.missingCount,
          pendingCount: status.pendingCount,
          nonCompliantCount: status.nonCompliantCount,
        })),
      ),
      compensationCurrent: normalizeRows(compensationCurrent),
      compensationRecords: normalizeRows(compensationRecords),
    };

    const hashes: ProjectionHashes = {
      positionsCurrentHash: stableHash(replayed.positionsCurrent),
      assignmentProjectionHash: stableHash(replayed.assignmentTimelines),
      evidenceByAssignmentHash: stableHash(replayed.evidenceByAssignment),
      evidenceByPositionHash: stableHash(replayed.evidenceByPosition),
      compensationCurrentHash: stableHash(replayed.compensationCurrent),
    };

    await db.insert(replayRunsTable).values({
      orgId: organizationId,
      scope: "organization",
      status: continuityErrors.length === 0 ? "succeeded" : "failed",
      diagnostics: {
        eventCount: events.length,
        continuityErrors,
        hashes,
      },
      startedAt: runStartedAt,
      completedAt: new Date(),
    });

    return {
      replayed,
      diagnostics: {
        continuityErrors,
        eventCount: events.length,
      } satisfies ReplayDiagnostics,
      hashes,
    };
  }

  async getLiveProjectionState(organizationId: string) {
    const [positions, assignments, evidenceByAssignment, evidenceByPosition, compensationCurrent, compensationRecords] =
      await Promise.all([
        db.select().from(positionsTable).where(eq(positionsTable.organizationId, organizationId)),
        db
          .select()
          .from(personPositionAssignmentsTable)
          .where(eq(personPositionAssignmentsTable.organizationId, organizationId)),
        db
          .select()
          .from(evidenceStatusByAssignmentTable)
          .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId)),
        db
          .select()
          .from(evidenceStatusByPositionTable)
          .where(eq(evidenceStatusByPositionTable.organizationId, organizationId)),
        db
          .select()
          .from(compensationCurrentTable)
          .where(eq(compensationCurrentTable.organizationId, organizationId)),
        db
          .select()
          .from(compensationRecordsTable)
          .where(eq(compensationRecordsTable.organizationId, organizationId)),
      ]);

    const assignmentTimelines = assignments.map((assignment) => ({
      assignmentId: assignment.id,
      positionId: assignment.positionId,
      employeeId: assignment.personId,
      effectiveFrom: assignment.startedAt.toISOString(),
      effectiveTo: assignment.endedAt ? assignment.endedAt.toISOString() : null,
      status: assignment.status === "ended" ? "ended" : "active",
    }));

    return {
      positionsCurrent: normalizeRows(
        positions.map((row) => ({
          positionId: row.id,
          title: row.title,
          teamId: row.teamId,
          reportsToPositionId: row.reportsToPositionId,
          lifecycleStatus: row.lifecycleStatus,
        })),
      ),
      assignmentTimelines: normalizeRows(assignmentTimelines),
      evidenceByAssignment: normalizeRows(
        evidenceByAssignment.map((row) => ({
          assignmentId: row.assignmentId,
          positionId: row.positionId,
          status: row.status,
          missingCount: row.missingCount,
          pendingCount: row.pendingCount,
          nonCompliantCount: row.nonCompliantCount,
        })),
      ),
      evidenceByPosition: normalizeRows(
        evidenceByPosition.map((row) => ({
          positionId: row.positionId,
          status: row.status,
          missingCount: row.missingCount,
          pendingCount: row.pendingCount,
          nonCompliantCount: row.nonCompliantCount,
        })),
      ),
      compensationCurrent: normalizeRows(
        compensationCurrent.map((row) => ({
          assignmentId: row.assignmentId,
          compensationRecordId: row.compensationRecordId,
          sourceDocumentId: row.sourceDocumentId,
          amount: row.amount,
          currency: row.currency,
          effectiveFrom: row.effectiveFrom.toISOString(),
        })),
      ),
      compensationRecords: normalizeRows(
        compensationRecords.map((row) => ({
          compensationRecordId: row.id,
          assignmentId: row.assignmentId,
          sourceDocumentId: row.sourceDocumentId,
          amount: row.amount,
          currency: row.currency,
          effectiveFrom: row.effectiveFrom.toISOString(),
        })),
      ),
    };
  }

  async compareReplayWithLive(organizationId: string) {
    const [replay, live] = await Promise.all([
      this.replayOrganization(organizationId),
      this.getLiveProjectionState(organizationId),
    ]);

    const replayPositionIds = new Set(
      (replay.replayed.positionsCurrent as Array<Record<string, unknown>>).map((row) =>
        String(row.positionId),
      ),
    );
    const replayAssignmentIds = new Set(
      (replay.replayed.assignmentTimelines as Array<Record<string, unknown>>).map((row) =>
        String(row.assignmentId),
      ),
    );
    const replayEvidenceAssignmentIds = new Set(
      (replay.replayed.evidenceByAssignment as Array<Record<string, unknown>>).map((row) =>
        String(row.assignmentId),
      ),
    );
    const replayEvidencePositionIds = new Set(
      (replay.replayed.evidenceByPosition as Array<Record<string, unknown>>).map((row) =>
        String(row.positionId),
      ),
    );
    const replayCompAssignmentIds = new Set(
      (replay.replayed.compensationCurrent as Array<Record<string, unknown>>).map((row) =>
        String(row.assignmentId),
      ),
    );

    const livePositionIds = new Set(live.positionsCurrent.map((row) => String(row.positionId)));
    const liveAssignmentIds = new Set(live.assignmentTimelines.map((row) => String(row.assignmentId)));
    const liveEvidenceAssignmentIds = new Set(
      live.evidenceByAssignment.map((row) => String(row.assignmentId)),
    );
    const liveEvidencePositionIds = new Set(live.evidenceByPosition.map((row) => String(row.positionId)));
    const liveCompAssignmentIds = new Set(live.compensationCurrent.map((row) => String(row.assignmentId)));

    const sharedPositionIds = new Set(
      [...replayPositionIds].filter((id) => livePositionIds.has(id)),
    );
    const sharedAssignmentIds = new Set(
      [...replayAssignmentIds].filter((id) => liveAssignmentIds.has(id)),
    );
    const sharedEvidenceAssignmentIds = new Set(
      [...replayEvidenceAssignmentIds].filter((id) => liveEvidenceAssignmentIds.has(id)),
    );
    const sharedEvidencePositionIds = new Set(
      [...replayEvidencePositionIds].filter((id) => liveEvidencePositionIds.has(id)),
    );
    const sharedCompAssignmentIds = new Set(
      [...replayCompAssignmentIds].filter((id) => liveCompAssignmentIds.has(id)),
    );

    const replayPositionsCurrent = (replay.replayed.positionsCurrent as Array<Record<string, unknown>>).filter((row) =>
      sharedPositionIds.has(String(row.positionId)),
    );
    const livePositionsCurrent = live.positionsCurrent.filter((row) =>
      sharedPositionIds.has(String(row.positionId)),
    );

    const replayAssignmentTimelines = (replay.replayed.assignmentTimelines as Array<Record<string, unknown>>).filter(
      (row) => sharedAssignmentIds.has(String(row.assignmentId)),
    );
    const liveAssignmentTimelines = live.assignmentTimelines.filter((row) =>
      sharedAssignmentIds.has(String(row.assignmentId)),
    );

    const replayEvidenceByAssignment = (replay.replayed.evidenceByAssignment as Array<Record<string, unknown>>).filter(
      (row) => sharedEvidenceAssignmentIds.has(String(row.assignmentId)),
    );
    const liveEvidenceByAssignment = live.evidenceByAssignment.filter((row) =>
      sharedEvidenceAssignmentIds.has(String(row.assignmentId)),
    );

    const replayEvidenceByPosition = (replay.replayed.evidenceByPosition as Array<Record<string, unknown>>).filter(
      (row) => sharedEvidencePositionIds.has(String(row.positionId)),
    );
    const liveEvidenceByPosition = live.evidenceByPosition.filter((row) =>
      sharedEvidencePositionIds.has(String(row.positionId)),
    );

    const replayCompensationCurrent = (replay.replayed.compensationCurrent as Array<Record<string, unknown>>).filter(
      (row) => sharedCompAssignmentIds.has(String(row.assignmentId)),
    );
    const liveCompensationCurrent = live.compensationCurrent.filter((row) =>
      sharedCompAssignmentIds.has(String(row.assignmentId)),
    );

    const comparison = {
      positionsCurrentHash: {
        replayed: stableHash(replayPositionsCurrent),
        live: stableHash(livePositionsCurrent),
      },
      assignmentProjectionHash: {
        replayed: stableHash(replayAssignmentTimelines),
        live: stableHash(liveAssignmentTimelines),
      },
      evidenceByAssignmentHash: {
        replayed: stableHash(replayEvidenceByAssignment),
        live: stableHash(liveEvidenceByAssignment),
      },
      evidenceByPositionHash: {
        replayed: stableHash(replayEvidenceByPosition),
        live: stableHash(liveEvidenceByPosition),
      },
      compensationCurrentHash: {
        replayed: stableHash(replayCompensationCurrent),
        live: stableHash(liveCompensationCurrent),
      },
    };

    const mismatches = Object.entries(comparison)
      .filter(([, value]) => value.replayed !== value.live)
      .map(([projection]) => projection);

    return {
      organizationId,
      diagnostics: replay.diagnostics,
      comparison,
      mismatches,
      matches: mismatches.length === 0,
    };
  }
}

export function buildReplayService() {
  return new ReplayService();
}
