import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import {
  compensationCurrentTable,
  db,
  evidenceStatusByAssignmentTable,
  orgEventsTable,
  outboxDeadLettersTable,
  outboxEventsTable,
  projectionIntegrityChecksTable,
  replayRunsTable,
  streamQuarantinesTable,
} from "@workspace/db";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class OperationalMetricsService {
  async getMetrics(organizationId: string) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 5 * 60 * 1000);

    const [
      throughputRows,
      outboxQueueRows,
      outboxDepthRows,
      deadLetterRows,
      quarantines,
      replayRuns,
      driftChecks,
      evidenceLagRows,
      compensationLagRows,
    ] = await Promise.all([
      db
        .select({ c: count() })
        .from(orgEventsTable)
        .where(and(eq(orgEventsTable.orgId, organizationId), gt(orgEventsTable.occurredAt, windowStart))),
      db
        .select({ oldestCreatedAt: outboxEventsTable.createdAt })
        .from(outboxEventsTable)
        .where(and(eq(outboxEventsTable.orgId, organizationId), eq(outboxEventsTable.processed, false)))
        .orderBy(outboxEventsTable.createdAt)
        .limit(1),
      db
        .select({ c: count() })
        .from(outboxEventsTable)
        .where(and(eq(outboxEventsTable.orgId, organizationId), eq(outboxEventsTable.processed, false))),
      db
        .select({ c: count() })
        .from(outboxDeadLettersTable)
        .where(eq(outboxDeadLettersTable.orgId, organizationId)),
      db
        .select({ c: count() })
        .from(streamQuarantinesTable)
        .where(
          and(
            eq(streamQuarantinesTable.orgId, organizationId),
            eq(streamQuarantinesTable.state, "quarantined"),
          ),
        ),
      db
        .select()
        .from(replayRunsTable)
        .where(eq(replayRunsTable.orgId, organizationId))
        .orderBy(sql`${replayRunsTable.startedAt} desc`)
        .limit(5),
      db
        .select()
        .from(projectionIntegrityChecksTable)
        .where(eq(projectionIntegrityChecksTable.orgId, organizationId)),
      db
        .select({ maxComputedAt: sql<Date | null>`max(${evidenceStatusByAssignmentTable.computedAt})` })
        .from(evidenceStatusByAssignmentTable)
        .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId)),
      db
        .select({ maxComputedAt: sql<Date | null>`max(${compensationCurrentTable.computedAt})` })
        .from(compensationCurrentTable)
        .where(eq(compensationCurrentTable.organizationId, organizationId)),
    ]);

    const eventThroughput = Number(throughputRows[0]?.c ?? 0);
    const outboxQueueDepth = Number(outboxDepthRows[0]?.c ?? 0);
    const deadLetterCount = Number(deadLetterRows[0]?.c ?? 0);
    const quarantineCount = Number(quarantines[0]?.c ?? 0);
    const projectionDriftCount = driftChecks.filter((check) => check.driftDetected).length;

    const oldestUnprocessed = toDate(outboxQueueRows[0]?.oldestCreatedAt ?? null);
    const outboxLagSeconds = oldestUnprocessed
      ? Math.max(0, Math.floor((now.getTime() - oldestUnprocessed.getTime()) / 1000))
      : 0;

    const evidenceComputedAt = toDate(evidenceLagRows[0]?.maxComputedAt ?? null);
    const compensationComputedAt = toDate(compensationLagRows[0]?.maxComputedAt ?? null);
    const projectionLagCandidates = [evidenceComputedAt, compensationComputedAt].filter(
      (value): value is Date => Boolean(value),
    );
    const projectionLagSeconds =
      projectionLagCandidates.length > 0
        ? Math.max(
            ...projectionLagCandidates.map((value) =>
              Math.max(0, Math.floor((now.getTime() - value.getTime()) / 1000)),
            ),
          )
        : 0;

    const latestReplay = replayRuns[0] ?? null;
    const replayExecutionHealth = latestReplay
      ? {
          status: latestReplay.status,
          startedAt: latestReplay.startedAt.toISOString(),
          completedAt: latestReplay.completedAt?.toISOString() ?? null,
          durationMs:
            latestReplay.completedAt && latestReplay.startedAt
              ? latestReplay.completedAt.getTime() - latestReplay.startedAt.getTime()
              : null,
        }
      : null;

    const integrityStatus =
      quarantineCount > 0 || deadLetterCount > 0
        ? "CORRUPTED"
        : projectionDriftCount > 0 || outboxQueueDepth > 0
          ? "DEGRADED"
          : "OK";

    return {
      organizationId,
      eventThroughputLast5m: eventThroughput,
      projectionLagSeconds,
      outboxQueueDepth,
      outboxLagSeconds,
      deadLetterCount,
      replayExecutionHealth,
      quarantineCount,
      projectionDriftCount,
      integrityStatus,
    };
  }
}

export function buildOperationalMetricsService() {
  return new OperationalMetricsService();
}
