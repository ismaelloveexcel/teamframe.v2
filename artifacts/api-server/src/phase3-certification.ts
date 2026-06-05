import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  compensationRecordsTable,
  db,
  documentsTable,
  evidenceStatusByAssignmentTable,
  evidenceStatusByPositionTable,
  offboardingCompletionsTable,
  orgEventsTable,
  personPositionAssignmentsTable,
} from "@workspace/db";
import {
  deriveCompensationCurrentByAssignment,
  deriveCompensationRecordsFromEvents,
  deriveDocumentSnapshotsFromEvents,
  deriveEvidenceStatusByAssignment,
  deriveEvidenceStatusByPosition,
  deriveRequirementRulesFromEvents,
  type EventEnvelope,
} from "./domain";
import type { ActorContext } from "./lib/request-context";
import { buildAssignmentService } from "./services/assignment-service";
import { buildCompensationService } from "./services/compensation-service";
import { buildEvidenceService } from "./services/evidence-service";
import { buildOffboardingService } from "./services/offboarding-service";
import { buildOrganizationService } from "./services/organization-service";
import { buildPeopleService } from "./services/people-service";
import { buildPositionService } from "./services/position-service";
import { buildTeamService } from "./services/team-service";

type GateResult = {
  gate: string;
  passed: boolean;
  details: string[];
};

function makeActor(): ActorContext {
  return {
    userId: randomUUID(),
    email: `phase3-${Date.now()}@teamframe.cert`,
    fullName: "Phase 3 Certification",
  };
}

function idempotencyKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

function normalizeAssignmentStatuses(
  rows: Array<{
    assignmentId: string;
    positionId: string;
    status: string;
    missingCount: number;
    pendingCount: number;
    nonCompliantCount: number;
  }>,
) {
  return rows
    .map((row) => ({
      assignmentId: row.assignmentId,
      positionId: row.positionId,
      status: row.status,
      missingCount: row.missingCount,
      pendingCount: row.pendingCount,
      nonCompliantCount: row.nonCompliantCount,
    }))
    .sort((a, b) => a.assignmentId.localeCompare(b.assignmentId));
}

function normalizePositionStatuses(
  rows: Array<{
    positionId: string;
    status: string;
    missingCount: number;
    pendingCount: number;
    nonCompliantCount: number;
  }>,
) {
  return rows
    .map((row) => ({
      positionId: row.positionId,
      status: row.status,
      missingCount: row.missingCount,
      pendingCount: row.pendingCount,
      nonCompliantCount: row.nonCompliantCount,
    }))
    .sort((a, b) => a.positionId.localeCompare(b.positionId));
}

function toEventEnvelopes(rows: Array<typeof orgEventsTable.$inferSelect>): EventEnvelope[] {
  return rows.map((row) => ({
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
    payloadHash: row.payloadHash ?? "",
  }));
}

async function runPhase3Certification() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run phase 3 certification.");
  }

  const actor = makeActor();
  const organizations = buildOrganizationService();
  const teams = buildTeamService();
  const positions = buildPositionService();
  const people = buildPeopleService();
  const assignments = buildAssignmentService();
  const evidence = buildEvidenceService();
  const compensation = buildCompensationService();
  const offboarding = buildOffboardingService();

  const organization = await organizations.create(actor, {
    name: `Phase 3 Cert ${new Date().toISOString()}`,
    slug: `phase3-cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const organizationId = organization.id;
  const gates: GateResult[] = [];

  const team = await teams.create(actor, organizationId, { name: "Operations", code: "OPS" });
  const ceo = await positions.create(actor, organizationId, {
    title: "CEO",
    lifecycleStatus: "vacant",
  });
  const manager = await positions.create(actor, organizationId, {
    teamId: team.id,
    title: "Operations Manager",
    reportsToPositionId: ceo.id,
    lifecycleStatus: "vacant",
  });
  const person = await people.create(actor, organizationId, {
    fullName: "Maya",
    email: "maya@phase3.cert",
    employmentStatus: "active",
  });
  const assignmentStart = await assignments.start(actor, organizationId, {
    personId: person.id,
    positionId: manager.id,
    idempotencyKey: idempotencyKey("p3-assign-start"),
  });
  if (!("assignment" in assignmentStart)) {
    throw new Error("Expected assignment payload in assignment start response");
  }
  const assignmentId = assignmentStart.assignment.id;

  await evidence.upsertRequirementProfile(actor, organizationId, {
    positionId: manager.id,
    profileName: "Manager baseline",
    requirements: [
      { requirementKey: "id_document", displayName: "Government ID", isRequired: true },
      { requirementKey: "nda", displayName: "NDA", isRequired: true },
    ],
    idempotencyKey: idempotencyKey("p3-profile-initial"),
  });

  const idDocUpload = await evidence.uploadDocument(actor, organizationId, {
    assignmentId,
    requirementKey: "id_document",
    sourceDocumentRef: "s3://phase3/id-doc.pdf",
    idempotencyKey: idempotencyKey("p3-id-upload"),
  });
  const ndaDocUpload = await evidence.uploadDocument(actor, organizationId, {
    assignmentId,
    requirementKey: "nda",
    sourceDocumentRef: "s3://phase3/nda.pdf",
    idempotencyKey: idempotencyKey("p3-nda-upload"),
  });
  if (!("document" in idDocUpload) || !("document" in ndaDocUpload)) {
    throw new Error("Expected document payloads in upload responses");
  }
  const idDocId = idDocUpload.document.id;
  const ndaDocId = ndaDocUpload.document.id;

  await evidence.transitionDocumentState(actor, organizationId, idDocId, {
    toState: "signed",
    idempotencyKey: idempotencyKey("p3-id-sign"),
  });
  await evidence.transitionDocumentState(actor, organizationId, ndaDocId, {
    toState: "signed",
    idempotencyKey: idempotencyKey("p3-nda-sign"),
  });

  const statusBeforeEvolution = await db
    .select()
    .from(evidenceStatusByAssignmentTable)
    .where(
      and(
        eq(evidenceStatusByAssignmentTable.organizationId, organizationId),
        eq(evidenceStatusByAssignmentTable.assignmentId, assignmentId),
      ),
    )
    .limit(1);
  assert.equal(statusBeforeEvolution[0]?.status, "compliant");

  const eventsBeforeEvolutionRows = await db
    .select()
    .from(orgEventsTable)
    .where(eq(orgEventsTable.orgId, organizationId));
  const eventsBeforeEvolution = toEventEnvelopes(eventsBeforeEvolutionRows);

  // P3-G2 Requirement profile evolution should not retroactively corrupt history.
  {
    const details: string[] = [];
    await evidence.upsertRequirementProfile(actor, organizationId, {
      positionId: manager.id,
      profileName: "Manager evolved",
      requirements: [
        { requirementKey: "id_document", displayName: "Government ID", isRequired: true },
        { requirementKey: "nda", displayName: "NDA", isRequired: true },
        { requirementKey: "background_check", displayName: "Background Check", isRequired: true },
      ],
      idempotencyKey: idempotencyKey("p3-profile-evolve"),
    });

    const statusAfterEvolution = await db
      .select()
      .from(evidenceStatusByAssignmentTable)
      .where(
        and(
          eq(evidenceStatusByAssignmentTable.organizationId, organizationId),
          eq(evidenceStatusByAssignmentTable.assignmentId, assignmentId),
        ),
      )
      .limit(1);
    assert.equal(statusAfterEvolution[0]?.status, "missing");

    const replayBefore = deriveEvidenceStatusByAssignment({
      requirementRules: deriveRequirementRulesFromEvents(eventsBeforeEvolution),
      documentSnapshots: deriveDocumentSnapshotsFromEvents(eventsBeforeEvolution),
      events: eventsBeforeEvolution,
    });
    assert.equal(replayBefore.find((row) => row.assignmentId === assignmentId)?.status, "compliant");

    details.push("Evolved manager profile with new required background_check requirement.");
    details.push("Live compliance changed from compliant -> missing after evolution.");
    details.push("Replay limited to pre-evolution events remained compliant (historical correctness preserved).");
    gates.push({ gate: "P3-G2 Requirement profile evolution", passed: true, details });
  }

  // P3-G3 Document lifecycle transitions.
  {
    const details: string[] = [];
    await evidence.transitionDocumentState(actor, organizationId, idDocId, {
      toState: "expired",
      idempotencyKey: idempotencyKey("p3-id-expire"),
    });
    const backgroundDocUpload = await evidence.uploadDocument(actor, organizationId, {
      assignmentId,
      requirementKey: "background_check",
      sourceDocumentRef: "s3://phase3/background-check.pdf",
      idempotencyKey: idempotencyKey("p3-bg-upload"),
    });
    if (!("document" in backgroundDocUpload)) {
      throw new Error("Expected document payload in background upload response");
    }
    const backgroundDocId = backgroundDocUpload.document.id;
    await evidence.transitionDocumentState(actor, organizationId, backgroundDocId, {
      toState: "revoked",
      idempotencyKey: idempotencyKey("p3-bg-revoke"),
    });

    const docs = await db
      .select({ id: documentsTable.id, state: documentsTable.state })
      .from(documentsTable)
      .where(eq(documentsTable.organizationId, organizationId));
    assert.ok(docs.some((doc) => doc.id === idDocId && doc.state === "expired"));
    assert.ok(
      docs.some((doc) => doc.id === backgroundDocId && doc.state === "revoked"),
    );

    const statusAfterLifecycle = await db
      .select()
      .from(evidenceStatusByAssignmentTable)
      .where(
        and(
          eq(evidenceStatusByAssignmentTable.organizationId, organizationId),
          eq(evidenceStatusByAssignmentTable.assignmentId, assignmentId),
        ),
      )
      .limit(1);
    assert.equal(statusAfterLifecycle[0]?.status, "non_compliant");

    details.push("Validated uploaded -> signed -> expired transition path.");
    details.push("Validated uploaded -> revoked transition path.");
    details.push("Derived compliance status moved to non_compliant from document states.");
    gates.push({ gate: "P3-G3 Document lifecycle transitions", passed: true, details });
  }

  // P3-G1 Evidence replay determinism (live projection == replayed state).
  {
    const details: string[] = [];
    const eventsRows = await db
      .select()
      .from(orgEventsTable)
      .where(eq(orgEventsTable.orgId, organizationId));
    const events = toEventEnvelopes(eventsRows);
    const replayAssignmentRaw = deriveEvidenceStatusByAssignment({
      requirementRules: deriveRequirementRulesFromEvents(events),
      documentSnapshots: deriveDocumentSnapshotsFromEvents(events),
      events,
    });
    const replayAssignment = normalizeAssignmentStatuses(replayAssignmentRaw);
    const replayPosition = normalizePositionStatuses(deriveEvidenceStatusByPosition(replayAssignmentRaw));
    const liveAssignment = normalizeAssignmentStatuses(
      await db
        .select()
        .from(evidenceStatusByAssignmentTable)
        .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId)),
    );
    const livePositionAll = normalizePositionStatuses(
      await db
        .select()
        .from(evidenceStatusByPositionTable)
        .where(eq(evidenceStatusByPositionTable.organizationId, organizationId)),
    );
    const replayPositionIds = new Set(replayPosition.map((row) => row.positionId));
    const livePosition = livePositionAll.filter((row) => replayPositionIds.has(row.positionId));

    assert.deepEqual(liveAssignment, replayAssignment);
    assert.deepEqual(livePosition, replayPosition);

    details.push("Replay-derived evidence_status_by_assignment matched live projection rows.");
    details.push("Replay-derived evidence_status_by_position matched live projection rows for evaluated positions.");
    gates.push({ gate: "P3-G1 Evidence replay determinism", passed: true, details });
  }

  // P3-G4 Compensation audit trail (append-only + reconstructable current).
  {
    const details: string[] = [];
    const first = await compensation.record(actor, organizationId, {
      assignmentId,
      sourceDocumentId: ndaDocId,
      amount: 120_000_00,
      currency: "usd",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      idempotencyKey: idempotencyKey("p3-comp-1"),
    });
    const second = await compensation.record(actor, organizationId, {
      assignmentId,
      sourceDocumentId: ndaDocId,
      amount: 140_000_00,
      currency: "usd",
      effectiveFrom: "2026-03-01T00:00:00.000Z",
      idempotencyKey: idempotencyKey("p3-comp-2"),
    });
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, false);

    const records = await db
      .select()
      .from(compensationRecordsTable)
      .where(eq(compensationRecordsTable.organizationId, organizationId));
    assert.equal(records.length, 2);

    const [liveCurrent] = await db
      .select()
      .from(compensationCurrentTable)
      .where(
        and(
          eq(compensationCurrentTable.organizationId, organizationId),
          eq(compensationCurrentTable.assignmentId, assignmentId),
        ),
      )
      .limit(1);
    assert.ok(liveCurrent);
    assert.equal(liveCurrent.amount, 140_000_00);

    const compensationEventRows = await db
      .select()
      .from(orgEventsTable)
      .where(eq(orgEventsTable.orgId, organizationId));
    const compensationEvents = toEventEnvelopes(compensationEventRows);
    const replayRecords = deriveCompensationRecordsFromEvents(compensationEvents);
    const replayCurrent = deriveCompensationCurrentByAssignment(replayRecords).get(assignmentId);
    assert.ok(replayCurrent);
    assert.equal(replayCurrent?.amount, liveCurrent.amount);
    assert.equal(replayRecords.length, 2);

    details.push("Recorded two append-only compensation rows linked to assignment + source document.");
    details.push("Live compensation_current points at the latest effective compensation.");
    details.push("Replayed compensation current matched projection (history reconstructable).");
    gates.push({ gate: "P3-G4 Compensation audit trail", passed: true, details });
  }

  // Offboarding completion boundary requirement.
  const offboardingResult = await offboarding.complete(actor, organizationId, {
    assignmentId,
    completedAt: "2026-04-01T00:00:00.000Z",
    snapshot: { reason: "role retired" },
    idempotencyKey: idempotencyKey("p3-offboarding-complete"),
  });
  if (!("offboardingId" in offboardingResult)) {
    throw new Error("Expected offboarding completion payload in response");
  }
  assert.equal(offboardingResult.replayed, false);
  const [endedAssignment] = await db
    .select()
    .from(personPositionAssignmentsTable)
    .where(
      and(
        eq(personPositionAssignmentsTable.organizationId, organizationId),
        eq(personPositionAssignmentsTable.id, assignmentId),
      ),
    )
    .limit(1);
  assert.equal(endedAssignment?.status, "ended");
  const [offboardingCompletion] = await db
    .select()
    .from(offboardingCompletionsTable)
    .where(
      and(
        eq(offboardingCompletionsTable.organizationId, organizationId),
        eq(offboardingCompletionsTable.assignmentId, assignmentId),
      ),
    )
    .limit(1);
  assert.ok(offboardingCompletion);
  const offboardingEvents = await db
    .select({ type: orgEventsTable.eventType, payload: orgEventsTable.payload })
    .from(orgEventsTable)
    .where(eq(orgEventsTable.orgId, organizationId));
  assert.ok(
    offboardingEvents.some(
      (event) =>
        event.type === "assignment.ended" &&
        (event.payload as Record<string, unknown>).reason === "offboarding.complete",
    ),
  );
  assert.ok(offboardingEvents.some((event) => event.type === "offboarding.completed"));

  const artifact = {
    generatedAt: new Date().toISOString(),
    organizationId,
    baselineTagPrerequisite: "teamframe-core-certified-v1",
    gates,
    offboardingBoundary: {
      assignmentId,
      offboardingId: offboardingResult.offboardingId,
      assignmentStatus: endedAssignment?.status,
      completionRecorded: Boolean(offboardingCompletion),
    },
    counts: {
      events: offboardingEvents.length,
      compensationRecords: (
        await db
          .select({ id: compensationRecordsTable.id })
          .from(compensationRecordsTable)
          .where(eq(compensationRecordsTable.organizationId, organizationId))
      ).length,
      assignmentEvidenceRows: (
        await db
          .select({ assignmentId: evidenceStatusByAssignmentTable.assignmentId })
          .from(evidenceStatusByAssignmentTable)
          .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId))
      ).length,
      positionEvidenceRows: (
        await db
          .select({ positionId: evidenceStatusByPositionTable.positionId })
          .from(evidenceStatusByPositionTable)
          .where(eq(evidenceStatusByPositionTable.organizationId, organizationId))
      ).length,
    },
  };

  const artifactPath = path.resolve(
    process.cwd(),
    "../phase-execution/phase-3-certification.latest.json",
  );
  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2));

  console.log(`Phase 3 Certification: PASS (${gates.length} gates)`);
  for (const gate of gates) {
    console.log(`- ${gate.gate}: ${gate.passed ? "PASS" : "FAIL"}`);
    for (const detail of gate.details) {
      console.log(`  • ${detail}`);
    }
  }
  console.log(`Offboarding boundary check: PASS (${offboardingResult.offboardingId})`);
  console.log(`Certification artifact written: ${artifactPath}`);
}

void runPhase3Certification().catch((error) => {
  console.error("Phase 3 Certification: FAIL");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
