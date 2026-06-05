import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  aggregateVersionsTable,
  db,
  idempotencyRecordsTable,
  orgEventsTable,
  outboxEventsTable,
  personPositionAssignmentsTable,
  streamQuarantinesTable,
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

type AssignmentCommandInput = {
  idempotencyKey: string;
};

function parseDateOrNow(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    badRequest("Invalid timestamp format");
  }
  return parsed;
}

function assertIdempotencyKey(input: AssignmentCommandInput): void {
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
    assertIdempotencyKey(input);

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

      const [inserted] = await tx
        .insert(personPositionAssignmentsTable)
        .values({
          id: assignmentId,
          organizationId,
          personId: input.personId,
          positionId: input.positionId,
          startedAt,
          status: "active",
          updatedAt: new Date(),
        })
        .returning();

      if (!inserted) {
        badRequest("Failed to create assignment");
      }

      const payload = {
        assignmentId,
        personId: input.personId,
        positionId: input.positionId,
        effectiveFrom: startedAt.toISOString(),
      };
      await this.appendAssignmentEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateId: assignmentId,
        eventType: "assignment.started",
        idempotencyKey: input.idempotencyKey,
        payload,
      });

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
    assertIdempotencyKey(input);

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

      const [ended] = await tx
        .update(personPositionAssignmentsTable)
        .set({
          status: "ended",
          endedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.id, assignmentId),
          ),
        )
        .returning();

      if (!ended) notFound("Assignment not found");

      const payload = {
        assignmentId: ended.id,
        effectiveTo: endedAt.toISOString(),
      };
      await this.appendAssignmentEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateId: ended.id,
        eventType: "assignment.ended",
        idempotencyKey: input.idempotencyKey,
        payload,
      });

      const response = {
        assignment: ended,
        replayed: false,
      };

      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "assignment.end",
          assignmentId: ended.id,
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
    assertIdempotencyKey(input);

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

      const [ended] = await tx
        .update(personPositionAssignmentsTable)
        .set({
          status: "ended",
          endedAt: effectiveAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.id, currentAssignment.id),
          ),
        )
        .returning();
      if (!ended) notFound("Assignment not found");

      const [inserted] = await tx
        .insert(personPositionAssignmentsTable)
        .values({
          id: newAssignmentId,
          organizationId,
          personId: input.personId,
          positionId: input.toPositionId,
          startedAt: effectiveAt,
          status: "active",
          updatedAt: new Date(),
        })
        .returning();
      if (!inserted) {
        badRequest("Failed to create assignment");
      }

      await this.appendAssignmentEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateId: ended.id,
        eventType: "assignment.ended",
        idempotencyKey: `${input.idempotencyKey}-end`,
        payload: {
          assignmentId: ended.id,
          effectiveTo: effectiveAt.toISOString(),
        },
      });

      await this.appendAssignmentEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateId: inserted.id,
        eventType: "assignment.started",
        idempotencyKey: `${input.idempotencyKey}-start`,
        payload: {
          assignmentId: inserted.id,
          personId: input.personId,
          positionId: input.toPositionId,
          effectiveFrom: effectiveAt.toISOString(),
        },
      });

      const response = {
        assignment: inserted,
        endedAssignmentId: ended.id,
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

  private async appendAssignmentEvent(
    tx: any,
    input: {
      organizationId: string;
      actorUserId: string;
      aggregateId: string;
      eventType: "assignment.started" | "assignment.ended";
      idempotencyKey: string;
      payload: Record<string, unknown>;
    },
  ) {
    const [quarantine] = await tx
      .select({ state: streamQuarantinesTable.state })
      .from(streamQuarantinesTable)
      .where(
        and(
          eq(streamQuarantinesTable.orgId, input.organizationId),
          eq(streamQuarantinesTable.aggregateType, "assignment"),
          eq(streamQuarantinesTable.aggregateId, input.aggregateId),
        ),
      )
      .limit(1);

    if (quarantine?.state === "quarantined") {
      badRequest(`Assignment aggregate ${input.aggregateId} is quarantined`);
    }

    const [currentVersion] = await tx
      .select({ version: aggregateVersionsTable.version })
      .from(aggregateVersionsTable)
      .where(
        and(
          eq(aggregateVersionsTable.orgId, input.organizationId),
          eq(aggregateVersionsTable.aggregateType, "assignment"),
          eq(aggregateVersionsTable.aggregateId, input.aggregateId),
        ),
      )
      .limit(1);

    const nextVersion = (currentVersion?.version ?? 0) + 1;
    const payloadHash = stableHash(input.payload);

    const [event] = await tx
      .insert(orgEventsTable)
      .values({
        orgId: input.organizationId,
        aggregateType: "assignment",
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        version: nextVersion,
        actorUserId: input.actorUserId,
        idempotencyKey: input.idempotencyKey,
        schemaVersion: 1,
        payload: input.payload,
        payloadHash,
      })
      .returning({ id: orgEventsTable.id });

    if (!event) {
      badRequest("Failed to append assignment event");
    }

    await tx
      .insert(aggregateVersionsTable)
      .values({
        orgId: input.organizationId,
        aggregateType: "assignment",
        aggregateId: input.aggregateId,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          aggregateVersionsTable.orgId,
          aggregateVersionsTable.aggregateType,
          aggregateVersionsTable.aggregateId,
        ],
        set: {
          version: nextVersion,
          updatedAt: new Date(),
        },
      });

    await tx.insert(outboxEventsTable).values({
      orgId: input.organizationId,
      eventId: event.id,
      type: input.eventType,
      payload: input.payload,
    });
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
  );
}
