import assert from "node:assert/strict";
import test from "node:test";
import { HttpError } from "../lib/http-error";
import { ActionService } from "./action-service";

const ACTOR = {
  userId: "user-1",
  email: "owner@example.com",
  fullName: "Owner",
};

function buildHarness(options?: {
  assignmentById?: { id: string; personId: string; positionId: string } | null;
  activeAssignmentByPerson?: { id: string; personId: string; positionId: string } | null;
  knownPersonIds?: string[];
  knownPositionIds?: string[];
}) {
  const createdInputs: Array<Record<string, unknown>> = [];
  const listForPositionCalls: string[] = [];
  const listForPersonCalls: string[] = [];
  const summaryCalls: string[] = [];

  const knownPersonIds = new Set(options?.knownPersonIds ?? ["person-1"]);
  const knownPositionIds = new Set(options?.knownPositionIds ?? ["position-1"]);

  const actionRepository = {
    listByOrganization: async () => [],
    listByPositionContext: async (_organizationId: string, positionId: string) => {
      listForPositionCalls.push(positionId);
      return [{ id: "action-pos" }];
    },
    listByPersonContext: async (_organizationId: string, personId: string) => {
      listForPersonCalls.push(personId);
      return [{ id: "action-person" }];
    },
    getPositionExecutionSummary: async (_organizationId: string, positionId: string) => {
      summaryCalls.push(positionId);
      return {
        totalActions: 3,
        openActions: 1,
        inProgressActions: 1,
        doneActions: 1,
        overdueActions: 0,
      };
    },
    getById: async () => null,
    create: async (_organizationId: string, input: Record<string, unknown>) => {
      createdInputs.push(input);
      return { id: "action-1", ...input };
    },
    updateDetails: async () => null,
    transitionStatus: async () => null,
    delete: async () => ({ id: "action-1" }),
  };

  const accessControl = {
    requireMembership: async () => undefined,
  };

  const positionRepository = {
    getById: async (_organizationId: string, positionId: string) =>
      knownPositionIds.has(positionId) ? { id: positionId } : null,
  };

  const peopleRepository = {
    getById: async (_organizationId: string, personId: string) =>
      knownPersonIds.has(personId) ? { id: personId } : null,
  };

  const assignmentRepository = {
    getById: async () => options?.assignmentById ?? null,
    getActiveByPersonId: async () => options?.activeAssignmentByPerson ?? null,
  };

  const teamRepository = {
    getById: async () => ({ id: "team-1" }),
  };

  const auditRepository = {
    log: async () => undefined,
  };

  const service = new ActionService(
    accessControl as never,
    actionRepository as never,
    teamRepository as never,
    positionRepository as never,
    peopleRepository as never,
    assignmentRepository as never,
    auditRepository as never,
  );

  return {
    createdInputs,
    listForPositionCalls,
    listForPersonCalls,
    summaryCalls,
    service,
  };
}

test("assignment-based action creation resolves owner + link from assignment", async () => {
  const harness = buildHarness({
    assignmentById: {
      id: "assignment-1",
      personId: "person-1",
      positionId: "position-1",
    },
  });

  await harness.service.create(ACTOR, "org-1", {
    title: "Prepare board packet",
    assignmentId: "assignment-1",
  });

  assert.equal(harness.createdInputs.length, 1);
  assert.deepEqual(harness.createdInputs[0], {
    title: "Prepare board packet",
    description: null,
    dueDate: null,
    blocked: false,
    ownerPersonId: "person-1",
    ownerPositionId: "position-1",
    assignmentId: "assignment-1",
    teamId: null,
    positionId: "position-1",
    personId: null,
  });
});

test("person-based action creation auto-attaches active assignment", async () => {
  const harness = buildHarness({
    activeAssignmentByPerson: {
      id: "assignment-2",
      personId: "person-1",
      positionId: "position-1",
    },
  });

  await harness.service.create(ACTOR, "org-1", {
    title: "Run monthly payroll review",
    personId: "person-1",
  });

  assert.equal(harness.createdInputs[0]?.assignmentId, "assignment-2");
  assert.equal(harness.createdInputs[0]?.ownerPersonId, "person-1");
  assert.equal(harness.createdInputs[0]?.ownerPositionId, "position-1");
});

test("position-only action creation uses structural fallback", async () => {
  const harness = buildHarness();

  await harness.service.create(ACTOR, "org-1", {
    title: "Review policy exceptions",
    positionId: "position-1",
  });

  assert.equal(harness.createdInputs[0]?.assignmentId, null);
  assert.equal(harness.createdInputs[0]?.ownerPersonId, null);
  assert.equal(harness.createdInputs[0]?.ownerPositionId, "position-1");
  assert.equal(harness.createdInputs[0]?.positionId, "position-1");
});

test("orphan action ownership is rejected", async () => {
  const harness = buildHarness();

  await assert.rejects(
    async () => {
      await harness.service.create(ACTOR, "org-1", { title: "No owner path" });
    },
    (error) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      error.message.includes("must resolve"),
  );
});

test("context query endpoints route through position/person/summary services", async () => {
  const harness = buildHarness();

  const byPosition = await harness.service.listForPosition(ACTOR, "org-1", "position-1");
  const byPerson = await harness.service.listForPerson(ACTOR, "org-1", "person-1");
  const summary = await harness.service.getPositionExecutionSummary(ACTOR, "org-1", "position-1");

  assert.equal(byPosition.length, 1);
  assert.equal(byPerson.length, 1);
  assert.equal(summary.totalActions, 3);
  assert.deepEqual(harness.listForPositionCalls, ["position-1"]);
  assert.deepEqual(harness.listForPersonCalls, ["person-1"]);
  assert.deepEqual(harness.summaryCalls, ["position-1"]);
});
