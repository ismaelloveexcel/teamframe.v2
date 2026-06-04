import type { ActorContext } from "../lib/request-context";
import { badRequest, notFound } from "../lib/http-error";
import { OrganizationAccessControl } from "../access/organization-access";
import {
  ActionRepository,
  AuditRepository,
  MembershipRepository,
  OrganizationRepository,
  PeopleRepository,
  PersonPositionAssignmentRepository,
  PositionRepository,
  TeamRepository,
  type ActionDetailsUpdateInput,
  type ActionLinkInput,
  type OwnershipAssignmentInput,
} from "../persistence/repositories";
import { requireExactlyOneActionLink, requireOwnershipInput, toPgDate } from "./helpers";

const ALLOWED_TRANSITIONS: Record<
  "open" | "in_progress" | "done",
  Array<"open" | "in_progress" | "done">
> = {
  open: ["in_progress"],
  in_progress: ["done"],
  done: [],
};

interface ResolvedActionOwnershipContext {
  assignmentId: string | null;
  personId: string | null;
  positionId: string | null;
}

export class ActionService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly actions: ActionRepository,
    private readonly teams: TeamRepository,
    private readonly positions: PositionRepository,
    private readonly people: PeopleRepository,
    private readonly assignments: PersonPositionAssignmentRepository,
    private readonly audit: AuditRepository,
  ) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.actions.listByOrganization(organizationId);
  }

  async listForPosition(actor: ActorContext, organizationId: string, positionId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const position = await this.positions.getById(organizationId, positionId);
    if (!position) notFound("Position not found");
    return this.actions.listByPositionContext(organizationId, positionId);
  }

  async listForPerson(actor: ActorContext, organizationId: string, personId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const person = await this.people.getById(organizationId, personId);
    if (!person) notFound("Person not found");
    return this.actions.listByPersonContext(organizationId, personId);
  }

  async getPositionExecutionSummary(actor: ActorContext, organizationId: string, positionId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const position = await this.positions.getById(organizationId, positionId);
    if (!position) notFound("Position not found");
    return this.actions.getPositionExecutionSummary(organizationId, positionId);
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
      dueDate?: Date | string;
      blocked?: boolean;
      owner?: OwnershipAssignmentInput;
      link?: ActionLinkInput;
      assignmentId?: string;
      personId?: string;
      positionId?: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");

    const ownership = await this.resolveActionOwnershipContext(organizationId, {
      assignmentId: input.assignmentId,
      personId: input.personId,
      positionId: input.positionId,
      owner: input.owner,
    });

    this.requireActionOwnershipPath(ownership);

    const normalizedLink = await this.resolveActionLinkContext(organizationId, {
      link: input.link,
      ownership,
      existing: null,
    });

    return this.actions.create(organizationId, {
      title: input.title,
      description: input.description ?? null,
      dueDate: toPgDate(input.dueDate) ?? null,
      blocked: input.blocked ?? false,
      ownerPersonId: ownership.personId,
      ownerPositionId: ownership.positionId,
      assignmentId: ownership.assignmentId,
      teamId: normalizedLink.teamId,
      positionId: normalizedLink.positionId,
      personId: normalizedLink.personId,
    });
  }

  async updateDetails(
    actor: ActorContext,
    organizationId: string,
    actionId: string,
    input: {
      title?: string;
      description?: string | null;
      dueDate?: Date | string | null;
      blocked?: boolean;
      owner?: OwnershipAssignmentInput;
      link?: ActionLinkInput;
      assignmentId?: string | null;
      personId?: string | null;
      positionId?: string | null;
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

    const hasResolverInput =
      typeof input.assignmentId !== "undefined" ||
      typeof input.personId !== "undefined" ||
      typeof input.positionId !== "undefined" ||
      typeof input.owner !== "undefined";

    if (hasResolverInput) {
      // Explicit null assignment update keeps existing owner path untouched.
      if (
        input.assignmentId === null &&
        typeof input.personId === "undefined" &&
        typeof input.positionId === "undefined" &&
        typeof input.owner === "undefined"
      ) {
        updateInput.assignmentId = null;
      } else {
        const ownership = await this.resolveActionOwnershipContext(organizationId, {
          assignmentId:
            typeof input.assignmentId === "undefined" ? undefined : (input.assignmentId ?? undefined),
          personId: typeof input.personId === "undefined" ? undefined : (input.personId ?? undefined),
          positionId:
            typeof input.positionId === "undefined" ? undefined : (input.positionId ?? undefined),
          owner: input.owner,
        });

        this.requireActionOwnershipPath(ownership);
        updateInput.ownerPersonId = ownership.personId;
        updateInput.ownerPositionId = ownership.positionId;
        updateInput.assignmentId = ownership.assignmentId;
      }
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
      badRequest(`Invalid action status transition from ${action.status} to ${status}`);
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

  private async resolveActionOwnershipContext(
    organizationId: string,
    input: {
      assignmentId?: string;
      personId?: string;
      positionId?: string;
      owner?: OwnershipAssignmentInput;
    },
  ): Promise<ResolvedActionOwnershipContext> {
    if (input.assignmentId) {
      const assignment = await this.assignments.getById(organizationId, input.assignmentId);
      if (!assignment) badRequest("assignmentId must belong to the same organization");
      return {
        assignmentId: assignment.id,
        personId: assignment.personId,
        positionId: assignment.positionId,
      };
    }

    if (input.personId) {
      const person = await this.people.getById(organizationId, input.personId);
      if (!person) badRequest("personId must belong to the same organization");

      const activeAssignment = await this.assignments.getActiveByPersonId(organizationId, input.personId);
      if (activeAssignment) {
        return {
          assignmentId: activeAssignment.id,
          personId: activeAssignment.personId,
          positionId: activeAssignment.positionId,
        };
      }

      return {
        assignmentId: null,
        personId: input.personId,
        positionId: null,
      };
    }

    if (input.positionId) {
      const position = await this.positions.getById(organizationId, input.positionId);
      if (!position) badRequest("positionId must belong to the same organization");
      return {
        assignmentId: null,
        personId: null,
        positionId: input.positionId,
      };
    }

    if (!input.owner) {
      return {
        assignmentId: null,
        personId: null,
        positionId: null,
      };
    }

    requireOwnershipInput(input.owner);
    await this.validateOwnership(organizationId, input.owner);

    return {
      assignmentId: null,
      personId: input.owner.ownerPersonId,
      positionId: input.owner.ownerPositionId,
    };
  }

  private async resolveActionLinkContext(
    organizationId: string,
    input: {
      link?: ActionLinkInput;
      ownership: ResolvedActionOwnershipContext;
      existing: Pick<ActionLinkInput, "teamId" | "positionId" | "personId"> | null;
    },
  ): Promise<ActionLinkInput> {
    if (input.link) {
      requireExactlyOneActionLink(input.link);
      await this.validateActionLink(organizationId, input.link);
      return input.link;
    }

    if (input.existing) {
      return {
        teamId: input.existing.teamId,
        positionId: input.existing.positionId,
        personId: input.existing.personId,
      };
    }

    if (input.ownership.positionId) {
      return {
        teamId: null,
        positionId: input.ownership.positionId,
        personId: null,
      };
    }

    if (input.ownership.personId) {
      return {
        teamId: null,
        positionId: null,
        personId: input.ownership.personId,
      };
    }

    badRequest("Action link must target exactly one of teamId, positionId, or personId");
  }

  private requireActionOwnershipPath(input: ResolvedActionOwnershipContext) {
    if (!input.assignmentId && !input.personId && !input.positionId) {
      badRequest("Action must resolve assignmentId, ownerPersonId, or ownerPositionId");
    }
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
    new PersonPositionAssignmentRepository(),
    new AuditRepository(),
  );
}
