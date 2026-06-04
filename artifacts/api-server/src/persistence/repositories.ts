import { and, eq } from "drizzle-orm";
import {
  actionsTable,
  auditEventsTable,
  db,
  organizationMembershipsTable,
  organizationsTable,
  peopleTable,
  policiesTable,
  positionsTable,
  positionOwnershipsTable,
  teamsTable,
  teamOwnershipsTable,
  usersTable,
  type Action,
  type Policy,
  type Position,
  type Team,
} from "@workspace/db";

export type MembershipRole = "owner" | "admin" | "member";

export interface OwnershipAssignmentInput {
  ownerPersonId: string | null;
  ownerPositionId: string | null;
  responsibilityContext: string;
}

export interface ActionLinkInput {
  teamId: string | null;
  positionId: string | null;
  personId: string | null;
}

export interface ActionCreateInput {
  title: string;
  description: string | null;
  dueDate: string | null;
  blocked: boolean;
  ownerPersonId: string | null;
  ownerPositionId: string | null;
  teamId: string | null;
  positionId: string | null;
  personId: string | null;
}

export interface ActionDetailsUpdateInput {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
  blocked?: boolean;
  ownerPersonId?: string | null;
  ownerPositionId?: string | null;
  teamId?: string | null;
  positionId?: string | null;
  personId?: string | null;
}

export interface PolicyCreateInput {
  title: string;
  body: string;
  scope: "organization" | "team" | "position";
  teamId: string | null;
  positionId: string | null;
  ownerPersonId: string | null;
  ownerPositionId: string | null;
}

export interface PolicyDetailsUpdateInput {
  title?: string;
  body?: string;
  ownerPersonId?: string | null;
  ownerPositionId?: string | null;
}

export interface PolicyScopeUpdateInput {
  scope: "organization" | "team" | "position";
  teamId: string | null;
  positionId: string | null;
}

export class OrganizationRepository {
  async listForUser(userId: string) {
    return db
      .select({
        id: organizationsTable.id,
        name: organizationsTable.name,
        slug: organizationsTable.slug,
        createdAt: organizationsTable.createdAt,
        updatedAt: organizationsTable.updatedAt,
      })
      .from(organizationsTable)
      .innerJoin(
        organizationMembershipsTable,
        and(
          eq(organizationMembershipsTable.organizationId, organizationsTable.id),
          eq(organizationMembershipsTable.userId, userId),
        ),
      );
  }

  async getById(organizationId: string) {
    const [organization] = await db
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, organizationId))
      .limit(1);
    return organization ?? null;
  }

  async createWithOwner(input: {
    actorUserId: string;
    actorEmail: string;
    actorFullName: string | null;
    name: string;
    slug: string;
  }) {
    return db.transaction(async (tx) => {
      await tx
        .insert(usersTable)
        .values({
          id: input.actorUserId,
          email: input.actorEmail,
          fullName: input.actorFullName,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: usersTable.id,
          set: {
            email: input.actorEmail,
            fullName: input.actorFullName,
            updatedAt: new Date(),
          },
        });

      const [organization] = await tx
        .insert(organizationsTable)
        .values({
          name: input.name,
          slug: input.slug,
          updatedAt: new Date(),
        })
        .returning();

      await tx.insert(organizationMembershipsTable).values({
        organizationId: organization.id,
        userId: input.actorUserId,
        role: "owner",
      });

      return organization;
    });
  }
}

export class UserRepository {
  async upsertActor(input: {
    userId: string;
    email: string;
    fullName: string | null;
  }) {
    const [user] = await db
      .insert(usersTable)
      .values({
        id: input.userId,
        email: input.email,
        fullName: input.fullName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email: input.email,
          fullName: input.fullName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return user;
  }
}

export class MembershipRepository {
  async getMembership(organizationId: string, userId: string) {
    const [membership] = await db
      .select()
      .from(organizationMembershipsTable)
      .where(
        and(
          eq(organizationMembershipsTable.organizationId, organizationId),
          eq(organizationMembershipsTable.userId, userId),
        ),
      )
      .limit(1);
    return membership ?? null;
  }
}

export class TeamRepository {
  async listByOrganization(organizationId: string) {
    return db.select().from(teamsTable).where(eq(teamsTable.organizationId, organizationId));
  }

  async getById(organizationId: string, teamId: string) {
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.organizationId, organizationId), eq(teamsTable.id, teamId)))
      .limit(1);
    return team ?? null;
  }

  async create(organizationId: string, input: { name: string; code?: string; parentTeamId?: string }) {
    const [team] = await db
      .insert(teamsTable)
      .values({
        organizationId,
        name: input.name,
        code: input.code ?? null,
        parentTeamId: input.parentTeamId ?? null,
        updatedAt: new Date(),
      })
      .returning();
    return team;
  }

  async update(
    organizationId: string,
    teamId: string,
    input: { name?: string; code?: string | null; parentTeamId?: string | null },
  ) {
    const setValues: Partial<typeof teamsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof input.name !== "undefined") setValues.name = input.name;
    if (typeof input.code !== "undefined") setValues.code = input.code;
    if (typeof input.parentTeamId !== "undefined") {
      setValues.parentTeamId = input.parentTeamId;
    }

    const [team] = await db
      .update(teamsTable)
      .set(setValues)
      .where(and(eq(teamsTable.organizationId, organizationId), eq(teamsTable.id, teamId)))
      .returning();
    return team ?? null;
  }

  async delete(organizationId: string, teamId: string) {
    const [deleted] = await db
      .delete(teamsTable)
      .where(and(eq(teamsTable.organizationId, organizationId), eq(teamsTable.id, teamId)))
      .returning({ id: teamsTable.id });
    return deleted ?? null;
  }
}

export class PositionRepository {
  async listByOrganization(organizationId: string) {
    return db
      .select()
      .from(positionsTable)
      .where(eq(positionsTable.organizationId, organizationId));
  }

  async getById(organizationId: string, positionId: string) {
    const [position] = await db
      .select()
      .from(positionsTable)
      .where(
        and(eq(positionsTable.organizationId, organizationId), eq(positionsTable.id, positionId)),
      )
      .limit(1);
    return position ?? null;
  }

  async create(
    organizationId: string,
    input: {
      teamId?: string;
      title: string;
      reportsToPositionId?: string;
      lifecycleStatus?: "filled" | "vacant" | "frozen";
    },
  ) {
    const [position] = await db
      .insert(positionsTable)
      .values({
        organizationId,
        teamId: input.teamId ?? null,
        title: input.title,
        reportsToPositionId: input.reportsToPositionId ?? null,
        lifecycleStatus: input.lifecycleStatus ?? "vacant",
        updatedAt: new Date(),
      })
      .returning();
    return position;
  }

  async update(
    organizationId: string,
    positionId: string,
    input: {
      teamId?: string | null;
      title?: string;
      reportsToPositionId?: string | null;
      lifecycleStatus?: "filled" | "vacant" | "frozen";
    },
  ) {
    const setValues: Partial<typeof positionsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof input.teamId !== "undefined") setValues.teamId = input.teamId;
    if (typeof input.title !== "undefined") setValues.title = input.title;
    if (typeof input.reportsToPositionId !== "undefined") {
      setValues.reportsToPositionId = input.reportsToPositionId;
    }
    if (typeof input.lifecycleStatus !== "undefined") {
      setValues.lifecycleStatus = input.lifecycleStatus;
    }

    const [position] = await db
      .update(positionsTable)
      .set(setValues)
      .where(
        and(eq(positionsTable.organizationId, organizationId), eq(positionsTable.id, positionId)),
      )
      .returning();
    return position ?? null;
  }

  async delete(organizationId: string, positionId: string) {
    const [deleted] = await db
      .delete(positionsTable)
      .where(
        and(eq(positionsTable.organizationId, organizationId), eq(positionsTable.id, positionId)),
      )
      .returning({ id: positionsTable.id });
    return deleted ?? null;
  }
}

export class PeopleRepository {
  async listByOrganization(organizationId: string) {
    return db.select().from(peopleTable).where(eq(peopleTable.organizationId, organizationId));
  }

  async getById(organizationId: string, personId: string) {
    const [person] = await db
      .select()
      .from(peopleTable)
      .where(and(eq(peopleTable.organizationId, organizationId), eq(peopleTable.id, personId)))
      .limit(1);
    return person ?? null;
  }

  async create(
    organizationId: string,
    input: {
      fullName: string;
      email?: string;
      phone?: string;
      positionId?: string;
      employmentStatus?: "active" | "on_leave" | "offboarding";
    },
  ) {
    const [person] = await db
      .insert(peopleTable)
      .values({
        organizationId,
        fullName: input.fullName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        positionId: input.positionId ?? null,
        employmentStatus: input.employmentStatus ?? "active",
        updatedAt: new Date(),
      })
      .returning();
    return person;
  }

  async update(
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
    const setValues: Partial<typeof peopleTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof input.fullName !== "undefined") setValues.fullName = input.fullName;
    if (typeof input.email !== "undefined") setValues.email = input.email;
    if (typeof input.phone !== "undefined") setValues.phone = input.phone;
    if (typeof input.positionId !== "undefined") setValues.positionId = input.positionId;
    if (typeof input.employmentStatus !== "undefined") {
      setValues.employmentStatus = input.employmentStatus;
    }

    const [person] = await db
      .update(peopleTable)
      .set(setValues)
      .where(and(eq(peopleTable.organizationId, organizationId), eq(peopleTable.id, personId)))
      .returning();
    return person ?? null;
  }

  async delete(organizationId: string, personId: string) {
    const [deleted] = await db
      .delete(peopleTable)
      .where(and(eq(peopleTable.organizationId, organizationId), eq(peopleTable.id, personId)))
      .returning({ id: peopleTable.id });
    return deleted ?? null;
  }
}

export class OwnershipRepository {
  async assignTeamOwnership(
    organizationId: string,
    teamId: string,
    input: OwnershipAssignmentInput,
  ) {
    const [ownership] = await db
      .insert(teamOwnershipsTable)
      .values({
        organizationId,
        teamId,
        ownerPersonId: input.ownerPersonId,
        ownerPositionId: input.ownerPositionId,
        responsibilityContext: input.responsibilityContext,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: teamOwnershipsTable.teamId,
        set: {
          ownerPersonId: input.ownerPersonId,
          ownerPositionId: input.ownerPositionId,
          responsibilityContext: input.responsibilityContext,
          updatedAt: new Date(),
        },
      })
      .returning();
    return ownership;
  }

  async assignPositionOwnership(
    organizationId: string,
    positionId: string,
    input: OwnershipAssignmentInput,
  ) {
    const [ownership] = await db
      .insert(positionOwnershipsTable)
      .values({
        organizationId,
        positionId,
        ownerPersonId: input.ownerPersonId,
        ownerPositionId: input.ownerPositionId,
        responsibilityContext: input.responsibilityContext,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: positionOwnershipsTable.positionId,
        set: {
          ownerPersonId: input.ownerPersonId,
          ownerPositionId: input.ownerPositionId,
          responsibilityContext: input.responsibilityContext,
          updatedAt: new Date(),
        },
      })
      .returning();
    return ownership;
  }
}

export class ActionRepository {
  async listByOrganization(organizationId: string) {
    return db.select().from(actionsTable).where(eq(actionsTable.organizationId, organizationId));
  }

  async getById(organizationId: string, actionId: string) {
    const [action] = await db
      .select()
      .from(actionsTable)
      .where(and(eq(actionsTable.organizationId, organizationId), eq(actionsTable.id, actionId)))
      .limit(1);
    return action ?? null;
  }

  async create(organizationId: string, input: ActionCreateInput) {
    const [action] = await db
      .insert(actionsTable)
      .values({
        organizationId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        blocked: input.blocked,
        ownerPersonId: input.ownerPersonId,
        ownerPositionId: input.ownerPositionId,
        teamId: input.teamId,
        positionId: input.positionId,
        personId: input.personId,
        status: "open",
        updatedAt: new Date(),
      })
      .returning();
    return action;
  }

  async updateDetails(organizationId: string, actionId: string, input: ActionDetailsUpdateInput) {
    const setValues: Partial<typeof actionsTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof input.title !== "undefined") setValues.title = input.title;
    if (typeof input.description !== "undefined") setValues.description = input.description;
    if (typeof input.dueDate !== "undefined") setValues.dueDate = input.dueDate;
    if (typeof input.blocked !== "undefined") setValues.blocked = input.blocked;
    if (typeof input.ownerPersonId !== "undefined") setValues.ownerPersonId = input.ownerPersonId;
    if (typeof input.ownerPositionId !== "undefined") {
      setValues.ownerPositionId = input.ownerPositionId;
    }
    if (typeof input.teamId !== "undefined") setValues.teamId = input.teamId;
    if (typeof input.positionId !== "undefined") setValues.positionId = input.positionId;
    if (typeof input.personId !== "undefined") setValues.personId = input.personId;

    const [action] = await db
      .update(actionsTable)
      .set(setValues)
      .where(and(eq(actionsTable.organizationId, organizationId), eq(actionsTable.id, actionId)))
      .returning();
    return action ?? null;
  }

  async transitionStatus(
    organizationId: string,
    actionId: string,
    status: "open" | "in_progress" | "done",
  ) {
    const [action] = await db
      .update(actionsTable)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(actionsTable.organizationId, organizationId), eq(actionsTable.id, actionId)))
      .returning();
    return action ?? null;
  }

  async delete(organizationId: string, actionId: string) {
    const [deleted] = await db
      .delete(actionsTable)
      .where(and(eq(actionsTable.organizationId, organizationId), eq(actionsTable.id, actionId)))
      .returning({ id: actionsTable.id });
    return deleted ?? null;
  }
}

export class PolicyRepository {
  async listByOrganization(organizationId: string) {
    return db.select().from(policiesTable).where(eq(policiesTable.organizationId, organizationId));
  }

  async getById(organizationId: string, policyId: string) {
    const [policy] = await db
      .select()
      .from(policiesTable)
      .where(and(eq(policiesTable.organizationId, organizationId), eq(policiesTable.id, policyId)))
      .limit(1);
    return policy ?? null;
  }

  async create(organizationId: string, input: PolicyCreateInput) {
    const [policy] = await db
      .insert(policiesTable)
      .values({
        organizationId,
        title: input.title,
        body: input.body,
        scope: input.scope,
        teamId: input.teamId,
        positionId: input.positionId,
        ownerPersonId: input.ownerPersonId,
        ownerPositionId: input.ownerPositionId,
        updatedAt: new Date(),
      })
      .returning();
    return policy;
  }

  async updateDetails(
    organizationId: string,
    policyId: string,
    input: PolicyDetailsUpdateInput,
  ) {
    const setValues: Partial<typeof policiesTable.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (typeof input.title !== "undefined") setValues.title = input.title;
    if (typeof input.body !== "undefined") setValues.body = input.body;
    if (typeof input.ownerPersonId !== "undefined") setValues.ownerPersonId = input.ownerPersonId;
    if (typeof input.ownerPositionId !== "undefined") {
      setValues.ownerPositionId = input.ownerPositionId;
    }

    const [policy] = await db
      .update(policiesTable)
      .set(setValues)
      .where(and(eq(policiesTable.organizationId, organizationId), eq(policiesTable.id, policyId)))
      .returning();
    return policy ?? null;
  }

  async updateScope(organizationId: string, policyId: string, input: PolicyScopeUpdateInput) {
    const [policy] = await db
      .update(policiesTable)
      .set({
        scope: input.scope,
        teamId: input.teamId,
        positionId: input.positionId,
        updatedAt: new Date(),
      })
      .where(and(eq(policiesTable.organizationId, organizationId), eq(policiesTable.id, policyId)))
      .returning();
    return policy ?? null;
  }

  async delete(organizationId: string, policyId: string) {
    const [deleted] = await db
      .delete(policiesTable)
      .where(and(eq(policiesTable.organizationId, organizationId), eq(policiesTable.id, policyId)))
      .returning({ id: policiesTable.id });
    return deleted ?? null;
  }
}

export interface AuditEventInput {
  organizationId: string;
  actorUserId: string;
  eventType: "ownership_changed" | "action_status_changed" | "policy_scope_changed";
  entityType: "team" | "position" | "action" | "policy";
  entityId: string;
  metadata?: Record<string, unknown>;
}

export class AuditRepository {
  async log(input: AuditEventInput) {
    await db.insert(auditEventsTable).values({
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ?? null,
    });
  }
}

export interface StructuralLookupRepository {
  getTeamById(organizationId: string, teamId: string): Promise<Team | null>;
  getPositionById(organizationId: string, positionId: string): Promise<Position | null>;
  getPersonById(organizationId: string, personId: string): Promise<typeof peopleTable.$inferSelect | null>;
}

export type ActionRecord = Action;
export type PolicyRecord = Policy;
