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
            await db.insert(evidenceStatusByAssignmentTable).values({
              assignmentId: String(row.assignmentId),
              organizationId: input.organizationId,
              positionId: String(row.positionId),
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
            await db.insert(evidenceStatusByPositionTable).values({
              positionId: String(row.positionId),
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
            await db.insert(compensationCurrentTable).values({
              assignmentId: String(row.assignmentId),
              organizationId: input.organizationId,
              compensationRecordId: String(row.compensationRecordId),
              sourceDocumentId: String(row.sourceDocumentId),
              amount: Number(row.amount),
              currency: String(row.currency),
              effectiveFrom: new Date(String(row.effectiveFrom)),
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
