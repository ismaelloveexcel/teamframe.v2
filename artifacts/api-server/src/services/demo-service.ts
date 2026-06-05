import { OrganizationAccessControl } from "../access/organization-access";
import type { ActorContext } from "../lib/request-context";
import { badRequest } from "../lib/http-error";
import { MembershipRepository, OrganizationRepository } from "../persistence/repositories";

export class DemoService {
  constructor(private readonly access: OrganizationAccessControl) {}

  async resetOrganization(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    badRequest("Demo seed/reset paths are disabled in deterministic mode");
  }
}

export function buildDemoService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new DemoService(access);
}
