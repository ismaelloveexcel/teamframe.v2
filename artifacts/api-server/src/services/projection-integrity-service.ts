import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  db,
  evidenceStatusByAssignmentTable,
  evidenceStatusByPositionTable,
  projectionIntegrityChecksTable,
} from "@workspace/db";
import { stableHash } from "../domain";
import { buildReplayService, ReplayService } from "./replay-service";

function isUsableId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== "undefined" && normalized !== "null";
}

type DriftRecord = {
  projectionName: string;
  liveHash: string;
  replayedHash: string;
  driftDetected: boolean;
  autoRepaired: boolean;
};

export class ProjectionIntegrityService {
  constructor(private readonly replay: ReplayService) {}

  async checkAndRepair(input: {
    organizationId: string;
    autoRepair: boolean;
  }) {
    const replayComparison = await this.replay.compareReplayWithLive(input.organizationId);
    const driftRecords: DriftRecord[] = [];

    const comparisonEntries = Object.entries(replayComparison.comparison);
    for (const [projectionName, values] of comparisonEntries) {
      driftRecords.push({
        projectionName,
        liveHash: values.live,
        replayedHash: values.replayed,
        driftDetected: values.live !== values.replayed,
        autoRepaired: false,
      });
    }

    if (input.autoRepair) {
      const replayData = await this.replay.replayOrganization(input.organizationId);
      for (const drift of driftRecords) {
        if (!drift.driftDetected) continue;
        if (drift.projectionName === "evidenceByAssignmentHash") {
          await db
            .delete(evidenceStatusByAssignmentTable)
            .where(eq(evidenceStatusByAssignmentTable.organizationId, input.organizationId));
          for (const row of replayData.replayed.evidenceByAssignment as Array<Record<string, unknown>>) {
            const assignmentId = row.assignmentId ? String(row.assignmentId) : "";
            const positionId = row.positionId ? String(row.positionId) : "";
            if (!isUsableId(assignmentId) || !isUsableId(positionId)) continue;
            await db.insert(evidenceStatusByAssignmentTable).values({
              assignmentId,
              organizationId: input.organizationId,
              positionId,
              status: row.status as "missing" | "pending" | "compliant" | "non_compliant",
              missingCount: Number(row.missingCount),
              pendingCount: Number(row.pendingCount),
              nonCompliantCount: Number(row.nonCompliantCount),
              computedAt: new Date(),
            });
          }
          drift.autoRepaired = true;
        } else if (drift.projectionName === "evidenceByPositionHash") {
          await db
            .delete(evidenceStatusByPositionTable)
            .where(eq(evidenceStatusByPositionTable.organizationId, input.organizationId));
          for (const row of replayData.replayed.evidenceByPosition as Array<Record<string, unknown>>) {
            const positionId = row.positionId ? String(row.positionId) : "";
            if (!isUsableId(positionId)) continue;
            await db.insert(evidenceStatusByPositionTable).values({
              positionId,
              organizationId: input.organizationId,
              status: row.status as "missing" | "pending" | "compliant" | "non_compliant",
              missingCount: Number(row.missingCount),
              pendingCount: Number(row.pendingCount),
              nonCompliantCount: Number(row.nonCompliantCount),
              computedAt: new Date(),
            });
          }
          drift.autoRepaired = true;
        } else if (drift.projectionName === "compensationCurrentHash") {
          await db
            .delete(compensationCurrentTable)
            .where(eq(compensationCurrentTable.organizationId, input.organizationId));
          for (const row of replayData.replayed.compensationCurrent as Array<Record<string, unknown>>) {
            const assignmentId = row.assignmentId ? String(row.assignmentId) : "";
            const compensationRecordId = row.compensationRecordId ? String(row.compensationRecordId) : "";
            const sourceDocumentId = row.sourceDocumentId ? String(row.sourceDocumentId) : "";
            const effectiveFromRaw = row.effectiveFrom ? String(row.effectiveFrom) : "";
            if (
              !isUsableId(assignmentId) ||
              !isUsableId(compensationRecordId) ||
              !isUsableId(sourceDocumentId) ||
              !effectiveFromRaw ||
              effectiveFromRaw === "undefined" ||
              effectiveFromRaw === "null"
            ) continue;
            await db.insert(compensationCurrentTable).values({
              assignmentId,
              organizationId: input.organizationId,
              compensationRecordId,
              sourceDocumentId,
              amount: Number(row.amount),
              currency: String(row.currency),
              effectiveFrom: new Date(effectiveFromRaw),
              computedAt: new Date(),
            });
          }
          drift.autoRepaired = true;
        }
      }
    }

    for (const drift of driftRecords) {
      await db.insert(projectionIntegrityChecksTable).values({
        orgId: input.organizationId,
        projectionName: drift.projectionName,
        liveHash: drift.liveHash,
        replayedHash: drift.replayedHash,
        driftDetected: drift.driftDetected,
        autoRepaired: drift.autoRepaired,
        details: {
          mismatch: drift.driftDetected,
          autoRepaired: drift.autoRepaired,
        },
      });
    }

    const drifted = driftRecords.filter((record) => record.driftDetected);
    return {
      organizationId: input.organizationId,
      drifted,
      healthy: drifted.length === 0,
      hashSummary: {
        live: stableHash(
          driftRecords.map((record) => ({
            projectionName: record.projectionName,
            liveHash: record.liveHash,
          })),
        ),
        replayed: stableHash(
          driftRecords.map((record) => ({
            projectionName: record.projectionName,
            replayedHash: record.replayedHash,
          })),
        ),
      },
    };
  }

  async latestChecks(organizationId: string) {
    return db
      .select()
      .from(projectionIntegrityChecksTable)
      .where(eq(projectionIntegrityChecksTable.orgId, organizationId));
  }
}

export function buildProjectionIntegrityService() {
  return new ProjectionIntegrityService(buildReplayService());
}
