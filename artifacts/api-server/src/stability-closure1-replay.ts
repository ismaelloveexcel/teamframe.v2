import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  compensationRecordsTable,
  db,
  documentsTable,
  evidenceStatusByAssignmentTable,
  evidenceStatusByPositionTable,
  orgEventsTable,
  organizationMembershipsTable,
  organizationsTable,
  personPositionAssignmentsTable,
  positionsTable,
  usersTable,
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
  type EventEnvelope,
} from "./domain";
import { appendDomainEvent } from "./services/event-store-write";
import { buildProjectionBuilderService } from "./services/projection-builder-service";

type ProjectionName =
  | "positions_current"
  | "assignments_current"
  | "evidence_status_by_assignment"
  | "evidence_status_by_position"
  | "compensation_current";

type RootCauseClass =
  | "projector_logic_bug"
  | "historical_projection_corruption"
  | "schema_evolution_edge_case"
  | "legacy_data_backfill_gap";

type Row = Record<string, unknown>;

function normalizeRows(rows: Row[]) {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

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

async function getActorUserId(orgId: string) {
  const [membership] = await db
    .select({ userId: organizationMembershipsTable.userId })
    .from(organizationMembershipsTable)
    .where(eq(organizationMembershipsTable.organizationId, orgId))
    .limit(1);
  if (membership?.userId) return membership.userId;

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (!user?.id) {
    throw new Error(`No user available to append backfill events for org ${orgId}`);
  }
  return user.id;
}

async function loadLiveProjectionState(orgId: string) {
  const [positions, assignments, evidenceByAssignment, evidenceByPosition, compensationCurrent] =
    await Promise.all([
      db.select().from(positionsTable).where(eq(positionsTable.organizationId, orgId)),
      db
        .select()
        .from(personPositionAssignmentsTable)
        .where(eq(personPositionAssignmentsTable.organizationId, orgId)),
      db
        .select()
        .from(evidenceStatusByAssignmentTable)
        .where(eq(evidenceStatusByAssignmentTable.organizationId, orgId)),
      db
        .select()
        .from(evidenceStatusByPositionTable)
        .where(eq(evidenceStatusByPositionTable.organizationId, orgId)),
      db
        .select()
        .from(compensationCurrentTable)
        .where(eq(compensationCurrentTable.organizationId, orgId)),
    ]);

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
    assignmentsCurrent: normalizeRows(
      assignments.map((row) => ({
        assignmentId: row.id,
        personId: row.personId,
        positionId: row.positionId,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
        status: row.status,
      })),
    ),
    evidenceStatusByAssignment: normalizeRows(
      evidenceByAssignment.map((row) => ({
        assignmentId: row.assignmentId,
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    ),
    evidenceStatusByPosition: normalizeRows(
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
  };
}

async function loadReplayProjectionState(orgId: string) {
  const events = (
    await db.select().from(orgEventsTable).where(eq(orgEventsTable.orgId, orgId))
  )
    .map(toEventEnvelope)
    .sort((a, b) => {
      const byOccurred = a.occurredAt.localeCompare(b.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      const byAggregate = a.aggregateId.localeCompare(b.aggregateId);
      if (byAggregate !== 0) return byAggregate;
      return a.version - b.version;
    });

  const positions = derivePositionsFromEvents(events);
  const assignments = deriveAssignments(events);
  const requirementRules = deriveRequirementRulesFromEvents(events);
  const documents = deriveDocumentSnapshotsFromEvents(events);
  const evidenceByAssignment = deriveEvidenceStatusByAssignment({
    requirementRules,
    documentSnapshots: documents,
    events,
  });
  const evidenceByPosition = deriveEvidenceStatusByPosition(evidenceByAssignment);
  const compensationCurrent = [
    ...deriveCompensationCurrentByAssignment(deriveCompensationRecordsFromEvents(events)).values(),
  ];

  return {
    positionsCurrent: normalizeRows(
      positions.map((row) => ({
        positionId: row.positionId,
        title: row.title,
        teamId: row.teamId,
        reportsToPositionId: row.reportsToPositionId,
        lifecycleStatus: row.lifecycleStatus,
      })),
    ),
    assignmentsCurrent: normalizeRows(
      assignments.map((row) => ({
        assignmentId: row.assignmentId,
        personId: row.employeeId,
        positionId: row.positionId,
        startedAt: row.effectiveFrom,
        endedAt: row.effectiveTo,
        status: row.status,
      })),
    ),
    evidenceStatusByAssignment: normalizeRows(
      evidenceByAssignment.map((row) => ({
        assignmentId: row.assignmentId,
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    ),
    evidenceStatusByPosition: normalizeRows(
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
        effectiveFrom: row.effectiveFrom,
      })),
    ),
  };
}

function findFirstMismatch(
  projection: ProjectionName,
  liveRows: Row[],
  replayRows: Row[],
): { key: string; expected: Row | null; actual: Row | null } | null {
  const keyField =
    projection === "positions_current" || projection === "evidence_status_by_position" ?
      "positionId"
    : "assignmentId";

  const liveByKey = new Map<string, Row>(liveRows.map((row) => [String(row[keyField]), row]));
  const replayByKey = new Map<string, Row>(replayRows.map((row) => [String(row[keyField]), row]));
  const keys = [...new Set([...liveByKey.keys(), ...replayByKey.keys()])].sort();
  for (const key of keys) {
    const actual = liveByKey.get(key) ?? null;
    const expected = replayByKey.get(key) ?? null;
    if (stableHash(actual) !== stableHash(expected)) {
      return { key, expected, actual };
    }
  }
  return null;
}

async function detectFirstVersion(orgId: string, projection: ProjectionName, key: string): Promise<number> {
  const aggregateType =
    projection === "positions_current" || projection === "evidence_status_by_position" ? "position" : "assignment";
  const [event] = await db
    .select({ version: orgEventsTable.version })
    .from(orgEventsTable)
    .where(
      and(
        eq(orgEventsTable.orgId, orgId),
        eq(orgEventsTable.aggregateType, aggregateType),
        eq(orgEventsTable.aggregateId, key),
      ),
    )
    .orderBy(orgEventsTable.version)
    .limit(1);
  return event?.version ?? 0;
}

function classifyRootCause(
  projection: ProjectionName,
  mismatch: { expected: Row | null; actual: Row | null },
  firstVersion: number,
): RootCauseClass {
  if (firstVersion === 0) return "legacy_data_backfill_gap";
  if (projection === "positions_current" || projection === "assignments_current") {
    if (!mismatch.expected || !mismatch.actual) return "legacy_data_backfill_gap";
    return "projector_logic_bug";
  }
  if (projection === "compensation_current" || projection.startsWith("evidence_status")) {
    return "historical_projection_corruption";
  }
  return "schema_evolution_edge_case";
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

async function backfillMissingEvents(orgId: string, actorUserId: string) {
  await db.transaction(async (tx) => {
    const positions = await tx.select().from(positionsTable).where(eq(positionsTable.organizationId, orgId));
    for (const position of positions) {
      const [createdEvent] = await tx
        .select({ id: orgEventsTable.id })
        .from(orgEventsTable)
        .where(
          and(
            eq(orgEventsTable.orgId, orgId),
            eq(orgEventsTable.aggregateType, "position"),
            eq(orgEventsTable.aggregateId, position.id),
            eq(orgEventsTable.eventType, "position.created"),
          ),
        )
        .limit(1);
      if (createdEvent) continue;

      await appendDomainEvent(tx, {
        organizationId: orgId,
        actorUserId,
        aggregateType: "position",
        aggregateId: position.id,
        eventType: "position.created",
        idempotencyKey: `stability-backfill-position-${position.id}-${randomUUID()}`,
        payload: {
          positionId: position.id,
          title: position.title,
          teamId: position.teamId,
          reportsToPositionId: position.reportsToPositionId,
          lifecycleStatus: position.lifecycleStatus,
        },
      });
    }

    const assignments = await tx
      .select()
      .from(personPositionAssignmentsTable)
      .where(eq(personPositionAssignmentsTable.organizationId, orgId));
    for (const assignment of assignments) {
      const [started] = await tx
        .select({ id: orgEventsTable.id })
        .from(orgEventsTable)
        .where(
          and(
            eq(orgEventsTable.orgId, orgId),
            eq(orgEventsTable.aggregateType, "assignment"),
            eq(orgEventsTable.aggregateId, assignment.id),
            eq(orgEventsTable.eventType, "assignment.started"),
          ),
        )
        .limit(1);
      if (!started) {
        await appendDomainEvent(tx, {
          organizationId: orgId,
          actorUserId,
          aggregateType: "assignment",
          aggregateId: assignment.id,
          eventType: "assignment.started",
          idempotencyKey: `stability-backfill-assignment-started-${assignment.id}-${randomUUID()}`,
          payload: {
            assignmentId: assignment.id,
            personId: assignment.personId,
            employeeId: assignment.personId,
            positionId: assignment.positionId,
            effectiveFrom: assignment.startedAt.toISOString(),
          },
        });
      }

      const needsEnd = assignment.status === "ended" || assignment.endedAt !== null;
      if (!needsEnd) continue;
      const [ended] = await tx
        .select({ id: orgEventsTable.id })
        .from(orgEventsTable)
        .where(
          and(
            eq(orgEventsTable.orgId, orgId),
            eq(orgEventsTable.aggregateType, "assignment"),
            eq(orgEventsTable.aggregateId, assignment.id),
            eq(orgEventsTable.eventType, "assignment.ended"),
          ),
        )
        .limit(1);
      if (!ended) {
        await appendDomainEvent(tx, {
          organizationId: orgId,
          actorUserId,
          aggregateType: "assignment",
          aggregateId: assignment.id,
          eventType: "assignment.ended",
          idempotencyKey: `stability-backfill-assignment-ended-${assignment.id}-${randomUUID()}`,
          payload: {
            assignmentId: assignment.id,
            effectiveTo: (assignment.endedAt ?? assignment.startedAt).toISOString(),
          },
        });
      }
    }

    const compensationRecords = await tx
      .select()
      .from(compensationRecordsTable)
      .where(eq(compensationRecordsTable.organizationId, orgId));
    for (const record of compensationRecords) {
      const [event] = await tx
        .select({ id: orgEventsTable.id })
        .from(orgEventsTable)
        .where(
          and(
            eq(orgEventsTable.orgId, orgId),
            eq(orgEventsTable.aggregateType, "compensation"),
            eq(orgEventsTable.aggregateId, record.id),
            eq(orgEventsTable.eventType, "compensation.recorded"),
          ),
        )
        .limit(1);
      if (event) continue;
      await appendDomainEvent(tx, {
        organizationId: orgId,
        actorUserId,
        aggregateType: "compensation",
        aggregateId: record.id,
        eventType: "compensation.recorded",
        idempotencyKey: `stability-backfill-comp-${record.id}-${randomUUID()}`,
        payload: {
          compensationRecordId: record.id,
          assignmentId: record.assignmentId,
          sourceDocumentId: record.sourceDocumentId,
          amount: record.amount,
          currency: record.currency,
          effectiveFrom: record.effectiveFrom.toISOString(),
        },
      });
    }

    const compensationEvents = await tx
      .select({
        aggregateId: orgEventsTable.aggregateId,
        occurredAt: orgEventsTable.occurredAt,
        payload: orgEventsTable.payload,
      })
      .from(orgEventsTable)
      .where(
        and(
          eq(orgEventsTable.orgId, orgId),
          eq(orgEventsTable.aggregateType, "compensation"),
          eq(orgEventsTable.eventType, "compensation.recorded"),
        ),
      );
    for (const event of compensationEvents) {
      const payload = event.payload as Record<string, unknown>;
      const compensationRecordId = String(payload.compensationRecordId ?? event.aggregateId ?? "");
      const assignmentId = String(payload.assignmentId ?? "");
      const sourceDocumentId = String(payload.sourceDocumentId ?? "");
      if (!isUuid(compensationRecordId) || !isUuid(assignmentId) || !isUuid(sourceDocumentId)) {
        continue;
      }

      const [assignment] = await tx
        .select({
          assignmentId: personPositionAssignmentsTable.id,
          positionId: personPositionAssignmentsTable.positionId,
        })
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, orgId),
            eq(personPositionAssignmentsTable.id, assignmentId),
          ),
        )
        .limit(1);
      if (!assignment) continue;

      const [document] = await tx
        .select({ id: documentsTable.id })
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.organizationId, orgId),
            eq(documentsTable.id, sourceDocumentId),
          ),
        )
        .limit(1);
      if (!document) {
        await tx.insert(documentsTable).values({
          id: sourceDocumentId,
          organizationId: orgId,
          assignmentId,
          positionId: assignment.positionId,
          requirementKey: "compensation.source",
          sourceDocumentRef: `legacy://compensation/${sourceDocumentId}`,
          state: "uploaded",
        });
      }

      const [record] = await tx
        .select({ id: compensationRecordsTable.id })
        .from(compensationRecordsTable)
        .where(
          and(
            eq(compensationRecordsTable.organizationId, orgId),
            eq(compensationRecordsTable.id, compensationRecordId),
          ),
        )
        .limit(1);
      if (!record) {
        await tx.insert(compensationRecordsTable).values({
          id: compensationRecordId,
          organizationId: orgId,
          assignmentId,
          sourceDocumentId,
          amount: Number(payload.amount ?? 0),
          currency: String(payload.currency ?? "USD"),
          effectiveFrom: new Date(String(payload.effectiveFrom ?? event.occurredAt.toISOString())),
        });
      }
    }
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }
  const applyFixes = process.argv.includes("--apply");
  const runtimeCommit = process.env.RUNTIME_COMMIT ?? "pending";
  const organizations = await db.select({ id: organizationsTable.id }).from(organizationsTable);
  const divergenceMap: Array<Record<string, unknown>> = [];
  const projector = buildProjectionBuilderService();

  for (const org of organizations) {
    const live = await loadLiveProjectionState(org.id);
    const replay = await loadReplayProjectionState(org.id);
    const projections: Array<[ProjectionName, Row[], Row[]]> = [
      ["positions_current", live.positionsCurrent, replay.positionsCurrent],
      ["assignments_current", live.assignmentsCurrent, replay.assignmentsCurrent],
      [
        "evidence_status_by_assignment",
        live.evidenceStatusByAssignment,
        replay.evidenceStatusByAssignment,
      ],
      ["evidence_status_by_position", live.evidenceStatusByPosition, replay.evidenceStatusByPosition],
      ["compensation_current", live.compensationCurrent, replay.compensationCurrent],
    ];

    for (const [projection, liveRows, replayRows] of projections) {
      if (stableHash(liveRows) === stableHash(replayRows)) continue;
      const mismatch = findFirstMismatch(projection, liveRows, replayRows);
      if (!mismatch) continue;
      const firstVersion = await detectFirstVersion(org.id, projection, mismatch.key);
      const rootCauseClass = classifyRootCause(projection, mismatch, firstVersion);
      divergenceMap.push({
        orgId: org.id,
        projection,
        firstMismatch: {
          aggregateId: mismatch.key,
          eventVersion: firstVersion,
          expected: mismatch.expected,
          actual: mismatch.actual,
        },
        rootCauseClass,
        fixCommit: runtimeCommit,
      });
    }

    if (!applyFixes) continue;
    const actorUserId = await getActorUserId(org.id);
    await backfillMissingEvents(org.id, actorUserId);
    await projector.rebuildFromEvents({
      organizationId: org.id,
      include: {
        positions: true,
        assignments: true,
        evidence: true,
        compensationCurrent: true,
      },
    });
  }

  const postFix = [];
  for (const org of organizations) {
    const live = await loadLiveProjectionState(org.id);
    const replay = await loadReplayProjectionState(org.id);
    const mismatches: ProjectionName[] = [];
    if (stableHash(live.positionsCurrent) !== stableHash(replay.positionsCurrent)) {
      mismatches.push("positions_current");
    }
    if (stableHash(live.assignmentsCurrent) !== stableHash(replay.assignmentsCurrent)) {
      mismatches.push("assignments_current");
    }
    if (stableHash(live.evidenceStatusByAssignment) !== stableHash(replay.evidenceStatusByAssignment)) {
      mismatches.push("evidence_status_by_assignment");
    }
    if (stableHash(live.evidenceStatusByPosition) !== stableHash(replay.evidenceStatusByPosition)) {
      mismatches.push("evidence_status_by_position");
    }
    if (stableHash(live.compensationCurrent) !== stableHash(replay.compensationCurrent)) {
      mismatches.push("compensation_current");
    }
    if (mismatches.length > 0) {
      postFix.push({ orgId: org.id, mismatches });
    }
  }

  const outputDir = "/workspace/artifacts/stability";
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "replay-divergence-map.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runtimeCommit,
        applyFixes,
        divergenceMap,
        postFixMismatchedOrgs: postFix,
      },
      null,
      2,
    ),
  );
  console.log(
    `Closure1 divergence map written. pre=${divergenceMap.length} entries, postFixOrgs=${postFix.length}`,
  );
  if (postFix.length > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("closure1 replay convergence failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
