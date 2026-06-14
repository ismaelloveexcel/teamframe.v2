import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, projectionIntegrityChecksTable } from "@workspace/db";
import { stableHash } from "../domain";
import { appendDomainEvent } from "./event-store-write";
import { buildProjectionBuilderService, ProjectionBuilderService } from "./projection-builder-service";
import { buildReplayService, ReplayService } from "./replay-service";

type DriftRecord = {
  projectionName: string;
  liveHash: string;
  replayedHash: string;
  driftDetected: boolean;
  autoRepaired: boolean;
};

export class ProjectionIntegrityService {
  constructor(
    private readonly replay: ReplayService,
    private readonly projector: ProjectionBuilderService,
  ) {}

  async checkAndRepair(input: {
    organizationId: string;
    autoRepair: boolean;
  }) {
    const replayComparison = await this.replay.compareReplayWithLive(input.organizationId);
    const driftRecords: DriftRecord[] = Object.entries(replayComparison.comparison).map(
      ([projectionName, values]) => ({
        projectionName,
        liveHash: values.live,
        replayedHash: values.replayed,
        driftDetected: values.live !== values.replayed,
        autoRepaired: false,
      }),
    );

    const drifted = driftRecords.filter((record) => record.driftDetected);

    if (input.autoRepair && drifted.length > 0) {
      await db.transaction(async (tx) => {
        for (const drift of drifted) {
          await appendDomainEvent(tx, {
            organizationId: input.organizationId,
            actorUserId: "system",
            aggregateType: "system",
            aggregateId: `projection:${drift.projectionName}`,
            eventType: "projection.repair.requested",
            idempotencyKey: `projection-repair-${drift.projectionName}-${randomUUID()}`,
            payload: {
              projectionName: drift.projectionName,
              liveHash: drift.liveHash,
              replayedHash: drift.replayedHash,
              reason: "drift_detected",
            },
          });
        }

        await this.projector.rebuildFromEventsTx(tx, {
          organizationId: input.organizationId,
          include: {
            positions: true,
            assignments: true,
            evidence: true,
            compensationCurrent: true,
          },
        });
      });

      for (const drift of drifted) {
        drift.autoRepaired = true;
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
  return new ProjectionIntegrityService(buildReplayService(), buildProjectionBuilderService());
}
