import type { ActorContext } from "../lib/request-context";
import { badRequest, notFound } from "../lib/http-error";
import { OrganizationAccessControl } from "../access/organization-access";
import {
  ActionRepository,
  MembershipRepository,
  OrganizationRepository,
  PeopleRepository,
  PersonPositionAssignmentRepository,
  PositionRepository,
} from "../persistence/repositories";

export class PeopleService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly people: PeopleRepository,
    private readonly positions: PositionRepository,
    private readonly actions: ActionRepository,
    private readonly assignments: PersonPositionAssignmentRepository,
  ) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.people.listByOrganization(organizationId);
  }

  async get(actor: ActorContext, organizationId: string, personId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const person = await this.people.getById(organizationId, personId);
    if (!person) notFound("Person not found");
    return person;
  }

  async create(
    actor: ActorContext,
    organizationId: string,
    input: {
      fullName: string;
      email?: string;
      phone?: string;
      positionId?: string;
      employmentStatus?: "active" | "on_leave" | "offboarding";
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    if (input.positionId) {
      const position = await this.positions.getById(organizationId, input.positionId);
      if (!position) badRequest("positionId must belong to the same organization");
    }
    return this.people.create(organizationId, input);
  }

  async update(
    actor: ActorContext,
    organizationId: string,
    personId: string,
    input: {
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      positionId?: string | null;
      employmentStatus?: "active" | "on_leave" | "offboarding";
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    if (typeof input.positionId !== "undefined" && input.positionId !== null) {
      const position = await this.positions.getById(organizationId, input.positionId);
      if (!position) badRequest("positionId must belong to the same organization");
    }
    const person = await this.people.update(organizationId, personId, input);
    if (!person) notFound("Person not found");
    return person;
  }

  async delete(actor: ActorContext, organizationId: string, personId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const person = await this.people.getById(organizationId, personId);
    if (!person) notFound("Person not found");

    const [hasAssignments, hasActions] = await Promise.all([
      this.assignments.hasAnyForPerson(organizationId, personId),
      this.actions.hasAnyForPerson(organizationId, personId),
    ]);

    if (hasAssignments || hasActions) {
      await this.people.update(organizationId, personId, { employmentStatus: "offboarding" });
      return;
    }

    await this.people.delete(organizationId, personId);
  }
}

export function buildPeopleService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);

  return new PeopleService(
    access,
    new PeopleRepository(),
    new PositionRepository(),
    new ActionRepository(),
    new PersonPositionAssignmentRepository(),
  );
}
