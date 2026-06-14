import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, positionsTable } from "@workspace/db";
import type { ActorContext } from "../lib/request-context";
import { badRequest, notFound } from "../lib/http-error";
import { OrganizationAccessControl } from "../access/organization-access";
import {
  AuditRepository,
  MembershipRepository,
  OrganizationRepository,
  OwnershipRepository,
  PeopleRepository,
  PositionRepository,
  TeamRepository,
  type OwnershipAssignmentInput,
} from "../persistence/repositories";
import { requireOwnershipInput } from "./helpers";
import { appendDomainEvent } from "./event-store-write";
import { buildProjectionBuilderService, ProjectionBuilderService } from "./projection-builder-service";

export class PositionService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly positions: PositionRepository,
    private readonly teams: TeamRepository,
    private readonly people: PeopleRepository,
    private readonly ownerships: OwnershipRepository,
    private readonly audit: AuditRepository,
    private readonly projector: ProjectionBuilderService,
  ) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.positions.listByOrganization(organizationId);
  }

  async get(actor: ActorContext, organizationId: string, positionId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const position = await this.positions.getById(organizationId, positionId);
    if (!position) notFound("Position not found");
    return position;
  }

  async create(
    actor: ActorContext,
    organizationId: string,
    input: {
      teamId?: string;
      title: string;
      reportsToPositionId?: string;
      lifecycleStatus?: "filled" | "vacant" | "frozen";
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");

    if (input.teamId) {
      const team = await this.teams.getById(organizationId, input.teamId);
      if (!team) badRequest("teamId must belong to the same organization");
    }
    if (input.reportsToPositionId) {
      const manager = await this.positions.getById(organizationId, input.reportsToPositionId);
      if (!manager) badRequest("reportsToPositionId must belong to the same organization");
    }

    const positionId = randomUUID();
    return db.transaction(async (tx) => {
      const payload = {
        positionId,
        title: input.title,
        teamId: input.teamId ?? null,
        reportsToPositionId: input.reportsToPositionId ?? null,
        lifecycleStatus: input.lifecycleStatus ?? "vacant",
      };
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "position",
        aggregateId: positionId,
        eventType: "position.created",
        idempotencyKey: `position-create-${positionId}`,
        payload,
      });

      await this.projector.projectPositionEventTx(tx, {
        organizationId,
        eventType: "position.created",
        payload,
      });

      const [position] = await tx
        .select()
        .from(positionsTable)
        .where(and(eq(positionsTable.organizationId, organizationId), eq(positionsTable.id, positionId)))
        .limit(1);
      if (!position) {
        badRequest("Failed to create position projection");
      }
      return position;
    });
  }

  async update(
    actor: ActorContext,
    organizationId: string,
    positionId: string,
    input: {
      teamId?: string | null;
      title?: string;
      reportsToPositionId?: string | null;
      lifecycleStatus?: "filled" | "vacant" | "frozen";
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");

    if (typeof input.teamId !== "undefined" && input.teamId !== null) {
      const team = await this.teams.getById(organizationId, input.teamId);
      if (!team) badRequest("teamId must belong to the same organization");
    }
    if (
      typeof input.reportsToPositionId !== "undefined" &&
      input.reportsToPositionId !== null
    ) {
      if (input.reportsToPositionId === positionId) {
        badRequest("Position cannot report to itself");
      }
      const manager = await this.positions.getById(organizationId, input.reportsToPositionId);
      if (!manager) badRequest("reportsToPositionId must belong to the same organization");
    }

    const existing = await this.positions.getById(organizationId, positionId);
    if (!existing) notFound("Position not found");

    return db.transaction(async (tx) => {
      const payload: Record<string, unknown> = {
        positionId,
      };
      if (typeof input.teamId !== "undefined") payload.teamId = input.teamId;
      if (typeof input.title !== "undefined") payload.title = input.title;
      if (typeof input.reportsToPositionId !== "undefined") {
        payload.reportsToPositionId = input.reportsToPositionId;
      }
      if (typeof input.lifecycleStatus !== "undefined") {
        payload.lifecycleStatus = input.lifecycleStatus;
      }

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "position",
        aggregateId: positionId,
        eventType: "position.updated",
        idempotencyKey: `position-update-${positionId}-${randomUUID()}`,
        payload,
      });

      await this.projector.projectPositionEventTx(tx, {
        organizationId,
        eventType: "position.updated",
        payload,
      });

      const [updated] = await tx
        .select()
        .from(positionsTable)
        .where(and(eq(positionsTable.organizationId, organizationId), eq(positionsTable.id, positionId)))
        .limit(1);
      if (!updated) notFound("Position not found");
      return updated;
    });
  }

  async delete(actor: ActorContext, organizationId: string, positionId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const existing = await this.positions.getById(organizationId, positionId);
    if (!existing) notFound("Position not found");

    await db.transaction(async (tx) => {
      const payload = { positionId };
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "position",
        aggregateId: positionId,
        eventType: "position.deleted",
        idempotencyKey: `position-delete-${positionId}-${randomUUID()}`,
        payload,
      });

      await this.projector.projectPositionEventTx(tx, {
        organizationId,
        eventType: "position.deleted",
        payload,
      });
    });
  }

  async assignOwnership(
    actor: ActorContext,
    organizationId: string,
    positionId: string,
    input: OwnershipAssignmentInput,
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    requireOwnershipInput(input);

    const position = await this.positions.getById(organizationId, positionId);
    if (!position) notFound("Position not found");

    if (input.ownerPersonId) {
      const ownerPerson = await this.people.getById(organizationId, input.ownerPersonId);
      if (!ownerPerson) {
        badRequest("ownerPersonId must belong to the same organization");
      }
    }
    if (input.ownerPositionId) {
      const ownerPosition = await this.positions.getById(organizationId, input.ownerPositionId);
      if (!ownerPosition) {
        badRequest("ownerPositionId must belong to the same organization");
      }
    }

    const ownership = await this.ownerships.assignPositionOwnership(
      organizationId,
      positionId,
      input,
    );
    await this.audit.log({
      organizationId,
      actorUserId: actor.userId,
      eventType: "ownership_changed",
      entityType: "position",
      entityId: positionId,
      metadata: {
        ownerPersonId: ownership.ownerPersonId,
        ownerPositionId: ownership.ownerPositionId,
      },
    });
    return ownership;
  }
}

export function buildPositionService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);

  return new PositionService(
    access,
    new PositionRepository(),
    new TeamRepository(),
    new PeopleRepository(),
    new OwnershipRepository(),
    new AuditRepository(),
    buildProjectionBuilderService(),
  );
}
