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

export class TeamService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly teams: TeamRepository,
    private readonly people: PeopleRepository,
    private readonly positions: PositionRepository,
    private readonly ownerships: OwnershipRepository,
    private readonly audit: AuditRepository,
  ) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.teams.listByOrganization(organizationId);
  }

  async get(actor: ActorContext, organizationId: string, teamId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const team = await this.teams.getById(organizationId, teamId);
    if (!team) notFound("Team not found");
    return team;
  }

  async create(
    actor: ActorContext,
    organizationId: string,
    input: { name: string; code?: string; parentTeamId?: string },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");

    if (input.parentTeamId) {
      const parentTeam = await this.teams.getById(organizationId, input.parentTeamId);
      if (!parentTeam) {
        badRequest("parentTeamId must belong to the same organization");
      }
    }

    return this.teams.create(organizationId, input);
  }

  async update(
    actor: ActorContext,
    organizationId: string,
    teamId: string,
    input: { name?: string; code?: string | null; parentTeamId?: string | null },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");

    if (typeof input.parentTeamId !== "undefined" && input.parentTeamId !== null) {
      if (input.parentTeamId === teamId) {
        badRequest("Team cannot parent itself");
      }
      const parentTeam = await this.teams.getById(organizationId, input.parentTeamId);
      if (!parentTeam) {
        badRequest("parentTeamId must belong to the same organization");
      }
    }

    const team = await this.teams.update(organizationId, teamId, input);
    if (!team) notFound("Team not found");
    return team;
  }

  async delete(actor: ActorContext, organizationId: string, teamId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const deleted = await this.teams.delete(organizationId, teamId);
    if (!deleted) notFound("Team not found");
  }

  async assignOwnership(
    actor: ActorContext,
    organizationId: string,
    teamId: string,
    input: OwnershipAssignmentInput,
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    requireOwnershipInput(input);

    const team = await this.teams.getById(organizationId, teamId);
    if (!team) notFound("Team not found");

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

    const ownership = await this.ownerships.assignTeamOwnership(organizationId, teamId, input);
    await this.audit.log({
      organizationId,
      actorUserId: actor.userId,
      eventType: "ownership_changed",
      entityType: "team",
      entityId: teamId,
      metadata: {
        ownerPersonId: ownership.ownerPersonId,
        ownerPositionId: ownership.ownerPositionId,
      },
    });
    return ownership;
  }
}

export function buildTeamService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);

  return new TeamService(
    access,
    new TeamRepository(),
    new PeopleRepository(),
    new PositionRepository(),
    new OwnershipRepository(),
    new AuditRepository(),
  );
}
