import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import {
  db,
  evidenceStatusByAssignmentTable,
  orgEventsTable,
  organizationsTable,
} from "@workspace/db";
import { buildProjectionIntegrityService } from "./services/projection-integrity-service";
import { buildReplayService } from "./services/replay-service";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const [targetOrg] = await db
    .select({ id: organizationsTable.id })
    .from(organizationsTable)
    .limit(1);
  if (!targetOrg?.id) {
    throw new Error("No organization exists for repair runtime certification.");
  }

  const integrity = buildProjectionIntegrityService();
  const replay = buildReplayService();
  const attempts = 100;
  const failures: Array<{ attempt: number; reason: string }> = [];
  let successful = 0;

  for (let index = 0; index < attempts; index += 1) {
    const [row] = await db
      .select({
        assignmentId: evidenceStatusByAssignmentTable.assignmentId,
        missingCount: evidenceStatusByAssignmentTable.missingCount,
      })
      .from(evidenceStatusByAssignmentTable)
      .where(eq(evidenceStatusByAssignmentTable.organizationId, targetOrg.id))
      .limit(1);

    if (!row) {
      throw new Error(
        `Organization ${targetOrg.id} has no evidence_status_by_assignment rows for drift injection.`,
      );
    }

    const [before] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orgEventsTable)
      .where(
        sql`${orgEventsTable.orgId} = ${targetOrg.id} AND ${orgEventsTable.eventType} = 'projection.repair.requested'`,
      );

    await db
      .update(evidenceStatusByAssignmentTable)
      .set({ missingCount: row.missingCount + 1 })
      .where(
        sql`${evidenceStatusByAssignmentTable.organizationId} = ${targetOrg.id} AND ${evidenceStatusByAssignmentTable.assignmentId} = ${row.assignmentId}`,
      );

    await integrity.checkAndRepair({
      organizationId: targetOrg.id,
      autoRepair: true,
    });

    const [after] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orgEventsTable)
      .where(
        sql`${orgEventsTable.orgId} = ${targetOrg.id} AND ${orgEventsTable.eventType} = 'projection.repair.requested'`,
      );

    const comparison = await replay.compareReplayWithLive(targetOrg.id);
    const persisted = (after?.count ?? 0) > (before?.count ?? 0);
    if (!persisted || !comparison.matches) {
      failures.push({
        attempt: index + 1,
        reason:
          !persisted ? "repair_event_not_persisted"
          : !comparison.matches ? "replay_live_not_converged"
          : "unknown",
      });
      continue;
    }
    successful += 1;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    organizationId: targetOrg.id,
    attempts,
    successful,
    failed: attempts - successful,
    pass: successful === attempts,
    failures,
  };

  const outputDir = "/workspace/artifacts/stability";
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "repair-request-certification.json"),
    JSON.stringify(output, null, 2),
  );

  console.log(
    `Repair runtime certification complete: ${successful}/${attempts} successful attempts.`,
  );
  if (successful !== attempts) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("repair runtime certification failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
