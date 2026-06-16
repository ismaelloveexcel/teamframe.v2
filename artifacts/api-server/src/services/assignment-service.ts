import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  aggregateVersionsTable,
  db,
  idempotencyRecordsTable,
  personPositionAssignmentsTable,
} from "@workspace/db";
import { OrganizationAccessControl } from "../access/organization-access";
import { stableHash } from "../domain/event-core";
import { badRequest, conflict, notFound } from "../lib/http-error";
import type { ActorContext } from "../lib/request-context";
import {
  MembershipRepository,
  OrganizationRepository,
  PeopleRepository,
  PersonPositionAssignmentRepository,
  PositionRepository,
} from "../persistence/repositories";
import { appendDomainEvent, assertIdempotencyKey, parseDateOrNow } from "./event-store-write";
import { buildProjectionBuilderService, ProjectionBuilderService } from "./projection-builder-service";

type AssignmentCommandInput = {
  idempotencyKey: string;
};

function assertCommandIdempotency(input: AssignmentCommandInput): void {
  if (input.idempotencyKey.trim().length < 8) {
    badRequest("idempotencyKey must be at least 8 characters");
  }
}

export class AssignmentService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly assignments: PersonPositionAssignmentRepository,
    private readonly people: PeopleRepository,
    private readonly positions: PositionRepository,
    private readonly projector: ProjectionBuilderService,
  ) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.assignments.listByOrganization(organizationId);
  }

  async start(
    actor: ActorContext,
    organizationId: string,
    input: {
      personId: string;
      positionId: string;
      startedAt?: string;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertCommandIdempotency(input);

    const [person, position] = await Promise.all([
      this.people.getById(organizationId, input.personId),
      this.positions.getById(organizationId, input.positionId),
    ]);
    if (!person) badRequest("personId must belong to the same organization");
    if (!position) badRequest("positionId must belong to the same organization");

    const [activeSeat, activePerson] = await Promise.all([
      this.assignments.getActiveByPositionId(organizationId, input.positionId),
      this.assignments.getActiveByPersonId(organizationId, input.personId),
    ]);
    if (activeSeat) badRequest("Position already has an active assignment");
    if (activePerson) badRequest("Person already has an active assignment; use transfer");

    const startedAt = parseDateOrNow(input.startedAt);
    const assignmentId = randomUUID();

    return db.transaction(async (tx) => {
      const replay = await tx
        .select({ responseBlob: idempotencyRecordsTable.responseBlob })
        .from(idempotencyRecordsTable)
        .where(
          and(
            eq(idempotencyRecordsTable.orgId, organizationId),
            eq(idempotencyRecordsTable.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (replay[0]) {
        return { ...(replay[0].responseBlob as Record<string, unknown>), replayed: true };
      }

      const payload = {
        assignmentId,
        personId: input.personId,
        employeeId: input.personId,
        positionId: input.positionId,
        effectiveFrom: startedAt.toISOString(),
      };

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "assignment",
        aggregateId: assignmentId,
        eventType: "assignment.started",
        idempotencyKey: input.idempotencyKey,
        payload,
      });

      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          assignments: true,
          evidence: true,
          compensationCurrent: true,
        },
      });

      const [inserted] = await tx
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.id, assignmentId),
          ),
        )
        .limit(1);

      if (!inserted) {
        badRequest("Failed to create assignment projection");
      }

      const response = {
        assignment: inserted,
        replayed: false,
      };

      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "assignment.start",
          personId: input.personId,
          positionId: input.positionId,
          startedAt: startedAt.toISOString(),
        }),
        responseBlob: response,
      });

      return response;
    });
  }

  async end(
    actor: ActorContext,
    organizationId: string,
    assignmentId: string,
    input: {
      endedAt?: string;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertCommandIdempotency(input);

    const assignment = await this.assignments.getById(organizationId, assignmentId);
    if (!assignment) notFound("Assignment not found");
    if (assignment.status === "ended") {
      badRequest("Assignment is already ended");
    }
    const endedAt = parseDateOrNow(input.endedAt);

    return db.transaction(async (tx) => {
      const replay = await tx
        .select({ responseBlob: idempotencyRecordsTable.responseBlob })
        .from(idempotencyRecordsTable)
        .where(
          and(
            eq(idempotencyRecordsTable.orgId, organizationId),
            eq(idempotencyRecordsTable.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (replay[0]) {
        return { ...(replay[0].responseBlob as Record<string, unknown>), replayed: true };
      }

      const payload = {
        assignmentId,
        effectiveTo: endedAt.toISOString(),
      };

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "assignment",
        aggregateId: assignmentId,
        eventType: "assignment.ended",
        idempotencyKey: input.idempotencyKey,
        payload,
      });

      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          assignments: true,
          evidence: true,
          compensationCurrent: true,
        },
      });

      const [ended] = await tx
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.id, assignmentId),
          ),
        )
        .limit(1);

      if (!ended) notFound("Assignment not found");

      const response = {
        assignment: ended,
        replayed: false,
      };

      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "assignment.end",
          assignmentId,
          endedAt: endedAt.toISOString(),
        }),
        responseBlob: response,
      });

      return response;
    });
  }

  async transfer(
    actor: ActorContext,
    organizationId: string,
    input: {
      personId: string;
      toPositionId: string;
      effectiveAt?: string;
      fromAssignmentId?: string;
      expectedFromAssignmentVersion?: number;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertCommandIdempotency(input);

    const [person, targetPosition, seatAssignment] = await Promise.all([
      this.people.getById(organizationId, input.personId),
      this.positions.getById(organizationId, input.toPositionId),
      this.assignments.getActiveByPositionId(organizationId, input.toPositionId),
    ]);
    const currentAssignment = input.fromAssignmentId
      ? await this.assignments.getById(organizationId, input.fromAssignmentId)
      : await this.assignments.getActiveByPersonId(organizationId, input.personId);

    if (!person) badRequest("personId must belong to the same organization");
    if (!targetPosition) badRequest("toPositionId must belong to the same organization");
    if (!currentAssignment) badRequest("No active assignment to transfer");
    if (currentAssignment.personId !== input.personId) {
      badRequest("fromAssignmentId must belong to personId");
    }
    if (typeof input.expectedFromAssignmentVersion !== "undefined") {
      const currentVersion = await this.getAggregateVersion(organizationId, currentAssignment.id);
      if (currentVersion !== input.expectedFromAssignmentVersion) {
        conflict("version_conflict");
      }
    }
    if (currentAssignment.status !== "active") {
      badRequest("fromAssignmentId is not active");
    }
    if (currentAssignment.positionId === input.toPositionId) {
      badRequest("Person is already assigned to the target position");
    }
    if (seatAssignment && seatAssignment.personId !== input.personId) {
      badRequest("Target position already has an active assignment");
    }

    const effectiveAt = parseDateOrNow(input.effectiveAt);
    const newAssignmentId = randomUUID();

    return db.transaction(async (tx) => {
      const replay = await tx
        .select({ responseBlob: idempotencyRecordsTable.responseBlob })
        .from(idempotencyRecordsTable)
        .where(
          and(
            eq(idempotencyRecordsTable.orgId, organizationId),
            eq(idempotencyRecordsTable.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (replay[0]) {
        return { ...(replay[0].responseBlob as Record<string, unknown>), replayed: true };
      }

      const endedPayload = {
        assignmentId: currentAssignment.id,
        effectiveTo: effectiveAt.toISOString(),
      };
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "assignment",
        aggregateId: currentAssignment.id,
        eventType: "assignment.ended",
        idempotencyKey: `${input.idempotencyKey}-end`,
        payload: endedPayload,
      });
      await this.projector.projectAssignmentEventTx(tx, {
        organizationId,
        eventType: "assignment.ended",
        payload: endedPayload,
      });

      const startedPayload = {
        assignmentId: newAssignmentId,
        personId: input.personId,
        employeeId: input.personId,
        positionId: input.toPositionId,
        effectiveFrom: effectiveAt.toISOString(),
      };
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "assignment",
        aggregateId: newAssignmentId,
        eventType: "assignment.started",
        idempotencyKey: `${input.idempotencyKey}-start`,
        payload: startedPayload,
      });
      await this.projector.projectAssignmentEventTx(tx, {
        organizationId,
        eventType: "assignment.started",
        payload: startedPayload,
      });

      const [inserted, ended] = await Promise.all([
        tx
          .select()
          .from(personPositionAssignmentsTable)
          .where(
            and(
              eq(personPositionAssignmentsTable.organizationId, organizationId),
              eq(personPositionAssignmentsTable.id, newAssignmentId),
            ),
          )
          .limit(1),
        tx
          .select()
          .from(personPositionAssignmentsTable)
          .where(
            and(
              eq(personPositionAssignmentsTable.organizationId, organizationId),
              eq(personPositionAssignmentsTable.id, currentAssignment.id),
            ),
          )
          .limit(1),
      ]);

      const nextAssignment = inserted[0];
      const previousAssignment = ended[0];
      if (!nextAssignment || !previousAssignment) {
        badRequest("Failed to project assignment transfer state");
      }

      const response = {
        assignment: nextAssignment,
        endedAssignmentId: previousAssignment.id,
        replayed: false,
      };

      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "assignment.transfer",
          personId: input.personId,
          toPositionId: input.toPositionId,
          effectiveAt: effectiveAt.toISOString(),
        }),
        responseBlob: response,
      });

      return response;
    });
  }

  private async getAggregateVersion(orgId: string, aggregateId: string): Promise<number> {
    const [record] = await db
      .select({ version: aggregateVersionsTable.version })
      .from(aggregateVersionsTable)
      .where(
        and(
          eq(aggregateVersionsTable.orgId, orgId),
          eq(aggregateVersionsTable.aggregateType, "assignment"),
          eq(aggregateVersionsTable.aggregateId, aggregateId),
        ),
      )
      .limit(1);
    return record?.version ?? 0;
  }
}

export function buildAssignmentService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);

  return new AssignmentService(
    access,
    new PersonPositionAssignmentRepository(),
    new PeopleRepository(),
    new PositionRepository(),
    buildProjectionBuilderService(),
  );
}
