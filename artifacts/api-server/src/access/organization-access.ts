import { forbidden, notFound } from "../lib/http-error";
import {
  MembershipRepository,
  OrganizationRepository,
  type MembershipRole,
} from "../persistence/repositories";

function roleWeight(role: MembershipRole): number {
  if (role === "owner") return 3;
  if (role === "admin") return 2;
  return 1;
}

export class OrganizationAccessControl {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly memberships: MembershipRepository,
  ) {}

  async requireMembership(
    organizationId: string,
    actorUserId: string,
    minimumRole: MembershipRole = "member",
  ) {
    const organization = await this.organizations.getById(organizationId);
    if (!organization) {
      notFound("Organization not found");
    }

    const membership = await this.memberships.getMembership(organizationId, actorUserId);
    if (!membership) {
      forbidden("Actor is not a member of this organization");
    }

    if (roleWeight(membership.role) < roleWeight(minimumRole)) {
      forbidden("Actor lacks required organization role");
    }

    return membership;
  }
}
