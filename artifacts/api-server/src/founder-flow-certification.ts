import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  orgEventsTable,
  outboxEventsTable,
  peopleTable,
  personPositionAssignmentsTable,
} from "@workspace/db";
import { stableHash } from "./domain/event-core";
import type { ActorContext } from "./lib/request-context";
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

      detailsD.push("Ended Ahmed assignment via assignment command.");
      detailsD.push("Validated seat vacancy + preserved ended assignment history.");
      results.push({ scenario: "D: Offboarding", passed: true, details: detailsD });
    }
  }

  console.log(`Founder Flow Certification: PASS (${results.length} scenarios)`);
  for (const result of results) {
    console.log(`- ${result.scenario}: ${result.passed ? "PASS" : "FAIL"}`);
    for (const detail of result.details) {
      console.log(`  • ${detail}`);
    }
  }
}

void runFounderFlowCertification().catch((error) => {
  console.error("Founder Flow Certification: FAIL");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
