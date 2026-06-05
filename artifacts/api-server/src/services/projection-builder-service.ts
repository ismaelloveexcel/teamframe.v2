import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  db,
  documentsTable,
  evidenceStatusByAssignmentTable,
  evidenceStatusByPositionTable,
  orgEventsTable,
  personPositionAssignmentsTable,
  positionsTable,
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
  type EventEnvelope,
} from "../domain";

function isUsableId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "undefined" && normalized !== "null";
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
    payloadHash: row.payloadHash ?? "",
  };
}

async function loadOrganizationEvents(tx: any, organizationId: string): Promise<EventEnvelope[]> {
  const rows = await tx.select().from(orgEventsTable).where(eq(orgEventsTable.orgId, organizationId));
  return rows
    .map(toEventEnvelope)
    .sort((a: EventEnvelope, b: EventEnvelope) => {
      const byOccurred = a.occurredAt.localeCompare(b.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      const byAggregate = a.aggregateId.localeCompare(b.aggregateId);
      if (byAggregate !== 0) return byAggregate;
      return a.version - b.version;
    });
}

export class ProjectionBuilderService {
  async rebuildFromEvents(input: {
    organizationId: string;
    include?: {
      positions?: boolean;
      assignments?: boolean;
      evidence?: boolean;
      compensationCurrent?: boolean;
    };
  }) {
    return db.transaction(async (tx) => this.rebuildFromEventsTx(tx, input));
  }

  async rebuildFromEventsTx(
    tx: any,
    input: {
      organizationId: string;
      include?: {
        positions?: boolean;
        assignments?: boolean;
        evidence?: boolean;
        compensationCurrent?: boolean;
      };
    },
  ) {
    const include = {
      positions: input.include?.positions ?? false,
      assignments: input.include?.assignments ?? false,
      evidence: input.include?.evidence ?? false,
      compensationCurrent: input.include?.compensationCurrent ?? false,
    };
    const events = await loadOrganizationEvents(tx, input.organizationId);

    if (include.positions) {
      const snapshots = derivePositionsFromEvents(events);
      await tx.delete(positionsTable).where(eq(positionsTable.organizationId, input.organizationId));
      for (const snapshot of snapshots) {
        await tx.insert(positionsTable).values({
          id: snapshot.positionId,
          organizationId: input.organizationId,
          teamId: snapshot.teamId ?? null,
          title: snapshot.title,
          reportsToPositionId: snapshot.reportsToPositionId ?? null,
          lifecycleStatus: snapshot.lifecycleStatus,
          updatedAt: new Date(),
        });
      }
    }

    if (include.assignments) {
      const assignments = deriveAssignments(events);
      await tx
        .delete(personPositionAssignmentsTable)
        .where(eq(personPositionAssignmentsTable.organizationId, input.organizationId));
      for (const assignment of assignments) {
        if (
          !isUsableId(assignment.assignmentId) ||
          !isUsableId(assignment.employeeId) ||
          !isUsableId(assignment.positionId)
        ) {
          continue;
        }
        await tx.insert(personPositionAssignmentsTable).values({
          id: assignment.assignmentId,
          organizationId: input.organizationId,
          personId: assignment.employeeId,
          positionId: assignment.positionId,
          startedAt: new Date(assignment.effectiveFrom),
          endedAt: assignment.effectiveTo ? new Date(assignment.effectiveTo) : null,
          status: assignment.status === "ended" ? "ended" : "active",
          updatedAt: new Date(),
        });
      }
    }

    if (include.compensationCurrent) {
      const records = deriveCompensationRecordsFromEvents(events);
      const current = [...deriveCompensationCurrentByAssignment(records).values()];
      const [assignmentRows, documentRows] = await Promise.all([
        tx
          .select({ id: personPositionAssignmentsTable.id })
          .from(personPositionAssignmentsTable)
          .where(eq(personPositionAssignmentsTable.organizationId, input.organizationId)),
        tx
          .select({ id: documentsTable.id })
          .from(documentsTable)
          .where(eq(documentsTable.organizationId, input.organizationId)),
      ]);
      const validAssignmentIds = new Set(assignmentRows.map((row: { id: string }) => row.id));
      const validDocumentIds = new Set(documentRows.map((row: { id: string }) => row.id));
      await tx
        .delete(compensationCurrentTable)
        .where(eq(compensationCurrentTable.organizationId, input.organizationId));
      for (const row of current) {
        if (
          !isUsableId(row.assignmentId) ||
          !isUsableId(row.compensationRecordId) ||
          !isUsableId(row.sourceDocumentId)
        ) {
          continue;
        }
        if (!validAssignmentIds.has(row.assignmentId) || !validDocumentIds.has(row.sourceDocumentId)) continue;
        await tx.insert(compensationCurrentTable).values({
          assignmentId: row.assignmentId,
          organizationId: input.organizationId,
          compensationRecordId: row.compensationRecordId,
          sourceDocumentId: row.sourceDocumentId,
          amount: row.amount,
          currency: row.currency,
          effectiveFrom: new Date(row.effectiveFrom),
          computedAt: new Date(),
        });
      }
    }

    if (include.evidence) {
      const requirementRules = deriveRequirementRulesFromEvents(events);
      const documentSnapshots = deriveDocumentSnapshotsFromEvents(events);
      const byAssignment = deriveEvidenceStatusByAssignment({
        requirementRules,
        documentSnapshots,
        events,
      });
      const byPosition = deriveEvidenceStatusByPosition(byAssignment);

      const [assignmentRows, positionRows] = await Promise.all([
        tx
          .select({ id: personPositionAssignmentsTable.id })
          .from(personPositionAssignmentsTable)
          .where(eq(personPositionAssignmentsTable.organizationId, input.organizationId)),
        tx
          .select({ id: positionsTable.id })
          .from(positionsTable)
          .where(eq(positionsTable.organizationId, input.organizationId)),
      ]);
      const validAssignmentIds = new Set(assignmentRows.map((row: { id: string }) => row.id));
      const validPositionIds = new Set(positionRows.map((row: { id: string }) => row.id));

      await tx
        .delete(evidenceStatusByAssignmentTable)
        .where(eq(evidenceStatusByAssignmentTable.organizationId, input.organizationId));
      for (const row of byAssignment) {
        if (!isUsableId(row.assignmentId) || !isUsableId(row.positionId)) continue;
        if (!validAssignmentIds.has(row.assignmentId) || !validPositionIds.has(row.positionId)) continue;
        await tx.insert(evidenceStatusByAssignmentTable).values({
          assignmentId: row.assignmentId,
          organizationId: input.organizationId,
          positionId: row.positionId,
          status: row.status,
          missingCount: row.missingCount,
          pendingCount: row.pendingCount,
          nonCompliantCount: row.nonCompliantCount,
          computedAt: new Date(),
        });
      }

      await tx
        .delete(evidenceStatusByPositionTable)
        .where(eq(evidenceStatusByPositionTable.organizationId, input.organizationId));
      for (const row of byPosition) {
        if (!isUsableId(row.positionId)) continue;
        if (!validPositionIds.has(row.positionId)) continue;
        await tx.insert(evidenceStatusByPositionTable).values({
          positionId: row.positionId,
          organizationId: input.organizationId,
          status: row.status,
          missingCount: row.missingCount,
          pendingCount: row.pendingCount,
          nonCompliantCount: row.nonCompliantCount,
          computedAt: new Date(),
        });
      }
    }
  }

  async projectPositionEventTx(
    tx: any,
    input: {
      organizationId: string;
      eventType: string;
      payload: Record<string, unknown>;
    },
  ) {
    const positionId = String(input.payload.positionId ?? input.payload.id ?? "");
    if (!positionId) return;

    if (input.eventType === "position.deleted") {
      await tx
        .delete(positionsTable)
        .where(and(eq(positionsTable.organizationId, input.organizationId), eq(positionsTable.id, positionId)));
      return;
    }

    if (input.eventType === "position.created") {
      await tx
        .insert(positionsTable)
        .values({
          id: positionId,
          organizationId: input.organizationId,
          teamId: (input.payload.teamId as string | null | undefined) ?? null,
          title: String(input.payload.title ?? ""),
          reportsToPositionId:
            (input.payload.reportsToPositionId as string | null | undefined) ??
            (input.payload.reportsToId as string | null | undefined) ??
            null,
          lifecycleStatus:
            (input.payload.lifecycleStatus as "filled" | "vacant" | "frozen" | undefined) ?? "vacant",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [positionsTable.id],
          set: {
            teamId: (input.payload.teamId as string | null | undefined) ?? null,
            title: String(input.payload.title ?? ""),
            reportsToPositionId:
              (input.payload.reportsToPositionId as string | null | undefined) ??
              (input.payload.reportsToId as string | null | undefined) ??
              null,
            lifecycleStatus:
              (input.payload.lifecycleStatus as "filled" | "vacant" | "frozen" | undefined) ?? "vacant",
            updatedAt: new Date(),
          },
        });
      return;
    }

    if (input.eventType === "position.updated" || input.eventType === "position.reparented") {
      const setValues: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (Object.prototype.hasOwnProperty.call(input.payload, "teamId")) {
        setValues.teamId = (input.payload.teamId as string | null | undefined) ?? null;
      }
      if (Object.prototype.hasOwnProperty.call(input.payload, "title")) {
        setValues.title = String(input.payload.title ?? "");
      }
      if (
        Object.prototype.hasOwnProperty.call(input.payload, "reportsToPositionId") ||
        Object.prototype.hasOwnProperty.call(input.payload, "reportsToId")
      ) {
        setValues.reportsToPositionId =
          (input.payload.reportsToPositionId as string | null | undefined) ??
          (input.payload.reportsToId as string | null | undefined) ??
          null;
      }
      if (Object.prototype.hasOwnProperty.call(input.payload, "lifecycleStatus")) {
        setValues.lifecycleStatus =
          (input.payload.lifecycleStatus as "filled" | "vacant" | "frozen" | undefined) ?? "vacant";
      }
      await tx
        .update(positionsTable)
        .set(setValues)
        .where(and(eq(positionsTable.organizationId, input.organizationId), eq(positionsTable.id, positionId)));
    }
  }

  async projectAssignmentEventTx(
    tx: any,
    input: {
      organizationId: string;
      eventType: string;
      payload: Record<string, unknown>;
    },
  ) {
    const assignmentId = String(input.payload.assignmentId ?? "");
    if (!assignmentId) return;

    if (input.eventType === "assignment.started") {
      const personId = String(input.payload.employeeId ?? input.payload.personId ?? "");
      const positionId = String(input.payload.positionId ?? "");
      const startedAt = String(input.payload.effectiveFrom ?? "");
      if (!personId || !positionId || !startedAt) return;
      await tx
        .insert(personPositionAssignmentsTable)
        .values({
          id: assignmentId,
          organizationId: input.organizationId,
          personId,
          positionId,
          startedAt: new Date(startedAt),
          endedAt: null,
          status: "active",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [personPositionAssignmentsTable.id],
          set: {
            personId,
            positionId,
            startedAt: new Date(startedAt),
            endedAt: null,
            status: "active",
            updatedAt: new Date(),
          },
        });
      return;
    }

    if (input.eventType === "assignment.ended") {
      const endedAt = String(input.payload.effectiveTo ?? "");
      if (!endedAt) return;
      await tx
        .update(personPositionAssignmentsTable)
        .set({
          status: "ended",
          endedAt: new Date(endedAt),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, input.organizationId),
            eq(personPositionAssignmentsTable.id, assignmentId),
          ),
        );
    }
  }
}

export function buildProjectionBuilderService() {
  return new ProjectionBuilderService();
}
