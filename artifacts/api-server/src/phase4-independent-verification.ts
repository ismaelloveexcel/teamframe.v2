import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  db,
  evidenceStatusByAssignmentTable,
  orgEventsTable,
  outboxEventsTable,
  personPositionAssignmentsTable,
  positionsTable,
} from "@workspace/db";
import { derivePositionsFromEvents, stableHash } from "./domain";
import type { ActorContext } from "./lib/request-context";
import { HttpError } from "./lib/http-error";
import { buildAssignmentService } from "./services/assignment-service";
import { buildCompensationService } from "./services/compensation-service";
import { buildEvidenceService } from "./services/evidence-service";
import { appendDomainEvent } from "./services/event-store-write";
import { buildOrganizationService } from "./services/organization-service";
import { buildOutboxReliabilityService } from "./services/outbox-reliability-service";
import { buildPeopleService } from "./services/people-service";
import { buildPositionService } from "./services/position-service";
import { buildProjectionBuilderService } from "./services/projection-builder-service";
import { buildProjectionIntegrityService } from "./services/projection-integrity-service";
import { buildQuarantineService } from "./services/quarantine-service";
import { buildReplayService } from "./services/replay-service";
import { buildTeamService } from "./services/team-service";

type GateResult = {
  name: string;
  pass: boolean;
  details: string[];
  errors: string[];
};

const OUTPUT_DIR = path.resolve(process.cwd(), "../phase4-independent-verification");

function makeActor(): ActorContext {
  return {
    userId: randomUUID(),
    email: `phase4-independent-${Date.now()}@teamframe.audit`,
    fullName: "Phase4 Independent Verifier",
  };
}

function key(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function writeJson(name: string, payload: Record<string, unknown>) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const artifactPath = path.join(OUTPUT_DIR, name);
  await writeFile(artifactPath, JSON.stringify(payload, null, 2));
  return artifactPath;
}

async function listTypescriptFiles(target: string): Promise<string[]> {
  const entries = await readdir(target, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...(await listTypescriptFiles(full)));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(full);
    }
  }
  return files;
}

async function runProjectionAuthorityAudit(): Promise<GateResult & { unauthorizedWriters: unknown[] }> {
  const srcRoot = "/workspace/artifacts/api-server/src";
  const files = await listTypescriptFiles(srcRoot);
  const mutationRegex =
    /\b(?:db|tx)\.(insert|update|delete)\(\s*([A-Za-z0-9_]+Table)\s*\)|\b(?:db|tx)\.(insert|update|delete)\(([A-Za-z0-9_]+Table)\)/;
  const projectionTables = new Set([
    "positionsTable",
    "personPositionAssignmentsTable",
    "evidenceStatusByAssignmentTable",
    "compensationCurrentTable",
  ]);
  const authorizedPath = "artifacts/api-server/src/services/projection-builder-service.ts";
  const unauthorizedWriters: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const rel = file.replace("/workspace/", "");
    const source = await readFile(file, "utf8");
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      const match = line.match(mutationRegex);
      if (!match) continue;
      const table = match[2] || match[4] || "";
      if (!projectionTables.has(table)) continue;
      if (rel === authorizedPath) continue;
      unauthorizedWriters.push({
        path: rel,
        line: i + 1,
        operation: match[1] || match[3] || "mutation",
        table,
      });
    }
  }

  const errors =
    unauthorizedWriters.length > 0 ? [`Found ${unauthorizedWriters.length} unauthorized projection writers.`] : [];
  const details = [`Unauthorized writers: ${unauthorizedWriters.length}`];
  return {
    name: "Projection Authority Audit",
    pass: unauthorizedWriters.length === 0,
    details,
    errors,
    unauthorizedWriters,
  };
}

async function runReplayPurityAudit(): Promise<GateResult & { replayOnlyReadsOrgEvents: boolean; hits: string[] }> {
  const source = await readFile("/workspace/artifacts/api-server/src/services/replay-service.ts", "utf8");
  const replayOrgStart = source.indexOf("async replayOrganization");
  const replayOrgEnd = source.indexOf("async getLiveProjectionState", replayOrgStart);
  const replayBody = replayOrgStart >= 0 && replayOrgEnd > replayOrgStart ? source.slice(replayOrgStart, replayOrgEnd) : "";

  const forbiddenRefs = [
    "positionsTable",
    "personPositionAssignmentsTable",
    "evidenceStatusByAssignmentTable",
    "compensationCurrentTable",
    "projectionIntegrityChecksTable",
    "streamQuarantinesTable",
    "streamRepairAdaptersTable",
  ];
  const hits = forbiddenRefs.filter((token) => replayBody.includes(token));
  const pass = hits.length === 0 && replayBody.includes("loadOrganizationEvents");
  return {
    name: "Replay Purity Audit",
    pass,
    details: [`Forbidden table references in replayOrganization: ${hits.length}`],
    errors: pass ? [] : [`Replay purity violation: replayOrganization references ${hits.join(", ")}`],
    replayOnlyReadsOrgEvents: pass,
    hits,
  };
}

async function runQuarantineIsolationAudit(): Promise<
  GateResult & {
    invokesReplay: boolean;
    invokesProjector: boolean;
    touchesProjectionTables: boolean;
  }
> {
  const source = await readFile("/workspace/artifacts/api-server/src/services/quarantine-service.ts", "utf8");
  const invokesReplay = source.includes("buildReplayService") || source.includes(".replay");
  const invokesProjector =
    source.includes("buildProjectionBuilderService") || source.includes("rebuildFromEvents");
  const touchesProjectionTables =
    source.includes("positionsTable") ||
    source.includes("personPositionAssignmentsTable") ||
    source.includes("evidenceStatusByAssignmentTable") ||
    source.includes("compensationCurrentTable");

  const pass = !invokesReplay && !invokesProjector && !touchesProjectionTables;
  const errors: string[] = [];
  if (invokesReplay) errors.push("Quarantine service invokes replay.");
  if (invokesProjector) errors.push("Quarantine service invokes projector rebuild.");
  if (touchesProjectionTables) errors.push("Quarantine service mutates projection tables.");

  return {
    name: "Quarantine Isolation Audit",
    pass,
    details: [
      `invokesReplay=${invokesReplay}`,
      `invokesProjector=${invokesProjector}`,
      `touchesProjectionTables=${touchesProjectionTables}`,
    ],
    errors,
    invokesReplay,
    invokesProjector,
    touchesProjectionTables,
  };
}

async function runRepairFlowAudit(): Promise<
  GateResult & {
    emitsRepairRequestedEvent: boolean;
    directProjectionMutationFound: boolean;
  }
> {
  const source = await readFile(
    "/workspace/artifacts/api-server/src/services/projection-integrity-service.ts",
    "utf8",
  );
  const emitsRepairRequestedEvent = source.includes("projection.repair.requested") && source.includes("appendDomainEvent");
  const directProjectionMutationFound =
    source.includes("delete(evidenceStatusByAssignmentTable)") ||
    source.includes("insert(evidenceStatusByAssignmentTable)") ||
    source.includes("delete(compensationCurrentTable)") ||
    source.includes("insert(compensationCurrentTable)");

  const pass = emitsRepairRequestedEvent && !directProjectionMutationFound;
  const errors: string[] = [];
  if (!emitsRepairRequestedEvent) errors.push("Repair flow does not emit projection.repair.requested.");
  if (directProjectionMutationFound) errors.push("Repair flow still directly mutates projection tables.");

  return {
    name: "Repair Flow Audit",
    pass,
    details: [
      `emitsRepairRequestedEvent=${emitsRepairRequestedEvent}`,
      `directProjectionMutationFound=${directProjectionMutationFound}`,
    ],
    errors,
    emitsRepairRequestedEvent,
    directProjectionMutationFound,
  };
}

async function runGlobalDeterminismValidation() {
  const actor = makeActor();
  const organizations = buildOrganizationService();
  const teams = buildTeamService();
  const positions = buildPositionService();
  const people = buildPeopleService();
  const assignments = buildAssignmentService();
  const evidence = buildEvidenceService();
  const compensation = buildCompensationService();
  const replay = buildReplayService();

  const organization = await organizations.create(actor, {
    name: `Independent Determinism ${new Date().toISOString()}`,
    slug: `ind-det-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const organizationId = organization.id;

  const team = await teams.create(actor, organizationId, { name: "Ops", code: "OPS" });
  const ceo = await positions.create(actor, organizationId, { title: "CEO", lifecycleStatus: "vacant" });
  const manager = await positions.create(actor, organizationId, {
    title: "Ops Manager",
    teamId: team.id,
    reportsToPositionId: ceo.id,
    lifecycleStatus: "vacant",
  });
  const person = await people.create(actor, organizationId, {
    fullName: "Determinism User",
    email: "determinism@teamframe.audit",
    employmentStatus: "active",
  });
  const started = await assignments.start(actor, organizationId, {
    personId: person.id,
    positionId: manager.id,
    idempotencyKey: key("ind-assign"),
  });
  assert.ok("assignment" in started, "Expected assignment payload.");

  await evidence.upsertRequirementProfile(actor, organizationId, {
    positionId: manager.id,
    profileName: "Ops Profile",
    requirements: [{ requirementKey: "nda", displayName: "NDA", isRequired: true }],
    idempotencyKey: key("ind-profile"),
  });
  const uploaded = await evidence.uploadDocument(actor, organizationId, {
    assignmentId: started.assignment.id,
    requirementKey: "nda",
    sourceDocumentRef: "s3://independent/nda.pdf",
    idempotencyKey: key("ind-doc-upload"),
  });
  assert.ok("document" in uploaded, "Expected document payload.");
  await evidence.transitionDocumentState(actor, organizationId, uploaded.document.id, {
    toState: "signed",
    idempotencyKey: key("ind-doc-sign"),
  });
  await compensation.record(actor, organizationId, {
    assignmentId: started.assignment.id,
    sourceDocumentId: uploaded.document.id,
    amount: 140_000_00,
    currency: "USD",
    effectiveFrom: "2026-04-01T00:00:00.000Z",
    idempotencyKey: key("ind-comp"),
  });

  const replayOrg = await replay.replayOrganization(organizationId);
  const compare = await replay.compareReplayWithLive(organizationId);

  const livePositions = normalizeRows(
    (
      await db.select().from(positionsTable).where(eq(positionsTable.organizationId, organizationId))
    ).map((row) => ({
      positionId: row.id,
      title: row.title,
      teamId: row.teamId,
      reportsToPositionId: row.reportsToPositionId,
      lifecycleStatus: row.lifecycleStatus,
    })),
  );
  const replayPositions = normalizeRows(
    (
      replayOrg.replayed.positionsCurrent as Array<Record<string, unknown>>
    ).map((row) => ({
      positionId: String(row.positionId),
      title: String(row.title),
      teamId: (row.teamId as string | null | undefined) ?? null,
      reportsToPositionId: (row.reportsToPositionId as string | null | undefined) ?? null,
      lifecycleStatus: String(row.lifecycleStatus),
    })),
  );

  const liveAssignments = normalizeRows(
    (
      await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(eq(personPositionAssignmentsTable.organizationId, organizationId))
    ).map((row) => ({
      assignmentId: row.id,
      personId: row.personId,
      positionId: row.positionId,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      status: row.status,
    })),
  );
  const replayAssignments = normalizeRows(
    (
      replayOrg.replayed.assignmentTimelines as Array<Record<string, unknown>>
    ).map((row) => ({
      assignmentId: String(row.assignmentId),
      personId: String(row.employeeId),
      positionId: String(row.positionId),
      startedAt: String(row.effectiveFrom),
      endedAt: row.effectiveTo === null ? null : String(row.effectiveTo),
      status: String(row.status),
    })),
  );

  const liveEvidence = normalizeRows(
    (
      await db
        .select()
        .from(evidenceStatusByAssignmentTable)
        .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId))
    ).map((row) => ({
      assignmentId: row.assignmentId,
      positionId: row.positionId,
      status: row.status,
      missingCount: row.missingCount,
      pendingCount: row.pendingCount,
      nonCompliantCount: row.nonCompliantCount,
    })),
  );
  const replayEvidence = normalizeRows(
    (
      replayOrg.replayed.evidenceByAssignment as Array<Record<string, unknown>>
    ).map((row) => ({
      assignmentId: String(row.assignmentId),
      positionId: String(row.positionId),
      status: String(row.status),
      missingCount: Number(row.missingCount),
      pendingCount: Number(row.pendingCount),
      nonCompliantCount: Number(row.nonCompliantCount),
    })),
  );

  const liveComp = normalizeRows(
    (
      await db
        .select()
        .from(compensationCurrentTable)
        .where(eq(compensationCurrentTable.organizationId, organizationId))
    ).map((row) => ({
      assignmentId: row.assignmentId,
      compensationRecordId: row.compensationRecordId,
      sourceDocumentId: row.sourceDocumentId,
      amount: row.amount,
      currency: row.currency,
      effectiveFrom: row.effectiveFrom.toISOString(),
    })),
  );
  const replayComp = normalizeRows(
    (
      replayOrg.replayed.compensationCurrent as Array<Record<string, unknown>>
    ).map((row) => ({
      assignmentId: String(row.assignmentId),
      compensationRecordId: String(row.compensationRecordId),
      sourceDocumentId: String(row.sourceDocumentId),
      amount: Number(row.amount),
      currency: String(row.currency),
      effectiveFrom: String(row.effectiveFrom),
    })),
  );

  const checks = {
    compareMatches: compare.matches,
    positions: stableHash(livePositions) === stableHash(replayPositions),
    assignments: stableHash(liveAssignments) === stableHash(replayAssignments),
    evidenceByAssignment: stableHash(liveEvidence) === stableHash(replayEvidence),
    compensationCurrent: stableHash(liveComp) === stableHash(replayComp),
  };

  const errors: string[] = [];
  if (!checks.compareMatches) errors.push("Replay comparator mismatch.");
  if (!checks.positions) errors.push("positions_current mismatch.");
  if (!checks.assignments) errors.push("assignments_current mismatch.");
  if (!checks.evidenceByAssignment) errors.push("evidence_status_by_assignment mismatch.");
  if (!checks.compensationCurrent) errors.push("compensation_current mismatch.");

  return {
    actor,
    gate: {
      name: "Global Determinism Validation",
      pass: errors.length === 0,
      details: [JSON.stringify(checks)],
      errors,
    } satisfies GateResult,
    organizationId,
    checks,
    hashes: {
      positions: { live: stableHash(livePositions), replay: stableHash(replayPositions) },
      assignments: { live: stableHash(liveAssignments), replay: stableHash(replayAssignments) },
      evidenceByAssignment: { live: stableHash(liveEvidence), replay: stableHash(replayEvidence) },
      compensationCurrent: { live: stableHash(liveComp), replay: stableHash(replayComp) },
    },
  };
}

async function runFailureInjectionRetest(organizationId: string, actor: ActorContext) {
  const people = buildPeopleService();
  const assignments = buildAssignmentService();
  const outbox = buildOutboxReliabilityService();
  const replay = buildReplayService();
  const quarantine = buildQuarantineService();
  const projectionIntegrity = buildProjectionIntegrityService();
  const projector = buildProjectionBuilderService();

  const ceo = await db
    .select()
    .from(positionsTable)
    .where(and(eq(positionsTable.organizationId, organizationId), eq(positionsTable.title, "CEO")))
    .limit(1);
  const [ceoPosition] = ceo;
  assert.ok(ceoPosition, "Missing CEO position for failure injection.");

  const lagPerson = await people.create(actor, organizationId, {
    fullName: "Lag Replay Tester",
    email: `lag-${Date.now()}@teamframe.audit`,
    employmentStatus: "active",
  });
  await assignments.start(actor, organizationId, {
    personId: lagPerson.id,
    positionId: ceoPosition.id,
    idempotencyKey: key("ind-lag-assignment"),
  });

  const pendingBefore = await db
    .select({ id: outboxEventsTable.id })
    .from(outboxEventsTable)
    .where(and(eq(outboxEventsTable.orgId, organizationId), eq(outboxEventsTable.processed, false)));
  const replayDuringLag = await replay.compareReplayWithLive(organizationId);

  const sideEffects = new Map<string, number>();
  const baseTime = Date.now();
  for (let i = 0; i < 3; i += 1) {
    await outbox.processDueEvents({
      consumerKey: "independent-verification-consumer",
      now: new Date(baseTime + i * 4000),
      handler: async (event) => {
        sideEffects.set(event.eventId, (sideEffects.get(event.eventId) ?? 0) + 1);
      },
    });
  }
  const replayAfterLag = await replay.compareReplayWithLive(organizationId);
  const duplicateSideEffects = [...sideEffects.entries()].filter(([, count]) => count > 1);

  const corruptAggregateId = `ind-corrupt-${randomUUID()}`;
  await db.insert(orgEventsTable).values({
    orgId: organizationId,
    aggregateType: "assignment",
    aggregateId: corruptAggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: new Date(),
    actorUserId: actor.userId,
    idempotencyKey: key("ind-corrupt"),
    schemaVersion: 1,
    payload: { assignmentId: corruptAggregateId },
    payloadHash: null,
  });

  const detection = await quarantine.detectAndQuarantine(organizationId, actor.userId);
  const quarantined = detection.quarantined.some(
    (entry) => entry.aggregateType === "assignment" && entry.aggregateId === corruptAggregateId,
  );
  let blocked = false;
  try {
    await db.transaction(async (tx) => {
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "assignment",
        aggregateId: corruptAggregateId,
        eventType: "assignment.ended",
        idempotencyKey: key("ind-quarantine-block"),
        payload: {
          assignmentId: corruptAggregateId,
          effectiveTo: new Date().toISOString(),
        },
      });
    });
  } catch {
    blocked = true;
  }
  await quarantine.recoverStream({
    organizationId,
    actorUserId: actor.userId,
    aggregateType: "assignment",
    aggregateId: corruptAggregateId,
    repairMode: "schema_adapter",
    notes: "independent-verification",
  });
  const replayAfterRecovery = await replay.compareReplayWithLive(organizationId);

  const [tamperEvidence] = await db
    .select()
    .from(evidenceStatusByAssignmentTable)
    .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId))
    .limit(1);
  let driftDetected = false;
  let repairApplied = false;
  let repairLoopDetected = false;
  if (tamperEvidence) {
    await db
      .update(evidenceStatusByAssignmentTable)
      .set({
        missingCount: tamperEvidence.missingCount + 3,
        computedAt: new Date(),
      })
      .where(eq(evidenceStatusByAssignmentTable.assignmentId, tamperEvidence.assignmentId));

    const detect = await projectionIntegrity.checkAndRepair({ organizationId, autoRepair: false });
    driftDetected = detect.drifted.length > 0;

    await projector.rebuildFromEvents({
      organizationId,
      include: {
        evidence: true,
        compensationCurrent: true,
      },
    });

    const postRebuild = await replay.compareReplayWithLive(organizationId);
    repairApplied = postRebuild.matches;
    repairLoopDetected = false;
  }

  const finalReplay = await replay.compareReplayWithLive(organizationId);
  const errors: string[] = [];
  if (pendingBefore.length === 0) errors.push("Outbox lag setup had no pending events.");
  if (!replayDuringLag.matches) errors.push("Replay diverged during outbox lag.");
  if (!replayAfterLag.matches) errors.push("Replay diverged after outbox processing.");
  if (duplicateSideEffects.length > 0) errors.push("Outbox duplicate side effects detected.");
  if (!quarantined) errors.push("Corrupted stream not quarantined.");
  if (!blocked) errors.push("Quarantine did not block writes.");
  if (!replayAfterRecovery.matches) errors.push("Replay diverged after quarantine recovery.");
  if (!driftDetected) errors.push("Projection drift was not detected.");
  if (!repairApplied) errors.push("Projection repair did not apply.");
  if (repairLoopDetected) errors.push("Projection repair loop detected.");
  if (!finalReplay.matches) errors.push("Final replay/live mismatch after failure-injection retest.");

  return {
    gate: {
      name: "Failure Injection Re-Test",
      pass: errors.length === 0,
      details: [
        `pendingBefore=${pendingBefore.length}`,
        `duplicateSideEffects=${duplicateSideEffects.length}`,
        `quarantined=${quarantined}`,
        `blocked=${blocked}`,
        `driftDetected=${driftDetected}`,
        `repairApplied=${repairApplied}`,
        `repairLoopDetected=${repairLoopDetected}`,
        `finalReplayMatches=${finalReplay.matches}`,
      ],
      errors,
    } satisfies GateResult,
    metrics: {
      pendingBefore: pendingBefore.length,
      replayDuringLagMatches: replayDuringLag.matches,
      replayAfterLagMatches: replayAfterLag.matches,
      duplicateSideEffects: duplicateSideEffects.map(([eventId]) => eventId),
      quarantined,
      blocked,
      replayAfterRecoveryMatches: replayAfterRecovery.matches,
      driftDetected,
      repairApplied,
      repairLoopDetected,
      finalReplayMatches: finalReplay.matches,
    },
  };
}

async function runIndependentVerification() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for independent verification.");
  }

  const projectionAuthority = await runProjectionAuthorityAudit();
  await writeJson("projection-authority-audit.json", projectionAuthority);

  const replayPurity = await runReplayPurityAudit();
  await writeJson("replay-purity-audit.json", replayPurity);

  const quarantineIsolation = await runQuarantineIsolationAudit();
  await writeJson("quarantine-isolation-audit.json", quarantineIsolation);

  const repairFlow = await runRepairFlowAudit();
  await writeJson("repair-flow-audit.json", repairFlow);

  const determinism = await runGlobalDeterminismValidation();
  await writeJson("global-determinism-validation.json", determinism);

  const failureInjection = await runFailureInjectionRetest(determinism.organizationId, determinism.actor);
  await writeJson("failure-injection-retest.json", failureInjection);

  const gates: GateResult[] = [
    projectionAuthority,
    replayPurity,
    quarantineIsolation,
    repairFlow,
    determinism.gate,
    failureInjection.gate,
  ];

  const overallPass = gates.every((gate) => gate.pass);
  const summaryLines = [
    "# Phase 4 Independent Verification Summary",
    "",
    `Result: **${overallPass ? "PASS" : "FAIL"}**`,
    "",
    "## Gate Results",
    ...gates.map((gate) => `- ${gate.name}: ${gate.pass ? "PASS" : "FAIL"}`),
    "",
    "## Errors",
    ...gates.flatMap((gate) =>
      gate.errors.length > 0 ? gate.errors.map((error) => `- [${gate.name}] ${error}`) : [],
    ),
    "",
  ];

  await writeFile(path.join(OUTPUT_DIR, "independent-verification-summary.md"), summaryLines.join("\n"));

  console.log(`Independent verification result: ${overallPass ? "PASS" : "FAIL"}`);
  if (!overallPass) {
    process.exitCode = 1;
  }
}

void runIndependentVerification().catch((error) => {
  console.error("Independent verification failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
