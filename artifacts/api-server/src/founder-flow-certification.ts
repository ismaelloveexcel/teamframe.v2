import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  aggregateVersionsTable,
  db,
  orgEventsTable,
  outboxEventsTable,
  peopleTable,
  personPositionAssignmentsTable,
} from "@workspace/db";
import { stableHash } from "./domain/event-core";
import type { ActorContext } from "./lib/request-context";
import { HttpError } from "./lib/http-error";
import { buildAssignmentService } from "./services/assignment-service";
import { buildOrganizationService } from "./services/organization-service";
import { buildPeopleService } from "./services/people-service";
import { buildPositionService } from "./services/position-service";
import { buildTeamService } from "./services/team-service";

type ScenarioResult = {
  scenario: string;
  passed: boolean;
  details: string[];
};

function makeActor(): ActorContext {
  return {
    userId: randomUUID(),
    email: `founder-${Date.now()}@teamframe.cert`,
    fullName: "Founder Certification",
  };
}

function idempotencyKey(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

async function runFounderFlowCertification(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to run founder flow certification.");
  }

  const actor = makeActor();
  const organizationService = buildOrganizationService();
  const teamService = buildTeamService();
  const positionService = buildPositionService();
  const peopleService = buildPeopleService();
  const assignmentService = buildAssignmentService();

  const results: ScenarioResult[] = [];

  const organization = await organizationService.create(actor, {
    name: `Founder Flow Cert ${new Date().toISOString()}`,
    slug: `founder-flow-cert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  });
  const organizationId = organization.id;

  // Scenario A — Org Creation (empty org to initial structure)
  {
    const details: string[] = [];
    const opsTeam = await teamService.create(actor, organizationId, { name: "Operations", code: "OPS" });
    const salesTeam = await teamService.create(actor, organizationId, { name: "Sales", code: "SLS" });
    const financeTeam = await teamService.create(actor, organizationId, { name: "Finance", code: "FIN" });

    const ceo = await positionService.create(actor, organizationId, {
      title: "CEO",
      lifecycleStatus: "vacant",
    });

    const operations = await positionService.create(actor, organizationId, {
      teamId: opsTeam.id,
      title: "Operations",
      reportsToPositionId: ceo.id,
      lifecycleStatus: "vacant",
    });
    const sales = await positionService.create(actor, organizationId, {
      teamId: salesTeam.id,
      title: "Sales",
      reportsToPositionId: ceo.id,
      lifecycleStatus: "vacant",
    });
    const finance = await positionService.create(actor, organizationId, {
      teamId: financeTeam.id,
      title: "Finance",
      reportsToPositionId: ceo.id,
      lifecycleStatus: "vacant",
    });

    const operationsManager = await positionService.create(actor, organizationId, {
      teamId: opsTeam.id,
      title: "Operations Manager",
      reportsToPositionId: operations.id,
      lifecycleStatus: "vacant",
    });
    const salesManager = await positionService.create(actor, organizationId, {
      teamId: salesTeam.id,
      title: "Sales Manager",
      reportsToPositionId: sales.id,
      lifecycleStatus: "vacant",
    });
    const financeManager = await positionService.create(actor, organizationId, {
      teamId: financeTeam.id,
      title: "Finance Manager",
      reportsToPositionId: finance.id,
      lifecycleStatus: "vacant",
    });

    const positions = await positionService.list(actor, organizationId);
    assert.equal(positions.length, 7, "Expected exactly 7 positions in founder structure.");
    assert.equal(
      positions.find((p) => p.id === operations.id)?.reportsToPositionId,
      ceo.id,
      "Operations must report to CEO.",
    );
    assert.equal(
      positions.find((p) => p.id === salesManager.id)?.reportsToPositionId,
      sales.id,
      "Sales Manager must report to Sales.",
    );
    assert.equal(
      positions.find((p) => p.id === financeManager.id)?.reportsToPositionId,
      finance.id,
      "Finance Manager must report to Finance.",
    );

    const structureHashA = stableHash(
      positions
        .map((position) => ({
          id: position.id,
          title: position.title,
          teamId: position.teamId,
          reportsToPositionId: position.reportsToPositionId,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    const positionsReplay = await positionService.list(actor, organizationId);
    const structureHashB = stableHash(
      positionsReplay
        .map((position) => ({
          id: position.id,
          title: position.title,
          teamId: position.teamId,
          reportsToPositionId: position.reportsToPositionId,
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    assert.equal(structureHashA, structureHashB, "Position structure hash must be deterministic.");

    details.push("Created CEO + departments + managers from empty org.");
    details.push("Reporting hierarchy validated.");
    details.push("Deterministic structure hash replay validated.");
    results.push({ scenario: "A: Org Creation", passed: true, details });

    // Scenario B/C/D uses these IDs.
    const john = await peopleService.create(actor, organizationId, {
      fullName: "John",
      email: "john@founderflow.cert",
      employmentStatus: "active",
    });
    const sarah = await peopleService.create(actor, organizationId, {
      fullName: "Sarah",
      email: "sarah@founderflow.cert",
      employmentStatus: "active",
    });
    const ahmed = await peopleService.create(actor, organizationId, {
      fullName: "Ahmed",
      email: "ahmed@founderflow.cert",
      employmentStatus: "active",
    });

    // Scenario B — First Employees
    {
      const detailsB: string[] = [];
      const startJohn = await assignmentService.start(actor, organizationId, {
        personId: john.id,
        positionId: financeManager.id,
        idempotencyKey: idempotencyKey("cert-start-john"),
      });
      const startSarah = await assignmentService.start(actor, organizationId, {
        personId: sarah.id,
        positionId: salesManager.id,
        idempotencyKey: idempotencyKey("cert-start-sarah"),
      });
      const startAhmed = await assignmentService.start(actor, organizationId, {
        personId: ahmed.id,
        positionId: operations.id,
        idempotencyKey: idempotencyKey("cert-start-ahmed"),
      });

      assert.equal(startJohn.replayed, false);
      assert.equal(startSarah.replayed, false);
      assert.equal(startAhmed.replayed, false);

      const seededPeople = await db
        .select({
          id: peopleTable.id,
          positionId: peopleTable.positionId,
        })
        .from(peopleTable)
        .where(
          and(
            eq(peopleTable.organizationId, organizationId),
            eq(peopleTable.id, john.id),
          ),
        );
      assert.equal(seededPeople[0]?.positionId ?? null, null, "people.positionId must remain non-authoritative.");

      const activeAssignments = await assignmentService.list(actor, organizationId);
      const activeCount = activeAssignments.filter((assignment) => assignment.status === "active").length;
      assert.equal(activeCount, 3, "Expected 3 active assignments after first employee assignments.");

      const assignmentStartedEvents = await db
        .select({ id: orgEventsTable.id })
        .from(orgEventsTable)
        .where(
          and(
            eq(orgEventsTable.orgId, organizationId),
            eq(orgEventsTable.eventType, "assignment.started"),
          ),
        );
      assert.ok(
        assignmentStartedEvents.length >= 3,
        "Expected assignment.started events to be recorded for assignment commands.",
      );

      detailsB.push("Created John/Sarah/Ahmed employee profiles with no occupancy authority on people.");
      detailsB.push("Assigned all 3 employees through assignment commands.");
      detailsB.push("Verified assignment.started events exist.");
      results.push({ scenario: "B: First Employees", passed: true, details: detailsB });
    }

    // Scenario C — Reassignment (Sarah: Sales Manager -> Operations Manager)
    {
      const detailsC: string[] = [];
      const transfer = await assignmentService.transfer(actor, organizationId, {
        personId: sarah.id,
        toPositionId: operationsManager.id,
        idempotencyKey: idempotencyKey("cert-transfer-sarah"),
      });
      assert.equal(transfer.replayed, false);
      assert.ok(
        "endedAssignmentId" in transfer && Boolean(transfer.endedAssignmentId),
        "Transfer must end previous assignment.",
      );

      const sarahAssignments = await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.personId, sarah.id),
          ),
        );
      const sarahActiveAssignments = sarahAssignments.filter((assignment) => assignment.status === "active");
      assert.equal(sarahActiveAssignments.length, 1, "Sarah must have exactly one active assignment after transfer.");
      assert.equal(
        sarahActiveAssignments[0]?.positionId,
        operationsManager.id,
        "Sarah active assignment must target Operations Manager.",
      );

      const positionSeatAssignments = await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.positionId, operationsManager.id),
            eq(personPositionAssignmentsTable.status, "active"),
          ),
        );
      assert.equal(
        positionSeatAssignments.length,
        1,
        "Target position must have single active assignment after transfer.",
      );

      const outboxTransferEvents = await db
        .select({ id: outboxEventsTable.id, type: outboxEventsTable.type })
        .from(outboxEventsTable)
        .where(eq(outboxEventsTable.orgId, organizationId));
      const hasTransferTrail =
        outboxTransferEvents.some((event) => event.type === "assignment.ended") &&
        outboxTransferEvents.some((event) => event.type === "assignment.started");
      assert.equal(hasTransferTrail, true, "Transfer must emit ended + started event trail.");

      detailsC.push("Transferred Sarah from Sales Manager to Operations Manager.");
      detailsC.push("Validated old assignment ended and new assignment started.");
      detailsC.push("Validated no dual occupancy and outbox event trail.");
      results.push({ scenario: "C: Reassignment", passed: true, details: detailsC });
    }

    // Scenario D — Offboarding (end Ahmed assignment)
    {
      const detailsD: string[] = [];
      const ahmedActive = await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.personId, ahmed.id),
            eq(personPositionAssignmentsTable.status, "active"),
          ),
        )
        .limit(1);

      const ahmedActiveAssignment = ahmedActive[0];
      assert.ok(ahmedActiveAssignment, "Ahmed must have active assignment prior to offboarding.");

      await assignmentService.end(actor, organizationId, ahmedActiveAssignment.id, {
        idempotencyKey: idempotencyKey("cert-end-ahmed"),
      });

      const ahmedPostAssignments = await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.personId, ahmed.id),
          ),
        );
      const ahmedActiveCount = ahmedPostAssignments.filter((assignment) => assignment.status === "active").length;
      assert.equal(ahmedActiveCount, 0, "Ahmed must have no active assignments after offboarding.");
      assert.ok(
        ahmedPostAssignments.some(
          (assignment) => assignment.status === "ended" && assignment.endedAt !== null,
        ),
        "Ended assignment history must be preserved after offboarding.",
      );

      const operationsSeatActive = await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.positionId, operations.id),
            eq(personPositionAssignmentsTable.status, "active"),
          ),
        );
      assert.equal(operationsSeatActive.length, 0, "Ahmed's seat should be vacant after offboarding.");

      const assignmentEndedEvents = await db
        .select({ id: orgEventsTable.id })
        .from(orgEventsTable)
        .where(
          and(
            eq(orgEventsTable.orgId, organizationId),
            eq(orgEventsTable.eventType, "assignment.ended"),
          ),
        );
      assert.ok(
        assignmentEndedEvents.length >= 1,
        "Expected assignment.ended event(s) to be recorded after offboarding.",
      );

      detailsD.push("Ended Ahmed assignment via assignment command.");
      detailsD.push("Validated seat vacancy + preserved ended assignment history.");
      detailsD.push("Verified assignment.ended events recorded for offboarding.");
      results.push({ scenario: "D: Offboarding", passed: true, details: detailsD });
    }

    // Scenario E — OCC Conflict (same expected version, dual transfer attempt)
    {
      const detailsE: string[] = [];
      const [sarahActiveBefore] = await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.personId, sarah.id),
            eq(personPositionAssignmentsTable.status, "active"),
          ),
        )
        .limit(1);
      assert.ok(sarahActiveBefore, "Sarah must have an active assignment before OCC scenario.");

      const [versionRecord] = await db
        .select({ version: aggregateVersionsTable.version })
        .from(aggregateVersionsTable)
        .where(
          and(
            eq(aggregateVersionsTable.orgId, organizationId),
            eq(aggregateVersionsTable.aggregateType, "assignment"),
            eq(aggregateVersionsTable.aggregateId, sarahActiveBefore.id),
          ),
        )
        .limit(1);

      const expectedFromAssignmentVersion = versionRecord?.version ?? 0;
      assert.ok(
        expectedFromAssignmentVersion > 0,
        "Expected source assignment aggregate version to be initialized before OCC test.",
      );

      const firstTransfer = await assignmentService.transfer(actor, organizationId, {
        personId: sarah.id,
        toPositionId: salesManager.id,
        fromAssignmentId: sarahActiveBefore.id,
        expectedFromAssignmentVersion,
        idempotencyKey: idempotencyKey("cert-occ-transfer-a"),
      });
      assert.equal(firstTransfer.replayed, false);

      let conflictError: unknown = null;
      try {
        await assignmentService.transfer(actor, organizationId, {
          personId: sarah.id,
          toPositionId: financeManager.id,
          fromAssignmentId: sarahActiveBefore.id,
          expectedFromAssignmentVersion,
          idempotencyKey: idempotencyKey("cert-occ-transfer-b"),
        });
      } catch (error) {
        conflictError = error;
      }

      assert.ok(conflictError instanceof HttpError, "Expected OCC conflict to raise HttpError.");
      assert.equal(conflictError.statusCode, 409, "Second transfer must return 409 version conflict.");
      assert.equal(conflictError.message, "version_conflict", "Conflict reason must be version_conflict.");

      const sarahPostTransfers = await db
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.personId, sarah.id),
            eq(personPositionAssignmentsTable.status, "active"),
          ),
        );
      assert.equal(sarahPostTransfers.length, 1, "Sarah must still have one active assignment after OCC conflict.");
      assert.equal(
        sarahPostTransfers[0]?.positionId,
        salesManager.id,
        "Sarah active assignment must remain the winner transfer target.",
      );

      detailsE.push("Captured source assignment version before concurrent transfer simulation.");
      detailsE.push("Transfer A succeeded with expectedFromAssignmentVersion.");
      detailsE.push("Transfer B failed with 409 version_conflict using same expected version.");
      detailsE.push("Validated winner assignment remains single-active (no dual occupancy).");
      results.push({ scenario: "E: OCC Conflict", passed: true, details: detailsE });
    }
  }

  const assignmentEvents = await db
    .select({ eventType: orgEventsTable.eventType })
    .from(orgEventsTable)
    .where(eq(orgEventsTable.orgId, organizationId));
  const assignmentStartedEventCount = assignmentEvents.filter((event) => event.eventType === "assignment.started").length;
  const assignmentEndedEventCount = assignmentEvents.filter((event) => event.eventType === "assignment.ended").length;

  const outboxAssignmentEvents = await db
    .select({ type: outboxEventsTable.type })
    .from(outboxEventsTable)
    .where(eq(outboxEventsTable.orgId, organizationId));
  const outboxStartedCount = outboxAssignmentEvents.filter((event) => event.type === "assignment.started").length;
  const outboxEndedCount = outboxAssignmentEvents.filter((event) => event.type === "assignment.ended").length;

  const assignmentProjectionRows = await db
    .select({ status: personPositionAssignmentsTable.status })
    .from(personPositionAssignmentsTable)
    .where(eq(personPositionAssignmentsTable.organizationId, organizationId));
  const projectionTotalCount = assignmentProjectionRows.length;
  const projectionEndedCount = assignmentProjectionRows.filter((assignment) => assignment.status === "ended").length;

  assert.equal(
    projectionTotalCount,
    assignmentStartedEventCount,
    "Projection row count must reconcile with assignment.started event count.",
  );
  assert.equal(
    projectionEndedCount,
    assignmentEndedEventCount,
    "Ended projection rows must reconcile with assignment.ended event count.",
  );
  assert.equal(
    outboxStartedCount,
    assignmentStartedEventCount,
    "Outbox assignment.started count must match event store count.",
  );
  assert.equal(
    outboxEndedCount,
    assignmentEndedEventCount,
    "Outbox assignment.ended count must match event store count.",
  );

  const artifactPath = path.resolve(process.cwd(), "../phase-execution/founder-flow-certification.latest.json");
  const artifact = {
    generatedAt: new Date().toISOString(),
    organizationId,
    scenarios: results,
    reconciliation: {
      eventStore: {
        assignmentStarted: assignmentStartedEventCount,
        assignmentEnded: assignmentEndedEventCount,
      },
      outbox: {
        assignmentStarted: outboxStartedCount,
        assignmentEnded: outboxEndedCount,
      },
      projection: {
        rows: projectionTotalCount,
        endedRows: projectionEndedCount,
      },
    },
  };

  await mkdir(path.dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, JSON.stringify(artifact, null, 2));

  console.log(`Founder Flow Certification: PASS (${results.length} scenarios)`);
  for (const result of results) {
    console.log(`- ${result.scenario}: ${result.passed ? "PASS" : "FAIL"}`);
    for (const detail of result.details) {
      console.log(`  • ${detail}`);
    }
  }
  console.log(
    `Reconciliation: events(started=${assignmentStartedEventCount}, ended=${assignmentEndedEventCount}) ` +
      `outbox(started=${outboxStartedCount}, ended=${outboxEndedCount}) ` +
      `projection(rows=${projectionTotalCount}, ended=${projectionEndedCount})`,
  );
  console.log(`Certification artifact written: ${artifactPath}`);
}

void runFounderFlowCertification().catch((error) => {
  console.error("Founder Flow Certification: FAIL");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
