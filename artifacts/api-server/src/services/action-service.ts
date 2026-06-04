import type { ActorContext } from "../lib/request-context";
import { badRequest, notFound } from "../lib/http-error";
import { OrganizationAccessControl } from "../access/organization-access";
import {
  ActionRepository,
  AuditRepository,
  MembershipRepository,
  OrganizationRepository,
  PeopleRepository,
  PositionRepository,
  TeamRepository,
  type ActionDetailsUpdateInput,
  type ActionLinkInput,
  type OwnershipAssignmentInput,
} from "../persistence/repositories";
import { requireExactlyOneActionLink, requireOwnershipInput, toPgDate } from "./helpers";

const ALLOWED_TRANSITIONS: Record<"open" | "in_progress" | "done", Array<"open" | "in_progress" | "done">> = {
  open: ["in_progress"],
  in_progress: ["done"],
  done: [],
};

export class ActionService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly actions: ActionRepository,
    private readonly teams: TeamRepository,
    private readonly positions: PositionRepository,
    private readonly people: PeopleRepository,
    private readonly audit: AuditRepository,
  ) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.actions.listByOrganization(organizationId);
  }

  async get(actor: ActorContext, organizationId: string, actionId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const action = await this.actions.getById(organizationId, actionId);
    if (!action) notFound("Action not found");
    return action;
  }

  async create(
    actor: ActorContext,
    organizationId: string,
    input: {
      title: string;
      description?: string;
      dueDate?: Date;
      blocked?: boolean;
      owner: OwnershipAssignmentInput;
      link: ActionLinkInput;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    requireOwnershipInput(input.owner);
    requireExactlyOneActionLink(input.link);
    await this.validateOwnership(organizationId, input.owner);
    await this.validateActionLink(organizationId, input.link);

    return this.actions.create(organizationId, {
      title: input.title,
      description: input.description ?? null,
      dueDate: toPgDate(input.dueDate) ?? null,
      blocked: input.blocked ?? false,
      ownerPersonId: input.owner.ownerPersonId,
      ownerPositionId: input.owner.ownerPositionId,
      teamId: input.link.teamId,
      positionId: input.link.positionId,
      personId: input.link.personId,
    });
  }

  async updateDetails(
    actor: ActorContext,
    organizationId: string,
    actionId: string,
    input: {
      title?: string;
      description?: string | null;
      dueDate?: Date | null;
      blocked?: boolean;
      owner?: OwnershipAssignmentInput;
      link?: ActionLinkInput;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const existingAction = await this.actions.getById(organizationId, actionId);
    if (!existingAction) notFound("Action not found");

    const updateInput: ActionDetailsUpdateInput = {};
    if (typeof input.title !== "undefined") updateInput.title = input.title;
    if (typeof input.description !== "undefined") {
      updateInput.description = input.description;
    }
    if (typeof input.dueDate !== "undefined") {
      updateInput.dueDate = toPgDate(input.dueDate) ?? null;
    }
    if (typeof input.blocked !== "undefined") updateInput.blocked = input.blocked;
    if (input.owner) {
      requireOwnershipInput(input.owner);
      await this.validateOwnership(organizationId, input.owner);
      updateInput.ownerPersonId = input.owner.ownerPersonId;
      updateInput.ownerPositionId = input.owner.ownerPositionId;
    }
    if (input.link) {
      requireExactlyOneActionLink(input.link);
      await this.validateActionLink(organizationId, input.link);
      updateInput.teamId = input.link.teamId;
      updateInput.positionId = input.link.positionId;
      updateInput.personId = input.link.personId;
    }

    const updated = await this.actions.updateDetails(organizationId, actionId, updateInput);
    if (!updated) notFound("Action not found");
    return updated;
  }

  async transitionStatus(
    actor: ActorContext,
    organizationId: string,
    actionId: string,
    status: "open" | "in_progress" | "done",
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const action = await this.actions.getById(organizationId, actionId);
    if (!action) notFound("Action not found");

    const allowed = ALLOWED_TRANSITIONS[action.status];
    if (!allowed.includes(status)) {
      badRequest(
        `Invalid action status transition from ${action.status} to ${status}`,
      );
    }

    const updated = await this.actions.transitionStatus(organizationId, actionId, status);
    if (!updated) notFound("Action not found");

    await this.audit.log({
      organizationId,
      actorUserId: actor.userId,
      eventType: "action_status_changed",
      entityType: "action",
      entityId: actionId,
      metadata: { from: action.status, to: status },
    });

    return updated;
  }

  async delete(actor: ActorContext, organizationId: string, actionId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const deleted = await this.actions.delete(organizationId, actionId);
    if (!deleted) notFound("Action not found");
  }

  private async validateOwnership(organizationId: string, owner: OwnershipAssignmentInput) {
    if (owner.ownerPersonId) {
      const person = await this.people.getById(organizationId, owner.ownerPersonId);
      if (!person) badRequest("ownerPersonId must belong to the same organization");
    }
    if (owner.ownerPositionId) {
      const position = await this.positions.getById(organizationId, owner.ownerPositionId);
      if (!position) badRequest("ownerPositionId must belong to the same organization");
    }
  }

  private async validateActionLink(organizationId: string, link: ActionLinkInput) {
    if (link.teamId) {
      const team = await this.teams.getById(organizationId, link.teamId);
      if (!team) badRequest("teamId must belong to the same organization");
    }
    if (link.positionId) {
      const position = await this.positions.getById(organizationId, link.positionId);
      if (!position) badRequest("positionId must belong to the same organization");
    }
    if (link.personId) {
      const person = await this.people.getById(organizationId, link.personId);
      if (!person) badRequest("personId must belong to the same organization");
    }
  }
}

export function buildActionService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);

  return new ActionService(
    access,
    new ActionRepository(),
    new TeamRepository(),
    new PositionRepository(),
    new PeopleRepository(),
    new AuditRepository(),
  );
}
