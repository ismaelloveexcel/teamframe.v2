import type { ActorContext } from "../lib/request-context";
import { badRequest, notFound } from "../lib/http-error";
import { OrganizationAccessControl } from "../access/organization-access";
import {
  MembershipRepository,
  OrganizationRepository,
  PeopleRepository,
  PositionRepository,
} from "../persistence/repositories";

export class PeopleService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly people: PeopleRepository,
    private readonly positions: PositionRepository,
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
    const deleted = await this.people.delete(organizationId, personId);
    if (!deleted) notFound("Person not found");
  }
}

export function buildPeopleService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);

  return new PeopleService(access, new PeopleRepository(), new PositionRepository());
}
