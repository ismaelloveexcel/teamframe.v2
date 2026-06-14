import type { ActorContext } from "../lib/request-context";
import { badRequest, notFound } from "../lib/http-error";
import { OrganizationAccessControl } from "../access/organization-access";
import {
  AuditRepository,
  MembershipRepository,
  OrganizationRepository,
  PeopleRepository,
  PolicyRepository,
  PositionRepository,
  TeamRepository,
  type OwnershipAssignmentInput,
} from "../persistence/repositories";
import { requireOwnershipInput, requirePolicyScopeShape } from "./helpers";

type PolicyScope = "organization" | "team" | "position";

export class PolicyService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly policies: PolicyRepository,
    private readonly teams: TeamRepository,
    private readonly positions: PositionRepository,
    private readonly people: PeopleRepository,
    private readonly audit: AuditRepository,
  ) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.policies.listByOrganization(organizationId);
  }

  async get(actor: ActorContext, organizationId: string, policyId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const policy = await this.policies.getById(organizationId, policyId);
    if (!policy) notFound("Policy not found");
    return policy;
  }

  async create(
    actor: ActorContext,
    organizationId: string,
    input: {
      title: string;
      body: string;
      scope: PolicyScope;
      teamId?: string;
      positionId?: string;
      owner: OwnershipAssignmentInput;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    requireOwnershipInput(input.owner);
    requirePolicyScopeShape(input.scope, input.teamId ?? null, input.positionId ?? null);
    await this.validateOwnership(organizationId, input.owner);
    await this.validateScopeReferences(organizationId, input.teamId ?? null, input.positionId ?? null);

    return this.policies.create(organizationId, {
      title: input.title,
      body: input.body,
      scope: input.scope,
      teamId: input.teamId ?? null,
      positionId: input.positionId ?? null,
      ownerPersonId: input.owner.ownerPersonId,
      ownerPositionId: input.owner.ownerPositionId,
    });
  }

  async updateDetails(
    actor: ActorContext,
    organizationId: string,
    policyId: string,
    input: {
      title?: string;
      body?: string;
      owner?: OwnershipAssignmentInput;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const existingPolicy = await this.policies.getById(organizationId, policyId);
    if (!existingPolicy) notFound("Policy not found");

    const updateInput: {
      title?: string;
      body?: string;
      ownerPersonId?: string | null;
      ownerPositionId?: string | null;
    } = {};
    if (typeof input.title !== "undefined") updateInput.title = input.title;
    if (typeof input.body !== "undefined") updateInput.body = input.body;
    if (input.owner) {
      requireOwnershipInput(input.owner);
      await this.validateOwnership(organizationId, input.owner);
      updateInput.ownerPersonId = input.owner.ownerPersonId;
      updateInput.ownerPositionId = input.owner.ownerPositionId;
    }

    const updated = await this.policies.updateDetails(organizationId, policyId, updateInput);
    if (!updated) notFound("Policy not found");
    return updated;
  }

  async attachScope(
    actor: ActorContext,
    organizationId: string,
    policyId: string,
    input: { scope: PolicyScope; teamId?: string | null; positionId?: string | null },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const existingPolicy = await this.policies.getById(organizationId, policyId);
    if (!existingPolicy) notFound("Policy not found");

    const teamId = input.teamId ?? null;
    const positionId = input.positionId ?? null;
    requirePolicyScopeShape(input.scope, teamId, positionId);
    await this.validateScopeReferences(organizationId, teamId, positionId);

    const updated = await this.policies.updateScope(organizationId, policyId, {
      scope: input.scope,
      teamId,
      positionId,
    });
    if (!updated) notFound("Policy not found");

    await this.audit.log({
      organizationId,
      actorUserId: actor.userId,
      eventType: "policy_scope_changed",
      entityType: "policy",
      entityId: policyId,
      metadata: {
        fromScope: existingPolicy.scope,
        toScope: input.scope,
        teamId,
        positionId,
      },
    });

    return updated;
  }

  async delete(actor: ActorContext, organizationId: string, policyId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    const deleted = await this.policies.delete(organizationId, policyId);
    if (!deleted) notFound("Policy not found");
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

  private async validateScopeReferences(
    organizationId: string,
    teamId: string | null,
    positionId: string | null,
  ) {
    if (teamId) {
      const team = await this.teams.getById(organizationId, teamId);
      if (!team) badRequest("teamId must belong to the same organization");
    }
    if (positionId) {
      const position = await this.positions.getById(organizationId, positionId);
      if (!position) badRequest("positionId must belong to the same organization");
    }
  }
}

export function buildPolicyService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);

  return new PolicyService(
    access,
    new PolicyRepository(),
    new TeamRepository(),
    new PositionRepository(),
    new PeopleRepository(),
    new AuditRepository(),
  );
}
