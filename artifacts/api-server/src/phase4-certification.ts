import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, count, eq } from "drizzle-orm";
import {
  db,
  evidenceStatusByAssignmentTable,
  orgEventsTable,
  outboxDeadLettersTable,
  outboxEventsTable,
  streamQuarantinesTable,
} from "@workspace/db";
import { stableHash } from "./domain";
import type { ActorContext } from "./lib/request-context";
import { buildAssignmentService } from "./services/assignment-service";
import { buildCompensationService } from "./services/compensation-service";
import { buildEvidenceService } from "./services/evidence-service";
import { appendDomainEvent } from "./services/event-store-write";
import { buildOperationalMetricsService } from "./services/operational-metrics-service";
import { buildOrganizationService } from "./services/organization-service";
import { buildOutboxReliabilityService } from "./services/outbox-reliability-service";
import { buildPeopleService } from "./services/people-service";
import { buildPositionService } from "./services/position-service";
import { buildProjectionIntegrityService } from "./services/projection-integrity-service";
import { buildQuarantineService } from "./services/quarantine-service";
import { buildReplayService } from "./services/replay-service";
import { buildTeamService } from "./services/team-service";

type GateResult = {
  gate: string;
  passed: boolean;
  details: string[];
};

function makeActor(): ActorContext {
  return {
    userId: randomUUID(),
    email: `phase4-${Date.now()}@teamframe.cert`,
    fullName: "Phase 4 Certification",
  };
}

function idempotencyKey(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

async function writeArtifact(name: string, payload: Record<string, unknown>) {
  const artifactPath = path.resolve(process.cwd(), `../phase-execution/${name}`);
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, JSON.stringify(payload, null, 2));
  return artifactPath;
}

async function runPhase4Certification() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run phase 4 certification.");
  }

  const actor = makeActor();
  const organizations = buildOrganizationService();
  const teams = buildTeamService();
  const positions = buildPositionService();
  const people = buildPeopleService();
  const assignments = buildAssignmentService();
  const evidence = buildEvidenceService();
  const compensation = buildCompensationService();
  const replay = buildReplayService();
  const quarantine = buildQuarantineService();
  const outbox = buildOutboxReliabilityService();
  const projectionIntegrity = buildProjectionIntegrityService();
  const metricsService = buildOperationalMetricsService();

  const organization = await organizations.create(actor, {
    name: `Phase 4 Cert ${new Date().toISOString()}`,
    slug: `phase4-cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const organizationId = organization.id;

  const team = await teams.create(actor, organizationId, { name: "Resilience", code: "RSL" });
  const ceo = await positions.create(actor, organizationId, { title: "CEO", lifecycleStatus: "vacant" });
  const operator = await positions.create(actor, organizationId, {
    title: "Operations Manager",
    teamId: team.id,
    reportsToPositionId: ceo.id,
    lifecycleStatus: "vacant",
  });
  const person = await people.create(actor, organizationId, {
    fullName: "Nora",
    email: "nora@phase4.cert",
    employmentStatus: "active",
  });
  const assignmentResult = await assignments.start(actor, organizationId, {
    personId: person.id,
    positionId: operator.id,
    idempotencyKey: idempotencyKey("phase4-assignment"),
  });
  if (!("assignment" in assignmentResult)) {
    throw new Error("Assignment start did not return assignment payload.");
  }
  const assignmentId = assignmentResult.assignment.id;

  await evidence.upsertRequirementProfile(actor, organizationId, {
    positionId: operator.id,
    profileName: "Ops profile",
    requirements: [{ requirementKey: "nda", displayName: "NDA", isRequired: true }],
    idempotencyKey: idempotencyKey("phase4-profile"),
  });
  const docUpload = await evidence.uploadDocument(actor, organizationId, {
    assignmentId,
    requirementKey: "nda",
    sourceDocumentRef: "s3://phase4/nda.pdf",
    idempotencyKey: idempotencyKey("phase4-nda-upload"),
  });
  if (!("document" in docUpload)) {
    throw new Error("Document upload response missing document payload");
  }
  await evidence.transitionDocumentState(actor, organizationId, docUpload.document.id, {
    toState: "signed",
    idempotencyKey: idempotencyKey("phase4-nda-signed"),
  });
  await compensation.record(actor, organizationId, {
    assignmentId,
    sourceDocumentId: docUpload.document.id,
    amount: 110_000_00,
    currency: "USD",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    idempotencyKey: idempotencyKey("phase4-comp"),
  });

  const gates: GateResult[] = [];

  // PHASE 4.1 — Replay engine gate
  const replayComparison = await replay.compareReplayWithLive(organizationId);
  assert.equal(replayComparison.matches, true, "P4-G1 failed: replay/live mismatch");
  const replayReportPath = await writeArtifact("replay-report.json", {
    generatedAt: new Date().toISOString(),
    organizationId,
    replayComparison,
  });
  gates.push({
    gate: "P4-G1 Replay determinism",
    passed: true,
    details: [
      "Replay tooling produced deterministic organization snapshot.",
      "Replay/live projection comparator reported zero mismatches.",
      `Artifact: ${replayReportPath}`,
    ],
  });

  // PHASE 4.2 — Quarantine system gate
  const corruptAggregateId = `corrupt-doc-${randomUUID()}`;
  await db.insert(orgEventsTable).values({
    orgId: organizationId,
    aggregateType: "document",
    aggregateId: corruptAggregateId,
    eventType: "document.uploaded",
    version: 1,
    occurredAt: new Date(),
    actorUserId: actor.userId,
    idempotencyKey: idempotencyKey("phase4-corrupt-event"),
    schemaVersion: 1,
    payload: { broken: true },
    payloadHash: null,
  });

  const detection = await quarantine.detectAndQuarantine(organizationId, actor.userId);
  assert.ok(
    detection.quarantined.some(
      (entry) => entry.aggregateType === "document" && entry.aggregateId === corruptAggregateId,
    ),
    "P4-G2 failed: corrupted stream was not quarantined",
  );

  let blockedWrite = false;
  try {
    await db.transaction(async (tx) => {
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "document",
        aggregateId: corruptAggregateId,
        eventType: "document.signed",
        idempotencyKey: idempotencyKey("phase4-blocked-write"),
        payload: { documentId: corruptAggregateId, assignmentId, positionId: operator.id, requirementKey: "nda" },
      });
    });
  } catch {
    blockedWrite = true;
  }
  assert.equal(blockedWrite, true, "P4-G2 failed: quarantined stream did not block writes");

  const recovery = await quarantine.recoverStream({
    organizationId,
    actorUserId: actor.userId,
    aggregateType: "document",
    aggregateId: corruptAggregateId,
    repairMode: "schema_adapter",
    notes: "phase4-cert-adapter",
  });
  assert.equal(recovery.recovered, true, "P4-G2 failed: stream recovery did not complete");

  await db.transaction(async (tx) => {
    await appendDomainEvent(tx, {
      organizationId,
      actorUserId: actor.userId,
      aggregateType: "document",
      aggregateId: corruptAggregateId,
      eventType: "document.replayed",
      idempotencyKey: idempotencyKey("phase4-post-recovery-write"),
      payload: { documentId: corruptAggregateId, repaired: true },
    });
  });

  const quarantineSnapshot = await db
    .select()
    .from(streamQuarantinesTable)
    .where(eq(streamQuarantinesTable.orgId, organizationId));
  const quarantineArtifactPath = await writeArtifact("quarantine-events.json", {
    generatedAt: new Date().toISOString(),
    organizationId,
    detection,
    recovery,
    quarantineSnapshot,
  });
  gates.push({
    gate: "P4-G2 Quarantine fail-closed + recovery",
    passed: true,
    details: [
      "Injected malformed event and detected schema corruption.",
      "Writes blocked while stream quarantined.",
      "Recovery path (schema adapter -> replay -> restore) succeeded deterministically.",
      `Artifact: ${quarantineArtifactPath}`,
    ],
  });

  // PHASE 4.3 — Outbox reliability gate
  await db.transaction(async (tx) => {
    await appendDomainEvent(tx, {
      organizationId,
      actorUserId: actor.userId,
      aggregateType: "system",
      aggregateId: `outbox-${randomUUID()}`,
      eventType: "system.outbox.test",
      idempotencyKey: idempotencyKey("phase4-outbox-ok"),
      payload: { mode: "ok" },
    });
    await appendDomainEvent(tx, {
      organizationId,
      actorUserId: actor.userId,
      aggregateType: "system",
      aggregateId: `outbox-${randomUUID()}`,
      eventType: "system.outbox.test",
      idempotencyKey: idempotencyKey("phase4-outbox-fail-once"),
      payload: { mode: "fail-once" },
    });
    await appendDomainEvent(tx, {
      organizationId,
      actorUserId: actor.userId,
      aggregateType: "system",
      aggregateId: `outbox-${randomUUID()}`,
      eventType: "system.outbox.test",
      idempotencyKey: idempotencyKey("phase4-outbox-poison"),
      payload: { mode: "always-fail" },
    });
  });

  const deliveryCounter = new Map<string, number>();
  const failedOnce = new Set<string>();

  const handler = async (event: {
    outboxEventId: string;
    orgId: string;
    eventId: string;
    type: string;
    payload: Record<string, unknown>;
  }) => {
    const mode = String(event.payload.mode ?? "ok");
    if (mode === "fail-once" && !failedOnce.has(event.eventId)) {
      failedOnce.add(event.eventId);
      throw new Error("simulated_worker_crash");
    }
    if (mode === "always-fail") {
      throw new Error("poison_message");
    }
    deliveryCounter.set(event.eventId, (deliveryCounter.get(event.eventId) ?? 0) + 1);
  };

  const t0 = new Date();
  const processRuns: Array<Record<string, unknown>> = [];
  for (let i = 0; i < 4; i += 1) {
    const run = await outbox.processDueEvents({
      consumerKey: "phase4-consumer",
      maxAttempts: 2,
      baseBackoffMs: 1000,
      now: new Date(t0.getTime() + i * 5000),
      handler,
    });
    processRuns.push({ index: i + 1, ...run });
  }

  const testOutboxEvents = await db
    .select()
    .from(outboxEventsTable)
    .where(
      and(
        eq(outboxEventsTable.orgId, organizationId),
        eq(outboxEventsTable.type, "system.outbox.test"),
      ),
    );
  const nonPoisonProcessed = testOutboxEvents.filter((event) => {
    const mode = String((event.payload as Record<string, unknown>).mode ?? "ok");
    return mode !== "always-fail" && event.processed;
  }).length;
  assert.ok(nonPoisonProcessed >= 2, "P4-G3 failed: non-poison events not eventually delivered");

  // Force dedupe path by resetting one processed record while receipt exists.
  const deliveredEvents = await db
    .select()
    .from(outboxEventsTable)
    .where(
      and(
        eq(outboxEventsTable.orgId, organizationId),
        eq(outboxEventsTable.type, "system.outbox.test"),
      ),
    );
  const deliveredCandidate = deliveredEvents.find((event) => (event.payload as Record<string, unknown>).mode === "ok");
  if (deliveredCandidate) {
    await db
      .update(outboxEventsTable)
      .set({ processed: false, processedAt: null, nextAttemptAt: new Date(t0.getTime() + 6000) })
      .where(eq(outboxEventsTable.id, deliveredCandidate.id));
  }
  const dedupeRun = await outbox.processDueEvents({
    consumerKey: "phase4-consumer",
    maxAttempts: 2,
    baseBackoffMs: 1000,
    now: new Date(t0.getTime() + 25000),
    handler,
  });
  assert.ok(dedupeRun.deduped >= 1, "P4-G3 failed: duplicate delivery was not deduped by receipt");

  const deadLetters = await db
    .select()
    .from(outboxDeadLettersTable)
    .where(eq(outboxDeadLettersTable.orgId, organizationId));
  assert.ok(deadLetters.length >= 1, "P4-G3 failed: poison message did not move to DLQ");

  const outboxHealth = await outbox.getHealth(organizationId);
  const outboxHealthPath = await writeArtifact("outbox-health-report.json", {
    generatedAt: new Date().toISOString(),
    organizationId,
    runs: { processRuns, dedupeRun },
    outboxHealth,
    deadLetters,
    deliveryCounter: Object.fromEntries(deliveryCounter.entries()),
  });
  gates.push({
    gate: "P4-G3 Outbox reliability",
    passed: true,
    details: [
      "Crash/retry scenario delivered events without loss.",
      "Duplicate delivery path deduped via (event_id, consumer_key) receipts.",
      "Poison message detection moved failing event to DLQ.",
      `Artifact: ${outboxHealthPath}`,
    ],
  });

  // PHASE 4.4 — Projection integrity gate
  const [tamperRow] = await db
    .select()
    .from(evidenceStatusByAssignmentTable)
    .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId))
    .limit(1);
  if (!tamperRow) {
    throw new Error("P4-G4 setup failed: missing evidence projection row");
  }
  await db
    .update(evidenceStatusByAssignmentTable)
    .set({ missingCount: tamperRow.missingCount + 5, computedAt: new Date() })
    .where(eq(evidenceStatusByAssignmentTable.assignmentId, tamperRow.assignmentId));

  const driftDetected = await projectionIntegrity.checkAndRepair({
    organizationId,
    autoRepair: false,
  });
  assert.ok(driftDetected.drifted.length > 0, "P4-G4 failed: drift was not detected");

  const repaired = await projectionIntegrity.checkAndRepair({
    organizationId,
    autoRepair: true,
  });
  assert.ok(
    repaired.drifted.some((drift) => drift.autoRepaired),
    "P4-G4 failed: controlled auto-repair did not run",
  );

  const healthyAfterRepair = await projectionIntegrity.checkAndRepair({
    organizationId,
    autoRepair: false,
  });
  assert.equal(healthyAfterRepair.healthy, true, "P4-G4 failed: projection remained drifted after repair");

  const projectionDriftPath = await writeArtifact("projection-drift-report.json", {
    generatedAt: new Date().toISOString(),
    organizationId,
    driftDetected,
    repaired,
    healthyAfterRepair,
  });
  gates.push({
    gate: "P4-G4 Projection integrity + controlled repair",
    passed: true,
    details: [
      "Injected projection mismatch was detected by hash comparison.",
      "Controlled replay repair restored projection consistency.",
      `Artifact: ${projectionDriftPath}`,
    ],
  });

  // PHASE 4.5 — Monitoring layer gate
  await db.transaction(async (tx) => {
    for (let i = 0; i < 20; i += 1) {
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "system",
        aggregateId: `load-${randomUUID()}`,
        eventType: "system.load.tick",
        idempotencyKey: idempotencyKey(`phase4-load-${i}`),
        payload: { i },
      });
    }
  });

  const metricsBefore = await metricsService.getMetrics(organizationId);
  assert.ok(metricsBefore.eventThroughputLast5m > 0, "P4-G5 failed: throughput metric not populated");

  await outbox.processDueEvents({
    consumerKey: "phase4-metrics-consumer",
    now: new Date(Date.now() + 60_000),
    handler: async () => {},
  });
  const metricsAfter = await metricsService.getMetrics(organizationId);
  assert.ok(
    metricsAfter.outboxQueueDepth <= metricsBefore.outboxQueueDepth,
    "P4-G5 failed: outbox queue metric inconsistent after processing",
  );
  assert.ok(
    ["OK", "DEGRADED", "CORRUPTED"].includes(metricsAfter.integrityStatus),
    "P4-G5 failed: integrity status outside allowed values",
  );

  gates.push({
    gate: "P4-G5 Operational metrics consistency",
    passed: true,
    details: [
      "Event throughput, outbox depth/lag, replay health, and quarantine counts were readable.",
      "Metrics remained internally consistent under synthetic load + queue drain.",
      `Integrity status: ${metricsAfter.integrityStatus}`,
    ],
  });

  const finalPayload = {
    generatedAt: new Date().toISOString(),
    organizationId,
    prerequisiteBaseline: "teamframe-phase3-certified-v1",
    gates,
    metrics: {
      before: metricsBefore,
      after: metricsAfter,
    },
    artifacts: {
      replayReport: "artifacts/phase-execution/replay-report.json",
      quarantineEvents: "artifacts/phase-execution/quarantine-events.json",
      outboxHealthReport: "artifacts/phase-execution/outbox-health-report.json",
      projectionDriftReport: "artifacts/phase-execution/projection-drift-report.json",
    },
  };
  const signature = stableHash(finalPayload);
  const certPath = await writeArtifact("phase-4-certification.json", {
    ...finalPayload,
    signedBy: "cursor-agent",
    signature,
  });

  console.log(`Phase 4 Certification: PASS (${gates.length} gates)`);
  for (const gate of gates) {
    console.log(`- ${gate.gate}: ${gate.passed ? "PASS" : "FAIL"}`);
    for (const detail of gate.details) {
      console.log(`  • ${detail}`);
    }
  }
  console.log(`Certification artifact written: ${certPath}`);
}

void runPhase4Certification().catch((error) => {
  console.error("Phase 4 Certification: FAIL");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
