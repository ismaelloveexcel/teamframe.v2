import { conflict } from "../lib/http-error";
import type { ActorContext } from "../lib/request-context";
import { MembershipRepository, OrganizationRepository, UserRepository } from "../persistence/repositories";
import { OrganizationAccessControl } from "../access/organization-access";

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  return code === "23505";
}

export class OrganizationService {
  constructor(
    private readonly organizations: OrganizationRepository,
    private readonly users: UserRepository,
    private readonly access: OrganizationAccessControl,
  ) {}

  async list(actor: ActorContext) {
    await this.users.upsertActor(actor);
    return this.organizations.listForUser(actor.userId);
  }

  async create(actor: ActorContext, input: { name: string; slug: string }) {
    try {
      return await this.organizations.createWithOwner({
        actorUserId: actor.userId,
        actorEmail: actor.email,
        actorFullName: actor.fullName,
        name: input.name,
        slug: input.slug,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        conflict("Organization slug already exists");
      }
      throw error;
    }
  }

  async get(actor: ActorContext, organizationId: string) {
    await this.users.upsertActor(actor);
    await this.access.requireMembership(organizationId, actor.userId, "member");
    const organization = await this.organizations.getById(organizationId);
    return organization;
  }
}

export function buildOrganizationService() {
  const organizations = new OrganizationRepository();
  const users = new UserRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new OrganizationService(organizations, users, access);
}
