import type { ActorContext } from "../lib/request-context";
import { OrganizationAccessControl } from "../access/organization-access";
import {
  MembershipRepository,
  OrganizationRepository,
  OwnershipRepository,
} from "../persistence/repositories";

export class OwnershipService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly ownerships: OwnershipRepository,
  ) {}

  async listTeamOwnerships(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.ownerships.listTeamOwnerships(organizationId);
  }

  async listPositionOwnerships(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return this.ownerships.listPositionOwnerships(organizationId);
  }
}

export function buildOwnershipService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new OwnershipService(access, new OwnershipRepository());
}
