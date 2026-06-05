import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  db,
  orgEventsTable,
  organizationMembershipsTable,
  organizationsTable,
  peopleTable,
  positionsTable,
} from "@workspace/db";
import { buildProjectionBuilderService } from "./services/projection-builder-service";
import { buildReplayService } from "./services/replay-service";

type ScenarioResult = {
  scenario: "missing_version" | "duplicate_version" | "invalid_payload" | "legacy_schema_version";
  projectorCrashed: boolean;
  converged: boolean;
  error: string | null;
};

async function getFixtureContext() {
  const [organization] = await db.select({ id: organizationsTable.id }).from(organizationsTable).limit(1);
  if (!organization) throw new Error("No organization found for malformed stream certification.");

  const [member] = await db
    .select({ userId: organizationMembershipsTable.userId })
    .from(organizationMembershipsTable)
    .where(eq(organizationMembershipsTable.organizationId, organization.id))
    .limit(1);
  if (!member) throw new Error(`No membership found for org ${organization.id}`);

  const [person] = await db
    .select({ id: peopleTable.id })
    .from(peopleTable)
    .where(eq(peopleTable.organizationId, organization.id))
    .limit(1);
  const [position] = await db
    .select({ id: positionsTable.id })
    .from(positionsTable)
    .where(eq(positionsTable.organizationId, organization.id))
    .limit(1);

  if (!person || !position) {
    throw new Error(`Org ${organization.id} does not have person/position seed data.`);
  }

  return {
    orgId: organization.id,
    actorUserId: member.userId,
    personId: person.id,
    positionId: position.id,
  };
}

async function injectMissingVersionScenario(ctx: Awaited<ReturnType<typeof getFixtureContext>>) {
  const aggregateId = randomUUID();
  const now = new Date();
  await db.insert(orgEventsTable).values({
    orgId: ctx.orgId,
    aggregateType: "assignment",
    aggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: now,
    actorUserId: ctx.actorUserId,
    idempotencyKey: `malformed-missing-v1-${randomUUID()}`,
    schemaVersion: 1,
    payload: {
      assignmentId: aggregateId,
      employeeId: ctx.personId,
      positionId: ctx.positionId,
      effectiveFrom: now.toISOString(),
    },
    payloadHash: null,
  });
  await db.insert(orgEventsTable).values({
    orgId: ctx.orgId,
    aggregateType: "assignment",
    aggregateId,
    eventType: "assignment.ended",
    version: 3,
    occurredAt: now,
    actorUserId: ctx.actorUserId,
    idempotencyKey: `malformed-missing-v3-${randomUUID()}`,
    schemaVersion: 1,
    payload: {
      assignmentId: aggregateId,
      effectiveTo: now.toISOString(),
    },
    payloadHash: null,
  });
}

async function injectDuplicateVersionScenario(ctx: Awaited<ReturnType<typeof getFixtureContext>>) {
  const aggregateId = randomUUID();
  const now = new Date();
  await db.insert(orgEventsTable).values({
    orgId: ctx.orgId,
    aggregateType: "assignment",
    aggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: now,
    actorUserId: ctx.actorUserId,
    idempotencyKey: `malformed-dup-v1-${randomUUID()}`,
    schemaVersion: 1,
    payload: {
      assignmentId: aggregateId,
      employeeId: ctx.personId,
      positionId: ctx.positionId,
      effectiveFrom: now.toISOString(),
    },
    payloadHash: null,
  });
  await db.insert(orgEventsTable).values({
    orgId: ctx.orgId,
    aggregateType: "assignment",
    aggregateId,
    eventType: "assignment.started",
    version: 2,
    occurredAt: now,
    actorUserId: ctx.actorUserId,
    idempotencyKey: `malformed-dup-v2-${randomUUID()}`,
    schemaVersion: 1,
    payload: {
      assignmentId: aggregateId,
      employeeId: ctx.personId,
      positionId: ctx.positionId,
      effectiveFrom: now.toISOString(),
    },
    payloadHash: null,
  });
}

async function injectInvalidPayloadScenario(ctx: Awaited<ReturnType<typeof getFixtureContext>>) {
  const aggregateId = randomUUID();
  const now = new Date();
  await db.insert(orgEventsTable).values({
    orgId: ctx.orgId,
    aggregateType: "assignment",
    aggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: now,
    actorUserId: ctx.actorUserId,
    idempotencyKey: `malformed-invalid-payload-${randomUUID()}`,
    schemaVersion: 1,
    payload: {
      assignmentId: aggregateId,
      effectiveFrom: now.toISOString(),
    },
    payloadHash: null,
  });
}

async function injectLegacySchemaScenario(ctx: Awaited<ReturnType<typeof getFixtureContext>>) {
  const aggregateId = randomUUID();
  const now = new Date();
  await db.insert(orgEventsTable).values({
    orgId: ctx.orgId,
    aggregateType: "assignment",
    aggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: now,
    actorUserId: ctx.actorUserId,
    idempotencyKey: `malformed-legacy-schema-${randomUUID()}`,
    schemaVersion: 0,
    payload: {
      assignmentId: aggregateId,
      personId: ctx.personId,
      positionId: ctx.positionId,
      effectiveFrom: now.toISOString(),
    },
    payloadHash: null,
  });
}

async function runScenario(
  name: ScenarioResult["scenario"],
  inject: (ctx: Awaited<ReturnType<typeof getFixtureContext>>) => Promise<void>,
): Promise<ScenarioResult> {
  const ctx = await getFixtureContext();
  const projector = buildProjectionBuilderService();
  const replay = buildReplayService();

  try {
    await inject(ctx);
    await projector.rebuildFromEvents({
      organizationId: ctx.orgId,
      include: {
        assignments: true,
        evidence: true,
        compensationCurrent: true,
      },
    });
    const comparison = await replay.compareReplayWithLive(ctx.orgId);
    return {
      scenario: name,
      projectorCrashed: false,
      converged: comparison.matches,
      error: comparison.matches ? null : "replay_live_mismatch",
    };
  } catch (error) {
    return {
      scenario: name,
      projectorCrashed: true,
      converged: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const scenarios: Array<Promise<ScenarioResult>> = [
    runScenario("missing_version", injectMissingVersionScenario),
    runScenario("duplicate_version", injectDuplicateVersionScenario),
    runScenario("invalid_payload", injectInvalidPayloadScenario),
    runScenario("legacy_schema_version", injectLegacySchemaScenario),
  ];
  const results = await Promise.all(scenarios);
  const projectorCrashes = results.filter((result) => result.projectorCrashed).length;
  const convergenceFailures = results.filter((result) => !result.converged).length;

  const output = {
    generatedAt: new Date().toISOString(),
    results,
    projectorCrashes,
    convergenceFailures,
    pass: projectorCrashes === 0 && convergenceFailures === 0,
  };

  await mkdir("/workspace/artifacts/stability", { recursive: true });
  await writeFile(
    path.join("/workspace/artifacts/stability", "malformed-stream-certification.json"),
    JSON.stringify(output, null, 2),
  );

  console.log(
    `Malformed stream certification complete: crashes=${projectorCrashes}, convergenceFailures=${convergenceFailures}.`,
  );
  if (!output.pass) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error("malformed stream certification failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
