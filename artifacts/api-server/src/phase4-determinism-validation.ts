import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  aggregateVersionsTable,
  compensationCurrentTable,
  db,
  evidenceStatusByAssignmentTable,
  orgEventsTable,
  outboxEventsTable,
  personPositionAssignmentsTable,
  positionsTable,
  streamQuarantinesTable,
} from "@workspace/db";
import { stableHash } from "./domain";
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
import { buildProjectionIntegrityService } from "./services/projection-integrity-service";
import { buildQuarantineService } from "./services/quarantine-service";
import { buildReplayService } from "./services/replay-service";
import { buildTeamService } from "./services/team-service";

type ScenarioStatus = {
  id: string;
  name: string;
  pass: boolean;
  details: string[];
  errors: string[];
};

function makeActor(): ActorContext {
  return {
    userId: randomUUID(),
    email: `phase4-validation-${Date.now()}@teamframe.audit`,
    fullName: "Phase 4 Validation",
  };
}

function idempotencyKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function writeJsonArtifact(name: string, payload: Record<string, unknown>) {
  const outputDir = path.resolve(process.cwd(), "../phase4-validation");
  await mkdir(outputDir, { recursive: true });
  const artifactPath = path.join(outputDir, name);
  await writeFile(artifactPath, JSON.stringify(payload, null, 2));
  return artifactPath;
}

async function writeSummaryMarkdown(
  payload: {
    verdict: "PASS" | "FAIL";
    confidence: "HIGH" | "MEDIUM" | "LOW";
    scenarios: ScenarioStatus[];
    criticalFindings: string[];
    checks: {
      determinism: boolean;
      replayConsistency: boolean;
      quarantineSafety: boolean;
      outboxSafety: boolean;
    };
  },
) {
  const lines = [
    "# Phase 4 Determinism & Resilience Validation",
    "",
    `- Verdict: **${payload.verdict}**`,
    `- Confidence: **${payload.confidence}**`,
    "",
    "## Scenario Results",
    "",
    "| ID | Scenario | Status |",
    "| --- | --- | --- |",
    ...payload.scenarios.map(
      (scenario) => `| ${scenario.id} | ${scenario.name} | ${scenario.pass ? "PASS" : "FAIL"} |`,
    ),
    "",
    "## Critical Findings",
    "",
    ...(payload.criticalFindings.length > 0
      ? payload.criticalFindings.map((finding) => `- ${finding}`)
      : ["- none"]),
    "",
    "## Determinism & Safety Checks",
    "",
    `- Determinism Check: ${payload.checks.determinism ? "PASS" : "FAIL"}`,
    `- Replay Consistency: ${payload.checks.replayConsistency ? "PASS" : "FAIL"}`,
    `- Quarantine Safety: ${payload.checks.quarantineSafety ? "PASS" : "FAIL"}`,
    `- Outbox Safety: ${payload.checks.outboxSafety ? "PASS" : "FAIL"}`,
    "",
  ];

  const outputDir = path.resolve(process.cwd(), "../phase4-validation");
  await mkdir(outputDir, { recursive: true });
  const markdownPath = path.join(outputDir, "validation-summary.md");
  await writeFile(markdownPath, lines.join("\n"));
  return markdownPath;
}

async function runValidation() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for phase4 deterministic validation.");
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

  const organization = await organizations.create(actor, {
    name: `Phase 4 Validation ${new Date().toISOString()}`,
    slug: `phase4-validation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const organizationId = organization.id;

  const scenarioStatuses: ScenarioStatus[] = [];
  const criticalFindings: string[] = [];

  // Deterministic fixture setup
  const coreTeam = await teams.create(actor, organizationId, { name: "Operations", code: "OPS" });
  const ceo = await positions.create(actor, organizationId, { title: "CEO", lifecycleStatus: "vacant" });
  const opsManagerA = await positions.create(actor, organizationId, {
    teamId: coreTeam.id,
    title: "Ops Manager A",
    reportsToPositionId: ceo.id,
    lifecycleStatus: "vacant",
  });
  const opsManagerB = await positions.create(actor, organizationId, {
    teamId: coreTeam.id,
    title: "Ops Manager B",
    reportsToPositionId: ceo.id,
    lifecycleStatus: "vacant",
  });

  const sarah = await people.create(actor, organizationId, {
    fullName: "Sarah Validator",
    email: "sarah.validator@teamframe.audit",
    employmentStatus: "active",
  });
  const baselineAssignmentStart = await assignments.start(actor, organizationId, {
    personId: sarah.id,
    positionId: opsManagerA.id,
    idempotencyKey: idempotencyKey("validation-baseline-assignment"),
  });
  if (!("assignment" in baselineAssignmentStart)) {
    throw new Error("Expected assignment payload for baseline setup.");
  }
  const baselineAssignmentId = baselineAssignmentStart.assignment.id;

  await evidence.upsertRequirementProfile(actor, organizationId, {
    positionId: opsManagerB.id,
    profileName: "Ops Validation Profile",
    requirements: [{ requirementKey: "nda", displayName: "NDA", isRequired: true }],
    idempotencyKey: idempotencyKey("validation-profile"),
  });
  const docUpload = await evidence.uploadDocument(actor, organizationId, {
    assignmentId: baselineAssignmentId,
    requirementKey: "nda",
    sourceDocumentRef: "s3://validation/nda.pdf",
    idempotencyKey: idempotencyKey("validation-doc-upload"),
  });
  if (!("document" in docUpload)) {
    throw new Error("Expected document payload from upload.");
  }
  await evidence.transitionDocumentState(actor, organizationId, docUpload.document.id, {
    toState: "signed",
    idempotencyKey: idempotencyKey("validation-doc-sign"),
  });
  await compensation.record(actor, organizationId, {
    assignmentId: baselineAssignmentId,
    sourceDocumentId: docUpload.document.id,
    amount: 130_000_00,
    currency: "USD",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    idempotencyKey: idempotencyKey("validation-comp"),
  });

  const replayBeforeCorruption = await replay.compareReplayWithLive(organizationId);

  // Scenario A — Concurrent mutation race (OCC stress)
  {
    const details: string[] = [];
    const errors: string[] = [];

    const [versionRow] = await db
      .select({ version: aggregateVersionsTable.version })
      .from(aggregateVersionsTable)
      .where(
        and(
          eq(aggregateVersionsTable.orgId, organizationId),
          eq(aggregateVersionsTable.aggregateType, "assignment"),
          eq(aggregateVersionsTable.aggregateId, baselineAssignmentId),
        ),
      )
      .limit(1);
    const expectedVersion = versionRow?.version ?? 0;
    const effectiveAt = "2026-06-05T07:18:00.000Z";

    let firstSuccess = false;
    let secondConflict409 = false;
    let secondErrorMessage = "";

    try {
      const first = await assignments.transfer(actor, organizationId, {
        personId: sarah.id,
        fromAssignmentId: baselineAssignmentId,
        toPositionId: opsManagerB.id,
        expectedFromAssignmentVersion: expectedVersion,
        effectiveAt,
        idempotencyKey: idempotencyKey("validation-race-transfer-a"),
      });
      firstSuccess = "assignment" in first;
    } catch (error) {
      secondErrorMessage = error instanceof Error ? error.message : String(error);
    }

    try {
      await assignments.transfer(actor, organizationId, {
        personId: sarah.id,
        fromAssignmentId: baselineAssignmentId,
        toPositionId: opsManagerB.id,
        expectedFromAssignmentVersion: expectedVersion,
        effectiveAt,
        idempotencyKey: idempotencyKey("validation-race-transfer-b"),
      });
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 409) {
        secondConflict409 = true;
      } else {
        secondErrorMessage = error instanceof Error ? error.message : String(error);
      }
    }

    const activeAssignments = await db
      .select()
      .from(personPositionAssignmentsTable)
      .where(
        and(
          eq(personPositionAssignmentsTable.organizationId, organizationId),
          eq(personPositionAssignmentsTable.status, "active"),
        ),
      );
    const activeForSarah = activeAssignments.filter((row) => row.personId === sarah.id);
    const activeForTargetSeat = activeAssignments.filter((row) => row.positionId === opsManagerB.id);

    if (!firstSuccess) errors.push("First OCC transfer did not succeed.");
    if (!secondConflict409) errors.push("Second OCC transfer did not return 409 version_conflict.");
    if (activeForSarah.length !== 1) {
      errors.push(`Expected 1 active assignment for Sarah, found ${activeForSarah.length}.`);
    }
    if (activeForTargetSeat.length !== 1) {
      errors.push(`Expected 1 active assignment on target seat, found ${activeForTargetSeat.length}.`);
    }

    details.push(`Baseline expected_version=${expectedVersion}, effectiveAt=${effectiveAt}`);
    details.push(`Active assignments for person=${activeForSarah.length}, target seat=${activeForTargetSeat.length}`);
    if (secondErrorMessage) details.push(`Secondary error detail: ${secondErrorMessage}`);

    const pass = errors.length === 0;
    if (!pass) criticalFindings.push(...errors);
    scenarioStatuses.push({
      id: "A",
      name: "Concurrent Mutation Race (OCC Stress)",
      pass,
      details,
      errors,
    });

    await writeJsonArtifact("concurrency-race-report.json", {
      generatedAt: new Date().toISOString(),
      organizationId,
      expectedVersion,
      effectiveAt,
      firstSuccess,
      secondConflict409,
      activeForSarah: activeForSarah.length,
      activeForTargetSeat: activeForTargetSeat.length,
      errors,
    });
  }

  // Scenario B — Outbox delay + replay interleaving
  const outboxScenario = {
    pendingBefore: 0,
    replayDuringLagMatches: false,
    replayAfterDeliveryMatches: false,
    dedupedOnForcedRedelivery: false,
    duplicateSideEffectEvents: [] as string[],
    processRuns: [] as Array<Record<string, unknown>>,
  };
  {
    const details: string[] = [];
    const errors: string[] = [];

    const john = await people.create(actor, organizationId, {
      fullName: "John Lag",
      email: "john.lag@teamframe.audit",
      employmentStatus: "active",
    });
    await assignments.start(actor, organizationId, {
      personId: john.id,
      positionId: ceo.id,
      idempotencyKey: idempotencyKey("validation-lag-assignment"),
    });

    const pendingBeforeRows = await db
      .select({ id: outboxEventsTable.id })
      .from(outboxEventsTable)
      .where(and(eq(outboxEventsTable.orgId, organizationId), eq(outboxEventsTable.processed, false)));
    outboxScenario.pendingBefore = pendingBeforeRows.length;

    const replayDuringLag = await replay.compareReplayWithLive(organizationId);
    outboxScenario.replayDuringLagMatches = replayDuringLag.matches;

    const sideEffects = new Map<string, number>();
    const handler = async (event: {
      outboxEventId: string;
      orgId: string;
      eventId: string;
      type: string;
      payload: Record<string, unknown>;
    }) => {
      sideEffects.set(event.eventId, (sideEffects.get(event.eventId) ?? 0) + 1);
    };

    const t0 = Date.now();
    for (let i = 0; i < 3; i += 1) {
      const run = await outbox.processDueEvents({
        consumerKey: "validation-b-consumer",
        now: new Date(t0 + i * 4000),
        handler,
      });
      outboxScenario.processRuns.push({ iteration: i + 1, ...run });
    }

    const [processedCandidate] = await db
      .select()
      .from(outboxEventsTable)
      .where(
        and(
          eq(outboxEventsTable.orgId, organizationId),
          eq(outboxEventsTable.processed, true),
        ),
      )
      .limit(1);
    if (processedCandidate) {
      await db
        .update(outboxEventsTable)
        .set({
          processed: false,
          processedAt: null,
          nextAttemptAt: new Date(t0 + 15000),
        })
        .where(eq(outboxEventsTable.id, processedCandidate.id));
      const dedupeRun = await outbox.processDueEvents({
        consumerKey: "validation-b-consumer",
        now: new Date(t0 + 20000),
        handler,
      });
      outboxScenario.processRuns.push({ iteration: "forced-redelivery", ...dedupeRun });
      outboxScenario.dedupedOnForcedRedelivery = dedupeRun.deduped >= 1;
    }

    const duplicates = [...sideEffects.entries()].filter(([, count]) => count > 1).map(([eventId]) => eventId);
    outboxScenario.duplicateSideEffectEvents = duplicates;

    const replayAfterDelivery = await replay.compareReplayWithLive(organizationId);
    outboxScenario.replayAfterDeliveryMatches = replayAfterDelivery.matches;

    if (outboxScenario.pendingBefore <= 0) {
      errors.push("Expected pending outbox queue before worker processing.");
    }
    if (!outboxScenario.replayDuringLagMatches) {
      errors.push("Replay comparison failed while outbox was delayed.");
    }
    if (!outboxScenario.replayAfterDeliveryMatches) {
      errors.push("Replay comparison failed after outbox delivery resumed.");
    }
    if (!outboxScenario.dedupedOnForcedRedelivery) {
      errors.push("Forced redelivery did not trigger idempotent dedupe path.");
    }
    if (duplicates.length > 0) {
      errors.push(`Duplicate side effects observed for events: ${duplicates.join(", ")}`);
    }

    details.push(`Pending outbox events before processing: ${outboxScenario.pendingBefore}`);
    details.push(`Process runs: ${JSON.stringify(outboxScenario.processRuns)}`);
    details.push(`Duplicate side effect events: ${duplicates.length}`);

    const pass = errors.length === 0;
    if (!pass) criticalFindings.push(...errors);
    scenarioStatuses.push({
      id: "B",
      name: "Outbox Delay + Replay Interleaving",
      pass,
      details,
      errors,
    });

    await writeJsonArtifact("outbox-idempotency-report.json", {
      generatedAt: new Date().toISOString(),
      organizationId,
      ...outboxScenario,
      errors,
    });
  }

  // Scenario C + D — Corrupted event injection, quarantine, recovery determinism
  const quarantineScenario = {
    corruptAggregateId: `corrupt-${randomUUID()}`,
    quarantined: false,
    writeBlocked: false,
    recovered: false,
    postRecoveryReplayMatches: false,
    preRecoveryHash: replayBeforeCorruption.comparison.assignmentProjectionHash.replayed,
    postRecoveryHash: "",
    corruptAggregateEventCount: 0,
  };
  {
    const details: string[] = [];
    const errors: string[] = [];

    await db.insert(orgEventsTable).values({
      orgId: organizationId,
      aggregateType: "assignment",
      aggregateId: quarantineScenario.corruptAggregateId,
      eventType: "assignment.started",
      version: 1,
      occurredAt: new Date(),
      actorUserId: actor.userId,
      idempotencyKey: idempotencyKey("validation-corrupt-event"),
      schemaVersion: 1,
      payload: { assignmentId: quarantineScenario.corruptAggregateId },
      payloadHash: null,
    });

    const detection = await quarantine.detectAndQuarantine(organizationId, actor.userId);
    quarantineScenario.quarantined = detection.quarantined.some(
      (entry) =>
        entry.aggregateType === "assignment" &&
        entry.aggregateId === quarantineScenario.corruptAggregateId,
    );

    try {
      await db.transaction(async (tx) => {
        await appendDomainEvent(tx, {
          organizationId,
          actorUserId: actor.userId,
          aggregateType: "assignment",
          aggregateId: quarantineScenario.corruptAggregateId,
          eventType: "assignment.ended",
          idempotencyKey: idempotencyKey("validation-quarantine-block"),
          payload: {
            assignmentId: quarantineScenario.corruptAggregateId,
            effectiveTo: new Date().toISOString(),
          },
        });
      });
    } catch {
      quarantineScenario.writeBlocked = true;
    }

    const recovery = await quarantine.recoverStream({
      organizationId,
      actorUserId: actor.userId,
      aggregateType: "assignment",
      aggregateId: quarantineScenario.corruptAggregateId,
      repairMode: "schema_adapter",
      notes: "phase4-determinism-validation",
    });
    quarantineScenario.recovered = recovery.recovered;

    const postRecoveryReplay = await replay.compareReplayWithLive(organizationId);
    quarantineScenario.postRecoveryReplayMatches = postRecoveryReplay.matches;
    quarantineScenario.postRecoveryHash = postRecoveryReplay.comparison.assignmentProjectionHash.replayed;

    const corruptEvents = await db
      .select({ id: orgEventsTable.id })
      .from(orgEventsTable)
      .where(
        and(
          eq(orgEventsTable.orgId, organizationId),
          eq(orgEventsTable.aggregateType, "assignment"),
          eq(orgEventsTable.aggregateId, quarantineScenario.corruptAggregateId),
        ),
      );
    quarantineScenario.corruptAggregateEventCount = corruptEvents.length;

    if (!quarantineScenario.quarantined) {
      errors.push("Corrupted stream was not quarantined.");
    }
    if (!quarantineScenario.writeBlocked) {
      errors.push("Writes were not blocked on quarantined stream.");
    }
    if (!quarantineScenario.recovered) {
      errors.push("Explicit recovery workflow did not complete.");
    }
    if (!quarantineScenario.postRecoveryReplayMatches) {
      errors.push("Replay/live comparison diverged after recovery.");
    }
    if (quarantineScenario.corruptAggregateEventCount !== 1) {
      errors.push(
        `Recovery introduced duplicate/missing events on corrupted aggregate (count=${quarantineScenario.corruptAggregateEventCount}).`,
      );
    }
    if (quarantineScenario.preRecoveryHash !== quarantineScenario.postRecoveryHash) {
      errors.push("Recovered assignment replay hash diverged from pre-corruption expected hash.");
    }

    details.push(`Quarantined=${quarantineScenario.quarantined}, writeBlocked=${quarantineScenario.writeBlocked}`);
    details.push(`Recovered=${quarantineScenario.recovered}, replayMatches=${quarantineScenario.postRecoveryReplayMatches}`);
    details.push(`Corrupt aggregate events retained=${quarantineScenario.corruptAggregateEventCount}`);

    const pass = errors.length === 0;
    if (!pass) criticalFindings.push(...errors);
    scenarioStatuses.push({
      id: "C+D",
      name: "Corrupted Event Injection + Quarantine Recovery Determinism",
      pass,
      details,
      errors,
    });

    await writeJsonArtifact("quarantine-events.json", {
      generatedAt: new Date().toISOString(),
      organizationId,
      ...quarantineScenario,
      errors,
    });
  }

  // Scenario E — Projection drift + auto-repair safety
  const projectionScenario = {
    driftDetected: false,
    firstRepairApplied: false,
    repairLoopDetected: false,
    healthyAfterRepair: false,
  };
  {
    const details: string[] = [];
    const errors: string[] = [];

    const [tamperRow] = await db
      .select()
      .from(evidenceStatusByAssignmentTable)
      .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId))
      .limit(1);
    if (!tamperRow) {
      errors.push("Unable to locate evidence projection row for drift injection.");
    } else {
      await db
        .update(evidenceStatusByAssignmentTable)
        .set({
          missingCount: tamperRow.missingCount + 11,
          computedAt: new Date(),
        })
        .where(eq(evidenceStatusByAssignmentTable.assignmentId, tamperRow.assignmentId));

      const detect = await projectionIntegrity.checkAndRepair({ organizationId, autoRepair: false });
      projectionScenario.driftDetected = detect.drifted.length > 0;

      const repair1 = await projectionIntegrity.checkAndRepair({ organizationId, autoRepair: true });
      projectionScenario.firstRepairApplied = repair1.drifted.some((drift) => drift.autoRepaired);

      const repair2 = await projectionIntegrity.checkAndRepair({ organizationId, autoRepair: true });
      projectionScenario.repairLoopDetected = repair2.drifted.some((drift) => drift.autoRepaired);

      const finalComparison = await replay.compareReplayWithLive(organizationId);
      projectionScenario.healthyAfterRepair = finalComparison.matches;
    }

    if (!projectionScenario.driftDetected) {
      errors.push("Projection drift was not detected.");
    }
    if (!projectionScenario.firstRepairApplied) {
      errors.push("Controlled projection repair was not applied.");
    }
    if (projectionScenario.repairLoopDetected) {
      errors.push("Projection repair loop detected (repair executed more than once).");
    }
    if (!projectionScenario.healthyAfterRepair) {
      errors.push("Final replay/live state remained divergent after projection repair.");
    }

    details.push(
      `driftDetected=${projectionScenario.driftDetected}, firstRepairApplied=${projectionScenario.firstRepairApplied}, repairLoopDetected=${projectionScenario.repairLoopDetected}`,
    );
    details.push(`healthyAfterRepair=${projectionScenario.healthyAfterRepair}`);

    const pass = errors.length === 0;
    if (!pass) criticalFindings.push(...errors);
    scenarioStatuses.push({
      id: "E",
      name: "Projection Drift + Auto-Repair Safety",
      pass,
      details,
      errors,
    });

    await writeJsonArtifact("projection-drift-report.json", {
      generatedAt: new Date().toISOString(),
      organizationId,
      ...projectionScenario,
      errors,
    });
  }

  // Scenario F — Full system determinism + hard failure conditions
  const determinismReport = {
    componentChecks: {
      assignmentsCurrent: false,
      positionsCurrent: false,
      evidenceStatusByAssignment: false,
      compensationCurrent: false,
    },
    hashes: {
      assignmentsCurrent: { projections: "", replay: "" },
      positionsCurrent: { projections: "", replay: "" },
      evidenceStatusByAssignment: { projections: "", replay: "" },
      compensationCurrent: { projections: "", replay: "" },
    },
    failureConditions: {
      dualActiveAssignment: false,
      replayDivergesFromLive: false,
      quarantineNotBlockingWrites: false,
      outboxDuplicateSideEffects: false,
      projectionRepairLoop: false,
      occConflictNot409: false,
      directMutationBypassOrgEvents: false,
    },
  };
  {
    const details: string[] = [];
    const errors: string[] = [];

    const replayOrg = await replay.replayOrganization(organizationId);
    const replayCompare = await replay.compareReplayWithLive(organizationId);

    const projectionAssignments = normalizeRows(
      (
        await db
          .select()
          .from(personPositionAssignmentsTable)
          .where(
            and(
              eq(personPositionAssignmentsTable.organizationId, organizationId),
              eq(personPositionAssignmentsTable.status, "active"),
            ),
          )
      ).map((row) => ({
        assignmentId: row.id,
        personId: row.personId,
        positionId: row.positionId,
        startedAt: row.startedAt.toISOString(),
      })),
    );
    const replayAssignments = normalizeRows(
      (replayOrg.replayed.assignmentTimelines as Array<Record<string, unknown>>)
        .filter((row) => row.status === "active")
        .map((row) => ({
          assignmentId: String(row.assignmentId),
          personId: String(row.employeeId),
          positionId: String(row.positionId),
          startedAt: String(row.effectiveFrom),
        })),
    );

    const projectionPositions = normalizeRows(
      (
        await db
          .select()
          .from(positionsTable)
          .where(eq(positionsTable.organizationId, organizationId))
      ).map((row) => ({
        positionId: row.id,
        title: row.title,
        teamId: row.teamId,
        reportsToPositionId: row.reportsToPositionId,
        lifecycleStatus: row.lifecycleStatus,
      })),
    );

    const replayPositionEvents = await db
      .select()
      .from(orgEventsTable)
      .where(
        and(
          eq(orgEventsTable.orgId, organizationId),
          eq(orgEventsTable.aggregateType, "position"),
        ),
      );
    const replayPositions = normalizeRows(
      replayPositionEvents
        .filter((row) => row.eventType.startsWith("position."))
        .map((row) => ({
          positionId: String((row.payload as Record<string, unknown>).positionId ?? row.aggregateId),
          title: String((row.payload as Record<string, unknown>).title ?? ""),
          teamId: (row.payload as Record<string, unknown>).teamId ?? null,
          reportsToPositionId: (row.payload as Record<string, unknown>).reportsToPositionId ?? null,
          lifecycleStatus: String((row.payload as Record<string, unknown>).lifecycleStatus ?? ""),
        })),
    );

    const projectionEvidence = normalizeRows(
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
      (replayOrg.replayed.evidenceByAssignment as Array<Record<string, unknown>>).map((row) => ({
        assignmentId: String(row.assignmentId),
        positionId: String(row.positionId),
        status: String(row.status),
        missingCount: Number(row.missingCount),
        pendingCount: Number(row.pendingCount),
        nonCompliantCount: Number(row.nonCompliantCount),
      })),
    );

    const projectionCompCurrent = normalizeRows(
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
    const replayCompCurrent = normalizeRows(
      (replayOrg.replayed.compensationCurrent as Array<Record<string, unknown>>).map((row) => ({
        assignmentId: String(row.assignmentId),
        compensationRecordId: String(row.compensationRecordId),
        sourceDocumentId: String(row.sourceDocumentId),
        amount: Number(row.amount),
        currency: String(row.currency),
        effectiveFrom: String(row.effectiveFrom),
      })),
    );

    determinismReport.hashes.assignmentsCurrent = {
      projections: stableHash(projectionAssignments),
      replay: stableHash(replayAssignments),
    };
    determinismReport.hashes.positionsCurrent = {
      projections: stableHash(projectionPositions),
      replay: stableHash(replayPositions),
    };
    determinismReport.hashes.evidenceStatusByAssignment = {
      projections: stableHash(projectionEvidence),
      replay: stableHash(replayEvidence),
    };
    determinismReport.hashes.compensationCurrent = {
      projections: stableHash(projectionCompCurrent),
      replay: stableHash(replayCompCurrent),
    };

    determinismReport.componentChecks.assignmentsCurrent =
      determinismReport.hashes.assignmentsCurrent.projections === determinismReport.hashes.assignmentsCurrent.replay;
    determinismReport.componentChecks.positionsCurrent =
      determinismReport.hashes.positionsCurrent.projections === determinismReport.hashes.positionsCurrent.replay;
    determinismReport.componentChecks.evidenceStatusByAssignment =
      determinismReport.hashes.evidenceStatusByAssignment.projections ===
      determinismReport.hashes.evidenceStatusByAssignment.replay;
    determinismReport.componentChecks.compensationCurrent =
      determinismReport.hashes.compensationCurrent.projections ===
      determinismReport.hashes.compensationCurrent.replay;

    // Hard failure conditions
    const activeAssignments = await db
      .select()
      .from(personPositionAssignmentsTable)
      .where(
        and(
          eq(personPositionAssignmentsTable.organizationId, organizationId),
          eq(personPositionAssignmentsTable.status, "active"),
        ),
      );
    const personCounts = new Map<string, number>();
    const positionCounts = new Map<string, number>();
    for (const assignment of activeAssignments) {
      personCounts.set(assignment.personId, (personCounts.get(assignment.personId) ?? 0) + 1);
      positionCounts.set(assignment.positionId, (positionCounts.get(assignment.positionId) ?? 0) + 1);
    }
    determinismReport.failureConditions.dualActiveAssignment =
      [...personCounts.values()].some((count) => count > 1) ||
      [...positionCounts.values()].some((count) => count > 1);
    determinismReport.failureConditions.replayDivergesFromLive = !replayCompare.matches;
    determinismReport.failureConditions.quarantineNotBlockingWrites = !quarantineScenario.writeBlocked;
    determinismReport.failureConditions.outboxDuplicateSideEffects =
      outboxScenario.duplicateSideEffectEvents.length > 0;
    determinismReport.failureConditions.projectionRepairLoop = projectionScenario.repairLoopDetected;
    determinismReport.failureConditions.occConflictNot409 = !scenarioStatuses.find((s) => s.id === "A")?.pass;
    determinismReport.failureConditions.directMutationBypassOrgEvents =
      !determinismReport.componentChecks.positionsCurrent;

    if (!determinismReport.componentChecks.assignmentsCurrent) {
      errors.push("assignments_current replay hash mismatch.");
    }
    if (!determinismReport.componentChecks.positionsCurrent) {
      errors.push(
        "positions_current replay hash mismatch (direct mutation path bypasses org_events detected).",
      );
    }
    if (!determinismReport.componentChecks.evidenceStatusByAssignment) {
      errors.push("evidence_status_by_assignment replay hash mismatch.");
    }
    if (!determinismReport.componentChecks.compensationCurrent) {
      errors.push("compensation_current replay hash mismatch.");
    }

    for (const [condition, value] of Object.entries(determinismReport.failureConditions)) {
      if (value) {
        errors.push(`Failure condition triggered: ${condition}`);
      }
    }

    details.push(`Component checks: ${JSON.stringify(determinismReport.componentChecks)}`);
    details.push(`Failure conditions: ${JSON.stringify(determinismReport.failureConditions)}`);

    const pass = errors.length === 0;
    if (!pass) criticalFindings.push(...errors);
    scenarioStatuses.push({
      id: "F",
      name: "Full System Determinism Check",
      pass,
      details,
      errors,
    });

    await writeJsonArtifact("global-determinism-check.json", {
      generatedAt: new Date().toISOString(),
      organizationId,
      ...determinismReport,
      errors,
    });
  }

  const determinismCheckPass = scenarioStatuses.find((scenario) => scenario.id === "F")?.pass ?? false;
  const replayConsistencyPass =
    scenarioStatuses.find((scenario) => scenario.id === "B")?.pass === true &&
    scenarioStatuses.find((scenario) => scenario.id === "F")?.pass === true &&
    !determinismReport.failureConditions.replayDivergesFromLive;
  const quarantineSafetyPass =
    scenarioStatuses.find((scenario) => scenario.id === "C+D")?.pass === true &&
    !determinismReport.failureConditions.quarantineNotBlockingWrites;
  const outboxSafetyPass =
    scenarioStatuses.find((scenario) => scenario.id === "B")?.pass === true &&
    !determinismReport.failureConditions.outboxDuplicateSideEffects;

  const allScenarioPass = scenarioStatuses.every((scenario) => scenario.pass);
  const verdict: "PASS" | "FAIL" =
    allScenarioPass &&
    determinismCheckPass &&
    replayConsistencyPass &&
    quarantineSafetyPass &&
    outboxSafetyPass
      ? "PASS"
      : "FAIL";

  const confidence: "HIGH" | "MEDIUM" | "LOW" =
    verdict === "PASS"
      ? "HIGH"
      : criticalFindings.some((finding) => finding.includes("direct mutation"))
        ? "HIGH"
        : "MEDIUM";

  const replayComparisonPath = await writeJsonArtifact("replay-vs-live-comparison.json", {
    generatedAt: new Date().toISOString(),
    organizationId,
    beforeCorruption: replayBeforeCorruption,
    finalComparison: await replay.compareReplayWithLive(organizationId),
  });

  const summaryPath = await writeSummaryMarkdown({
    verdict,
    confidence,
    scenarios: scenarioStatuses,
    criticalFindings,
    checks: {
      determinism: determinismCheckPass,
      replayConsistency: replayConsistencyPass,
      quarantineSafety: quarantineSafetyPass,
      outboxSafety: outboxSafetyPass,
    },
  });

  console.log(`Phase 4 Determinism Validation: ${verdict}`);
  console.log(`Artifacts: ${replayComparisonPath}, ${summaryPath}`);

  return {
    verdict,
    confidence,
    criticalFindings,
    checks: {
      determinism: determinismCheckPass,
      replayConsistency: replayConsistencyPass,
      quarantineSafety: quarantineSafetyPass,
      outboxSafety: outboxSafetyPass,
    },
  };
}

void runValidation()
  .then((result) => {
    if (result.verdict === "FAIL") {
      process.exitCode = 1;
    }
  })
  .catch((error) => {
    console.error("Phase 4 Determinism Validation: FAIL");
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
