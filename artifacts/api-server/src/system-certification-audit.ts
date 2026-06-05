import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  db,
  evidenceStatusByAssignmentTable,
  evidenceStatusByPositionTable,
  orgEventsTable,
  organizationsTable,
  outboxEventsTable,
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
  stableHash,
  type EventEnvelope,
} from "./domain";
import { HttpError } from "./lib/http-error";
import type { ActorContext } from "./lib/request-context";
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
import { buildTeamService } from "./services/team-service";

const OUTPUT_DIR = path.resolve(process.cwd(), "../system-certification-audit");

type GateResult = {
  id: string;
  name: string;
  pass: boolean;
  errors: string[];
  details: string[];
};

type ProjectionState = {
  positionsCurrent: Array<Record<string, unknown>>;
  assignmentsCurrent: Array<Record<string, unknown>>;
  evidenceStatusByAssignment: Array<Record<string, unknown>>;
  evidenceStatusByPosition: Array<Record<string, unknown>>;
  compensationCurrent: Array<Record<string, unknown>>;
};

function makeActor(label: string): ActorContext {
  return {
    userId: randomUUID(),
    email: `${label}-${Date.now()}@teamframe.audit`,
    fullName: `Auditor ${label}`,
  };
}

function key(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

function normalizeRows(rows: Array<Record<string, unknown>>) {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function toEnvelope(row: typeof orgEventsTable.$inferSelect): EventEnvelope {
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
    payloadHash: row.payloadHash ?? stableHash(row.payload),
  };
}

async function writeArtifact(name: string, payload: Record<string, unknown>) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const filePath = path.join(OUTPUT_DIR, name);
  await writeFile(filePath, JSON.stringify(payload, null, 2));
}

async function writeSummary(gates: GateResult[], overallPass: boolean) {
  const lines = [
    "# TeamFrame System Certification Audit",
    "",
    `Result: **${overallPass ? "PASS" : "FAIL"}**`,
    "",
    "## Section Results",
    ...gates.map((gate) => `- ${gate.id} ${gate.name}: ${gate.pass ? "PASS" : "FAIL"}`),
    "",
    "## Findings",
    ...gates.flatMap((gate) =>
      gate.errors.length > 0 ? gate.errors.map((error) => `- [${gate.id}] ${error}`) : [],
    ),
    "",
  ];
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, "system-certification-summary.md"), lines.join("\n"));
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

async function loadLiveProjectionState(orgId: string): Promise<ProjectionState> {
  const [positions, assignments, evidenceByAssignment, evidenceByPosition, compensationCurrent] =
    await Promise.all([
      db.select().from(positionsTable).where(eq(positionsTable.organizationId, orgId)),
      db
        .select()
        .from(personPositionAssignmentsTable)
        .where(eq(personPositionAssignmentsTable.organizationId, orgId)),
      db
        .select()
        .from(evidenceStatusByAssignmentTable)
        .where(eq(evidenceStatusByAssignmentTable.organizationId, orgId)),
      db
        .select()
        .from(evidenceStatusByPositionTable)
        .where(eq(evidenceStatusByPositionTable.organizationId, orgId)),
      db
        .select()
        .from(compensationCurrentTable)
        .where(eq(compensationCurrentTable.organizationId, orgId)),
    ]);

  return {
    positionsCurrent: normalizeRows(
      positions.map((row) => ({
        positionId: row.id,
        title: row.title,
        teamId: row.teamId,
        reportsToPositionId: row.reportsToPositionId,
        lifecycleStatus: row.lifecycleStatus,
      })),
    ),
    assignmentsCurrent: normalizeRows(
      assignments.map((row) => ({
        assignmentId: row.id,
        personId: row.personId,
        positionId: row.positionId,
        startedAt: row.startedAt.toISOString(),
        endedAt: row.endedAt ? row.endedAt.toISOString() : null,
        status: row.status,
      })),
    ),
    evidenceStatusByAssignment: normalizeRows(
      evidenceByAssignment.map((row) => ({
        assignmentId: row.assignmentId,
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    ),
    evidenceStatusByPosition: normalizeRows(
      evidenceByPosition.map((row) => ({
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    ),
    compensationCurrent: normalizeRows(
      compensationCurrent.map((row) => ({
        assignmentId: row.assignmentId,
        compensationRecordId: row.compensationRecordId,
        sourceDocumentId: row.sourceDocumentId,
        amount: row.amount,
        currency: row.currency,
        effectiveFrom: row.effectiveFrom.toISOString(),
      })),
    ),
  };
}

async function loadReplayProjectionState(orgId: string): Promise<ProjectionState> {
  const events = (
    await db.select().from(orgEventsTable).where(eq(orgEventsTable.orgId, orgId))
  )
    .map(toEnvelope)
    .sort((a, b) => {
      const byOccurred = a.occurredAt.localeCompare(b.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      const byAggregate = a.aggregateId.localeCompare(b.aggregateId);
      if (byAggregate !== 0) return byAggregate;
      return a.version - b.version;
    });

  const positions = derivePositionsFromEvents(events);
  const assignments = deriveAssignments(events);
  const requirementRules = deriveRequirementRulesFromEvents(events);
  const documents = deriveDocumentSnapshotsFromEvents(events);
  const evidenceByAssignment = deriveEvidenceStatusByAssignment({
    requirementRules,
    documentSnapshots: documents,
    events,
  });
  const evidenceByPosition = deriveEvidenceStatusByPosition(evidenceByAssignment);
  const compensationCurrent = [
    ...deriveCompensationCurrentByAssignment(deriveCompensationRecordsFromEvents(events)).values(),
  ];

  return {
    positionsCurrent: normalizeRows(
      positions.map((row) => ({
        positionId: row.positionId,
        title: row.title,
        teamId: row.teamId,
        reportsToPositionId: row.reportsToPositionId,
        lifecycleStatus: row.lifecycleStatus,
      })),
    ),
    assignmentsCurrent: normalizeRows(
      assignments.map((row) => ({
        assignmentId: row.assignmentId,
        personId: row.employeeId,
        positionId: row.positionId,
        startedAt: row.effectiveFrom,
        endedAt: row.effectiveTo,
        status: row.status,
      })),
    ),
    evidenceStatusByAssignment: normalizeRows(
      evidenceByAssignment.map((row) => ({
        assignmentId: row.assignmentId,
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    ),
    evidenceStatusByPosition: normalizeRows(
      evidenceByPosition.map((row) => ({
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    ),
    compensationCurrent: normalizeRows(
      compensationCurrent.map((row) => ({
        assignmentId: row.assignmentId,
        compensationRecordId: row.compensationRecordId,
        sourceDocumentId: row.sourceDocumentId,
        amount: row.amount,
        currency: row.currency,
        effectiveFrom: row.effectiveFrom,
      })),
    ),
  };
}

function compareStates(live: ProjectionState, replay: ProjectionState) {
  const hashes = {
    positionsCurrent: { live: stableHash(live.positionsCurrent), replay: stableHash(replay.positionsCurrent) },
    assignmentsCurrent: {
      live: stableHash(live.assignmentsCurrent),
      replay: stableHash(replay.assignmentsCurrent),
    },
    evidenceStatusByAssignment: {
      live: stableHash(live.evidenceStatusByAssignment),
      replay: stableHash(replay.evidenceStatusByAssignment),
    },
    evidenceStatusByPosition: {
      live: stableHash(live.evidenceStatusByPosition),
      replay: stableHash(replay.evidenceStatusByPosition),
    },
    compensationCurrent: {
      live: stableHash(live.compensationCurrent),
      replay: stableHash(replay.compensationCurrent),
    },
  };
  const mismatches = Object.entries(hashes)
    .filter(([, value]) => value.live !== value.replay)
    .map(([name]) => name);
  return {
    hashes,
    mismatches,
    matches: mismatches.length === 0,
  };
}

async function createFixtureOrg(prefix: string) {
  const actor = makeActor(prefix);
  const organizations = buildOrganizationService();
  const teams = buildTeamService();
  const positions = buildPositionService();
  const people = buildPeopleService();
  const assignments = buildAssignmentService();
  const evidence = buildEvidenceService();
  const compensation = buildCompensationService();

  const organization = await organizations.create(actor, {
    name: `${prefix} ${new Date().toISOString()}`,
    slug: `${prefix.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const orgId = organization.id;

  const team = await teams.create(actor, orgId, { name: "Operations", code: "OPS" });
  const ceo = await positions.create(actor, orgId, { title: "CEO", lifecycleStatus: "vacant" });
  const manager = await positions.create(actor, orgId, {
    title: "Manager",
    teamId: team.id,
    reportsToPositionId: ceo.id,
    lifecycleStatus: "vacant",
  });
  const person = await people.create(actor, orgId, {
    fullName: `${prefix} Person`,
    email: `${prefix.toLowerCase()}-${Date.now()}@teamframe.audit`,
    employmentStatus: "active",
  });
  const started = await assignments.start(actor, orgId, {
    personId: person.id,
    positionId: manager.id,
    idempotencyKey: key(`${prefix}-assignment`),
  });
  if (!("assignment" in started)) {
    throw new Error("Fixture failed to create assignment.");
  }

  await evidence.upsertRequirementProfile(actor, orgId, {
    positionId: manager.id,
    profileName: `${prefix} Profile`,
    requirements: [{ requirementKey: "nda", displayName: "NDA", isRequired: true }],
    idempotencyKey: key(`${prefix}-profile`),
  });
  const uploaded = await evidence.uploadDocument(actor, orgId, {
    assignmentId: started.assignment.id,
    requirementKey: "nda",
    sourceDocumentRef: `s3://${prefix}/nda.pdf`,
    idempotencyKey: key(`${prefix}-doc`),
  });
  if (!("document" in uploaded)) {
    throw new Error("Fixture failed to upload evidence document.");
  }
  await evidence.transitionDocumentState(actor, orgId, uploaded.document.id, {
    toState: "signed",
    idempotencyKey: key(`${prefix}-doc-sign`),
  });
  await compensation.record(actor, orgId, {
    assignmentId: started.assignment.id,
    sourceDocumentId: uploaded.document.id,
    amount: 120_000_00,
    currency: "USD",
    effectiveFrom: "2026-01-01T00:00:00.000Z",
    idempotencyKey: key(`${prefix}-comp`),
  });

  return {
    actor,
    orgId,
    ceoId: ceo.id,
    managerId: manager.id,
    personId: person.id,
    assignmentId: started.assignment.id,
    documentId: uploaded.document.id,
  };
}

async function runSectionAEventAuthority(): Promise<GateResult & { writers: Array<Record<string, unknown>> }> {
  const files = await listTypescriptFiles("/workspace/artifacts/api-server/src");
  const projectionTables = new Set([
    "positionsTable",
    "personPositionAssignmentsTable",
    "evidenceStatusByAssignmentTable",
    "evidenceStatusByPositionTable",
    "compensationCurrentTable",
  ]);
  const mutationRegex =
    /\b(?:db|tx)\.(insert|update|delete)\(\s*([A-Za-z0-9_]+Table)\s*\)|\b(?:db|tx)\.(insert|update|delete)\(([A-Za-z0-9_]+Table)\)/;
  const writers: Array<Record<string, unknown>> = [];
  for (const filePath of files) {
    const rel = filePath.replace("/workspace/", "");
    const source = await readFile(filePath, "utf8");
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      const match = line.match(mutationRegex);
      if (!match) continue;
      const table = match[2] || match[4] || "";
      if (!projectionTables.has(table)) continue;
      if (rel === "artifacts/api-server/src/services/projection-builder-service.ts") continue;
      writers.push({
        path: rel,
        line: i + 1,
        operation: match[1] || match[3] || "mutation",
        table,
      });
    }
  }

  const errors =
    writers.length > 0 ? [`Found ${writers.length} direct projection mutations outside projector authority.`] : [];
  return {
    id: "A",
    name: "Event Authority",
    pass: writers.length === 0,
    details: [`Unauthorized write paths: ${writers.length}`],
    errors,
    writers,
  };
}

async function runSectionBReplayDeterminism() {
  const organizations = await db.select({ id: organizationsTable.id }).from(organizationsTable);
  const mismatchedOrgs: Array<Record<string, unknown>> = [];
  for (const org of organizations) {
    const live = await loadLiveProjectionState(org.id);
    const replay = await loadReplayProjectionState(org.id);
    const compare = compareStates(live, replay);
    if (!compare.matches) {
      mismatchedOrgs.push({
        orgId: org.id,
        mismatches: compare.mismatches,
        hashes: compare.hashes,
      });
    }
  }
  return {
    gate: {
      id: "B",
      name: "Replay Determinism",
      pass: mismatchedOrgs.length === 0,
      details: [`Audited organizations: ${organizations.length}`, `Mismatched organizations: ${mismatchedOrgs.length}`],
      errors:
        mismatchedOrgs.length > 0
          ? ["Replay determinism mismatch detected in one or more organizations."]
          : [],
    } satisfies GateResult,
    mismatchedOrgs,
    auditedCount: organizations.length,
  };
}

async function runSectionCQuarantineIsolation() {
  const quarantineSource = await readFile(
    "/workspace/artifacts/api-server/src/services/quarantine-service.ts",
    "utf8",
  );
  const invokesReplay = quarantineSource.includes("buildReplayService") || quarantineSource.includes(".replay");
  const invokesProjector =
    quarantineSource.includes("buildProjectionBuilderService") ||
    quarantineSource.includes("rebuildFromEvents");
  const touchesProjections =
    quarantineSource.includes("positionsTable") ||
    quarantineSource.includes("personPositionAssignmentsTable") ||
    quarantineSource.includes("evidenceStatusByAssignmentTable") ||
    quarantineSource.includes("evidenceStatusByPositionTable") ||
    quarantineSource.includes("compensationCurrentTable");

  const fixture = await createFixtureOrg("quarantine-iso");
  const quarantine = buildQuarantineService();

  const before = await loadLiveProjectionState(fixture.orgId);
  const beforeHashes = {
    positions: stableHash(before.positionsCurrent),
    assignments: stableHash(before.assignmentsCurrent),
    evidenceA: stableHash(before.evidenceStatusByAssignment),
    evidenceP: stableHash(before.evidenceStatusByPosition),
    compensation: stableHash(before.compensationCurrent),
  };

  const corruptAggregateId = `iso-corrupt-${randomUUID()}`;
  await db.insert(orgEventsTable).values({
    orgId: fixture.orgId,
    aggregateType: "assignment",
    aggregateId: corruptAggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: new Date(),
    actorUserId: fixture.actor.userId,
    idempotencyKey: key("iso-corrupt"),
    schemaVersion: 1,
    payload: { assignmentId: corruptAggregateId },
    payloadHash: null,
  });

  const detection = await quarantine.detectAndQuarantine(fixture.orgId, fixture.actor.userId);
  const after = await loadLiveProjectionState(fixture.orgId);
  const afterHashes = {
    positions: stableHash(after.positionsCurrent),
    assignments: stableHash(after.assignmentsCurrent),
    evidenceA: stableHash(after.evidenceStatusByAssignment),
    evidenceP: stableHash(after.evidenceStatusByPosition),
    compensation: stableHash(after.compensationCurrent),
  };

  const projectionUnchanged = stableHash(beforeHashes) === stableHash(afterHashes);
  const quarantined = detection.quarantined.some(
    (entry) => entry.aggregateType === "assignment" && entry.aggregateId === corruptAggregateId,
  );
  const pass = !invokesReplay && !invokesProjector && !touchesProjections && projectionUnchanged && quarantined;
  const errors: string[] = [];
  if (invokesReplay) errors.push("quarantine-service invokes replay.");
  if (invokesProjector) errors.push("quarantine-service invokes projector rebuild.");
  if (touchesProjections) errors.push("quarantine-service touches projection tables.");
  if (!projectionUnchanged) errors.push("quarantine detection mutated projection state.");
  if (!quarantined) errors.push("corrupted stream was not quarantined.");

  return {
    id: "C",
    name: "Quarantine Isolation",
    pass,
    details: [
      `invokesReplay=${invokesReplay}`,
      `invokesProjector=${invokesProjector}`,
      `touchesProjections=${touchesProjections}`,
      `projectionUnchanged=${projectionUnchanged}`,
      `quarantined=${quarantined}`,
    ],
    errors,
  } satisfies GateResult;
}

async function runSectionDRepairSafety() {
  const repairSource = await readFile(
    "/workspace/artifacts/api-server/src/services/projection-integrity-service.ts",
    "utf8",
  );
  const directProjectionPatch =
    repairSource.includes("delete(evidenceStatusByAssignmentTable)") ||
    repairSource.includes("insert(evidenceStatusByAssignmentTable)") ||
    repairSource.includes("delete(evidenceStatusByPositionTable)") ||
    repairSource.includes("insert(evidenceStatusByPositionTable)") ||
    repairSource.includes("delete(compensationCurrentTable)") ||
    repairSource.includes("insert(compensationCurrentTable)");
  const emitsRepairRequestedEvent = repairSource.includes("projection.repair.requested");

  const fixture = await createFixtureOrg("repair-safety");
  const projectionIntegrity = buildProjectionIntegrityService();
  await db
    .update(evidenceStatusByAssignmentTable)
    .set({
      missingCount: 99,
      computedAt: new Date(),
    })
    .where(
      and(
        eq(evidenceStatusByAssignmentTable.organizationId, fixture.orgId),
        eq(evidenceStatusByAssignmentTable.assignmentId, fixture.assignmentId),
      ),
    );

  let runtimeRepairError = "";
  try {
    await projectionIntegrity.checkAndRepair({
      organizationId: fixture.orgId,
      autoRepair: true,
    });
  } catch (error) {
    runtimeRepairError = error instanceof Error ? error.message : String(error);
  }

  const repairEvents = await db
    .select({ id: orgEventsTable.id })
    .from(orgEventsTable)
    .where(
      and(
        eq(orgEventsTable.orgId, fixture.orgId),
        eq(orgEventsTable.eventType, "projection.repair.requested"),
      ),
    );
  const compare = compareStates(
    await loadLiveProjectionState(fixture.orgId),
    await loadReplayProjectionState(fixture.orgId),
  );

  const pass =
    !directProjectionPatch &&
    emitsRepairRequestedEvent &&
    repairEvents.length > 0 &&
    compare.matches &&
    runtimeRepairError.length === 0;
  const errors: string[] = [];
  if (directProjectionPatch) errors.push("Repair path still directly patches projection rows.");
  if (!emitsRepairRequestedEvent) errors.push("projection.repair.requested event not emitted in code path.");
  if (repairEvents.length === 0) errors.push("No projection.repair.requested event persisted at runtime.");
  if (!compare.matches) errors.push("Repair flow did not converge replay/live state.");
  if (runtimeRepairError.length > 0) {
    errors.push(`Runtime repair execution failed: ${runtimeRepairError}`);
  }

  return {
    id: "D",
    name: "Repair Safety",
    pass,
    details: [
      `directProjectionPatch=${directProjectionPatch}`,
      `emitsRepairRequestedEvent=${emitsRepairRequestedEvent}`,
      `repairEventsPersisted=${repairEvents.length}`,
      `replayLiveConverged=${compare.matches}`,
      `runtimeRepairError=${runtimeRepairError.length > 0}`,
    ],
    errors,
  } satisfies GateResult;
}

async function runSectionEOutboxRecovery() {
  const fixture = await createFixtureOrg("outbox-recovery");
  const people = buildPeopleService();
  const assignments = buildAssignmentService();
  const outbox = buildOutboxReliabilityService();

  const pendingBefore = await db
    .select({ id: outboxEventsTable.id })
    .from(outboxEventsTable)
    .where(and(eq(outboxEventsTable.orgId, fixture.orgId), eq(outboxEventsTable.processed, false)));

  const compareBefore = compareStates(
    await loadLiveProjectionState(fixture.orgId),
    await loadReplayProjectionState(fixture.orgId),
  );

  const sideEffects = new Map<string, number>();
  const nowBase = Date.now();
  const run1 = await outbox.processDueEvents({
    consumerKey: "cert-outbox-consumer",
    now: new Date(nowBase),
    handler: async (event) => {
      sideEffects.set(event.eventId, (sideEffects.get(event.eventId) ?? 0) + 1);
    },
  });
  const run2 = await outbox.processDueEvents({
    consumerKey: "cert-outbox-consumer",
    now: new Date(nowBase + 5000),
    handler: async (event) => {
      sideEffects.set(event.eventId, (sideEffects.get(event.eventId) ?? 0) + 1);
    },
  });

  const [processedCandidate] = await db
    .select()
    .from(outboxEventsTable)
    .where(and(eq(outboxEventsTable.orgId, fixture.orgId), eq(outboxEventsTable.processed, true)))
    .limit(1);
  let dedupeTriggered = false;
  if (processedCandidate) {
    await db
      .update(outboxEventsTable)
      .set({
        processed: false,
        processedAt: null,
        nextAttemptAt: new Date(nowBase + 10000),
      })
      .where(eq(outboxEventsTable.id, processedCandidate.id));
    const dedupeRun = await outbox.processDueEvents({
      consumerKey: "cert-outbox-consumer",
      now: new Date(nowBase + 15000),
      handler: async (event) => {
        sideEffects.set(event.eventId, (sideEffects.get(event.eventId) ?? 0) + 1);
      },
    });
    dedupeTriggered = dedupeRun.deduped > 0;
  }

  const crashPerson = await people.create(fixture.actor, fixture.orgId, {
    fullName: "Outbox Crash Person",
    email: `outbox-crash-${Date.now()}@teamframe.audit`,
    employmentStatus: "active",
  });
  await assignments.start(fixture.actor, fixture.orgId, {
    personId: crashPerson.id,
    positionId: fixture.ceoId,
    idempotencyKey: key("outbox-crash-assignment"),
  });
  const [targetEvent] = await db
    .select()
    .from(outboxEventsTable)
    .where(and(eq(outboxEventsTable.orgId, fixture.orgId), eq(outboxEventsTable.processed, false)))
    .limit(1);
  let crashInjected = false;
  if (targetEvent) {
    await outbox.processDueEvents({
      consumerKey: "cert-outbox-crash-consumer",
      now: new Date(nowBase + 20000),
      handler: async (event) => {
        if (!crashInjected && event.eventId === targetEvent.eventId) {
          crashInjected = true;
          throw new Error("simulated_worker_crash");
        }
      },
    });
    await outbox.processDueEvents({
      consumerKey: "cert-outbox-crash-consumer",
      now: new Date(nowBase + 40000),
      handler: async () => {},
    });
  }

  const compareAfter = compareStates(
    await loadLiveProjectionState(fixture.orgId),
    await loadReplayProjectionState(fixture.orgId),
  );
  const duplicateSideEffects = [...sideEffects.values()].some((count) => count > 1);

  const errors: string[] = [];
  if (pendingBefore.length === 0) errors.push("Outbox delay setup had zero pending events.");
  if (!compareBefore.matches) errors.push("Replay/live mismatch before outbox processing.");
  if (duplicateSideEffects) errors.push("Duplicate side effects detected during outbox processing.");
  if (!dedupeTriggered) errors.push("Duplicate delivery dedupe path was not triggered.");
  if (!compareAfter.matches) errors.push("Replay/live mismatch after outbox recovery scenarios.");

  return {
    id: "E",
    name: "Outbox Recovery",
    pass: errors.length === 0,
    details: [
      `pendingBefore=${pendingBefore.length}`,
      `run1Delivered=${run1.delivered}`,
      `run2Delivered=${run2.delivered}`,
      `dedupeTriggered=${dedupeTriggered}`,
      `crashInjected=${crashInjected}`,
      `compareAfterMatches=${compareAfter.matches}`,
    ],
    errors,
  } satisfies GateResult;
}

async function runSectionFFailureInjection() {
  const fixture = await createFixtureOrg("failure-suite");
  const quarantine = buildQuarantineService();
  const projectionIntegrity = buildProjectionIntegrityService();
  const projector = buildProjectionBuilderService();

  const corruptAggregateId = `failure-corrupt-${randomUUID()}`;
  const gapAggregateId = `failure-gap-${randomUUID()}`;

  await db.insert(orgEventsTable).values({
    orgId: fixture.orgId,
    aggregateType: "assignment",
    aggregateId: corruptAggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: new Date(),
    actorUserId: fixture.actor.userId,
    idempotencyKey: key("failure-corrupt"),
    schemaVersion: 1,
    payload: { assignmentId: corruptAggregateId },
    payloadHash: null,
  });
  await db.insert(orgEventsTable).values({
    orgId: fixture.orgId,
    aggregateType: "assignment",
    aggregateId: gapAggregateId,
    eventType: "assignment.started",
    version: 1,
    occurredAt: new Date(),
    actorUserId: fixture.actor.userId,
    idempotencyKey: key("failure-gap-v1"),
    schemaVersion: 1,
    payload: {
      assignmentId: gapAggregateId,
      employeeId: fixture.personId,
      positionId: fixture.managerId,
      effectiveFrom: new Date().toISOString(),
    },
    payloadHash: null,
  });
  await db.insert(orgEventsTable).values({
    orgId: fixture.orgId,
    aggregateType: "assignment",
    aggregateId: gapAggregateId,
    eventType: "assignment.ended",
    version: 3,
    occurredAt: new Date(),
    actorUserId: fixture.actor.userId,
    idempotencyKey: key("failure-gap-v3"),
    schemaVersion: 1,
    payload: {
      assignmentId: gapAggregateId,
      effectiveTo: new Date().toISOString(),
    },
    payloadHash: null,
  });
  await db.insert(orgEventsTable).values({
    orgId: fixture.orgId,
    aggregateType: "assignment",
    aggregateId: gapAggregateId,
    eventType: "assignment.started",
    version: 4,
    occurredAt: new Date(),
    actorUserId: fixture.actor.userId,
    idempotencyKey: key("failure-duplicate"),
    schemaVersion: 1,
    payload: {
      assignmentId: gapAggregateId,
      employeeId: fixture.personId,
      positionId: fixture.managerId,
      effectiveFrom: "2025-01-01T00:00:00.000Z",
    },
    payloadHash: null,
  });

  await db.transaction(async (tx) => {
    await appendDomainEvent(tx, {
      organizationId: fixture.orgId,
      actorUserId: fixture.actor.userId,
      aggregateType: "assignment",
      aggregateId: fixture.assignmentId,
      eventType: "assignment.ended",
      idempotencyKey: key("failure-backdated"),
      payload: {
        assignmentId: fixture.assignmentId,
        effectiveTo: "2020-01-01T00:00:00.000Z",
      },
    });
  });

  const detection = await quarantine.detectAndQuarantine(fixture.orgId, fixture.actor.userId);
  const quarantined = detection.quarantined.some((entry) => entry.aggregateId === corruptAggregateId);
  let blocked = false;
  try {
    await db.transaction(async (tx) => {
      await appendDomainEvent(tx, {
        organizationId: fixture.orgId,
        actorUserId: fixture.actor.userId,
        aggregateType: "assignment",
        aggregateId: corruptAggregateId,
        eventType: "assignment.ended",
        idempotencyKey: key("failure-block"),
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
    organizationId: fixture.orgId,
    actorUserId: fixture.actor.userId,
    aggregateType: "assignment",
    aggregateId: corruptAggregateId,
    repairMode: "schema_adapter",
    notes: "failure-suite",
  });

  let replayInterrupted = false;
  try {
    await db.transaction(async (tx) => {
      await projector.rebuildFromEventsTx(tx, {
        organizationId: fixture.orgId,
        include: {
          assignments: true,
          evidence: true,
          compensationCurrent: true,
        },
      });
      throw new Error("simulated_replay_interruption");
    });
  } catch {
    replayInterrupted = true;
  }

  await projector.rebuildFromEvents({
    organizationId: fixture.orgId,
    include: {
      assignments: true,
      evidence: true,
      compensationCurrent: true,
    },
  });

  await db
    .update(evidenceStatusByAssignmentTable)
    .set({
      missingCount: 7,
      computedAt: new Date(),
    })
    .where(
      and(
        eq(evidenceStatusByAssignmentTable.organizationId, fixture.orgId),
        eq(evidenceStatusByAssignmentTable.assignmentId, fixture.assignmentId),
      ),
    );
  let repairFirstApplied = false;
  let repairLoopDetected = false;
  let runtimeRepairError = "";
  try {
    const repairFirst = await projectionIntegrity.checkAndRepair({
      organizationId: fixture.orgId,
      autoRepair: true,
    });
    repairFirstApplied = repairFirst.drifted.some((drift) => drift.autoRepaired);
    const repairSecond = await projectionIntegrity.checkAndRepair({
      organizationId: fixture.orgId,
      autoRepair: true,
    });
    repairLoopDetected = repairSecond.drifted.some((drift) => drift.autoRepaired);
  } catch (error) {
    runtimeRepairError = error instanceof Error ? error.message : String(error);
  }

  const compare = compareStates(
    await loadLiveProjectionState(fixture.orgId),
    await loadReplayProjectionState(fixture.orgId),
  );
  const positionBypassDetected = compare.mismatches.includes("positionsCurrent");

  const errors: string[] = [];
  if (!quarantined) errors.push("Corrupted event stream was not quarantined.");
  if (!blocked) errors.push("Quarantined aggregate did not block append attempts.");
  if (!replayInterrupted) errors.push("Replay interruption simulation did not execute.");
  if (!repairFirstApplied) {
    errors.push("Repair did not run after injected drift.");
  }
  if (repairLoopDetected) errors.push("Silent repair loop detected.");
  if (runtimeRepairError.length > 0) {
    errors.push(`Repair execution error: ${runtimeRepairError}`);
  }
  if (positionBypassDetected) errors.push("State mutation bypass detected on positions projection.");
  if (!compare.matches) errors.push("Final replay/live mismatch after failure injection suite.");

  return {
    id: "F",
    name: "Failure Injection",
    pass: errors.length === 0,
    details: [
      `quarantined=${quarantined}`,
      `blocked=${blocked}`,
      `replayInterrupted=${replayInterrupted}`,
      `repairFirstApplied=${repairFirstApplied}`,
      `repairLoopDetected=${repairLoopDetected}`,
      `runtimeRepairError=${runtimeRepairError.length > 0}`,
      `positionBypassDetected=${positionBypassDetected}`,
      `finalReplayMatches=${compare.matches}`,
    ],
    errors,
  } satisfies GateResult;
}

async function runSectionGLegacyTruthSurface() {
  const files = await listTypescriptFiles("/workspace/artifacts/api-server/src");
  const patterns = ["peopleTable.positionId", "person.positionId", "people.positionId", "employee.positionId"];
  const findings: Array<Record<string, unknown>> = [];

  for (const filePath of files) {
    const rel = filePath.replace("/workspace/", "");
    const source = await readFile(filePath, "utf8");
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      for (const pattern of patterns) {
        if (line.includes(pattern)) {
          findings.push({
            path: rel,
            line: i + 1,
            snippet: line.trim(),
          });
        }
      }
    }
  }

  const runtimeAuthorityFindings = findings.filter((finding) => {
    const pathValue = String(finding.path);
    return (
      pathValue.includes("/services/") ||
      pathValue.includes("/routes/") ||
      pathValue.includes("/persistence/")
    );
  });

  const pass = runtimeAuthorityFindings.length === 0;
  return {
    id: "G",
    name: "Legacy Truth Surface",
    pass,
    details: [
      `Total references=${findings.length}`,
      `Runtime authority references=${runtimeAuthorityFindings.length}`,
    ],
    errors:
      runtimeAuthorityFindings.length > 0
        ? ["Legacy positionId surface is still used in runtime authority path."]
        : [],
    findings,
    runtimeAuthorityFindings,
  };
}

async function runSectionHGlobalDeterminism() {
  const organizations = await db.select({ id: organizationsTable.id }).from(organizationsTable);
  const perOrg: Array<Record<string, unknown>> = [];
  let allMatch = true;

  for (const org of organizations) {
    const live = await loadLiveProjectionState(org.id);
    const replay = await loadReplayProjectionState(org.id);
    const compare = compareStates(live, replay);
    perOrg.push({
      orgId: org.id,
      matches: compare.matches,
      mismatches: compare.mismatches,
      hashes: compare.hashes,
    });
    if (!compare.matches) allMatch = false;
  }

  return {
    id: "H",
    name: "Global Determinism",
    pass: allMatch,
    details: [
      `Audited organizations=${organizations.length}`,
      `Organizations with mismatches=${perOrg.filter((org) => !org.matches).length}`,
    ],
    errors: allMatch ? [] : ["One or more organizations failed global hash determinism."],
    perOrg,
  };
}

async function runAudit() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for system certification audit.");
  }

  const makeSectionFailure = (id: string, name: string, error: unknown): GateResult => ({
    id,
    name,
    pass: false,
    details: [],
    errors: [
      error instanceof Error ? error.message : String(error),
    ],
  });

  let sectionA = makeSectionFailure("A", "Event Authority", "not executed");
  let sectionB = {
    gate: makeSectionFailure("B", "Replay Determinism", "not executed"),
    mismatchedOrgs: [] as Array<Record<string, unknown>>,
    auditedCount: 0,
  };
  let sectionC = makeSectionFailure("C", "Quarantine Isolation", "not executed");
  let sectionD = makeSectionFailure("D", "Repair Safety", "not executed");
  let sectionE = makeSectionFailure("E", "Outbox Recovery", "not executed");
  let sectionF = makeSectionFailure("F", "Failure Injection", "not executed");
  let sectionG = {
    ...makeSectionFailure("G", "Legacy Truth Surface", "not executed"),
    findings: [] as Array<Record<string, unknown>>,
    runtimeAuthorityFindings: [] as Array<Record<string, unknown>>,
  };
  let sectionH = {
    ...makeSectionFailure("H", "Global Determinism", "not executed"),
    perOrg: [] as Array<Record<string, unknown>>,
  };

  try {
    sectionA = await runSectionAEventAuthority();
  } catch (error) {
    sectionA = {
      ...makeSectionFailure("A", "Event Authority", error),
      writers: [],
    } as typeof sectionA;
  }
  await writeArtifact("section-a-event-authority.json", sectionA as unknown as Record<string, unknown>);

  try {
    sectionB = await runSectionBReplayDeterminism();
  } catch (error) {
    sectionB = {
      gate: makeSectionFailure("B", "Replay Determinism", error),
      mismatchedOrgs: [],
      auditedCount: 0,
    };
  }
  await writeArtifact("section-b-replay-determinism.json", sectionB as unknown as Record<string, unknown>);

  try {
    sectionC = await runSectionCQuarantineIsolation();
  } catch (error) {
    sectionC = makeSectionFailure("C", "Quarantine Isolation", error);
  }
  await writeArtifact("section-c-quarantine-isolation.json", sectionC as unknown as Record<string, unknown>);

  try {
    sectionD = await runSectionDRepairSafety();
  } catch (error) {
    sectionD = makeSectionFailure("D", "Repair Safety", error);
  }
  await writeArtifact("section-d-repair-safety.json", sectionD as unknown as Record<string, unknown>);

  try {
    sectionE = await runSectionEOutboxRecovery();
  } catch (error) {
    sectionE = makeSectionFailure("E", "Outbox Recovery", error);
  }
  await writeArtifact("section-e-outbox-recovery.json", sectionE as unknown as Record<string, unknown>);

  try {
    sectionF = await runSectionFFailureInjection();
  } catch (error) {
    sectionF = makeSectionFailure("F", "Failure Injection", error);
  }
  await writeArtifact("section-f-failure-injection.json", sectionF as unknown as Record<string, unknown>);

  try {
    sectionG = await runSectionGLegacyTruthSurface();
  } catch (error) {
    sectionG = {
      ...makeSectionFailure("G", "Legacy Truth Surface", error),
      findings: [],
      runtimeAuthorityFindings: [],
    };
  }
  await writeArtifact("section-g-legacy-truth-surface.json", sectionG as unknown as Record<string, unknown>);

  try {
    sectionH = await runSectionHGlobalDeterminism();
  } catch (error) {
    sectionH = {
      ...makeSectionFailure("H", "Global Determinism", error),
      perOrg: [],
    };
  }
  await writeArtifact("section-h-global-determinism.json", sectionH as unknown as Record<string, unknown>);

  const gates: GateResult[] = [
    sectionA,
    sectionB.gate,
    sectionC,
    sectionD,
    sectionE,
    sectionF,
    sectionG,
    sectionH,
  ];
  const overallPass = gates.every((gate) => gate.pass);
  await writeSummary(gates, overallPass);

  const finalArtifact = {
    generatedAt: new Date().toISOString(),
    overallPass,
    confidence: "HIGH",
    sections: {
      A: sectionA.pass,
      B: sectionB.gate.pass,
      C: sectionC.pass,
      D: sectionD.pass,
      E: sectionE.pass,
      F: sectionF.pass,
      G: sectionG.pass,
      H: sectionH.pass,
    },
  };
  await writeArtifact("system-certification-result.json", finalArtifact);

  console.log(`System certification audit result: ${overallPass ? "PASS" : "FAIL"}`);
  if (!overallPass) {
    process.exitCode = 1;
  }
}

void runAudit().catch((error) => {
  console.error("System certification audit failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
