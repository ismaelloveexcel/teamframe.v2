import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  idempotencyRecordsTable,
  offboardingCompletionsTable,
  personPositionAssignmentsTable,
} from "@workspace/db";
import { stableHash } from "../domain/event-core";
import { OrganizationAccessControl } from "../access/organization-access";
import { badRequest } from "../lib/http-error";
import type { ActorContext } from "../lib/request-context";
import { MembershipRepository, OrganizationRepository } from "../persistence/repositories";
import { appendDomainEvent, assertIdempotencyKey, parseDateOrNow } from "./event-store-write";

export class OffboardingService {
  constructor(private readonly access: OrganizationAccessControl) {}

  async list(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return db
      .select()
      .from(offboardingCompletionsTable)
      .where(eq(offboardingCompletionsTable.organizationId, organizationId));
  }

  async complete(
    actor: ActorContext,
    organizationId: string,
    input: {
      assignmentId: string;
      completedAt?: string;
      snapshot?: Record<string, unknown>;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertIdempotencyKey(input.idempotencyKey);
    const completedAt = parseDateOrNow(input.completedAt);

    return db.transaction(async (tx) => {
      const replay = await tx
        .select({ responseBlob: idempotencyRecordsTable.responseBlob })
        .from(idempotencyRecordsTable)
        .where(
          and(
            eq(idempotencyRecordsTable.orgId, organizationId),
            eq(idempotencyRecordsTable.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (replay[0]) {
        return { ...(replay[0].responseBlob as Record<string, unknown>), replayed: true };
      }

      const [assignment] = await tx
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.id, input.assignmentId),
          ),
        )
        .limit(1);
      if (!assignment) badRequest("assignmentId must belong to organization");
      if (assignment.status !== "active") {
        badRequest("offboarding.complete requires active assignment");
      }

      const [endedAssignment] = await tx
        .update(personPositionAssignmentsTable)
        .set({
          status: "ended",
          endedAt: completedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.id, input.assignmentId),
          ),
        )
        .returning();
      if (!endedAssignment) badRequest("Failed to end assignment for offboarding");

      const completionId = randomUUID();
      const [completion] = await tx
        .insert(offboardingCompletionsTable)
        .values({
          id: completionId,
          organizationId,
          assignmentId: input.assignmentId,
          completedAt,
          snapshot: input.snapshot ?? {},
        })
        .returning();
      if (!completion) badRequest("Failed to create offboarding completion");

      // Required command boundary: assignment.ended + offboarding.completed in one transaction.
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "assignment",
        aggregateId: input.assignmentId,
        eventType: "assignment.ended",
        idempotencyKey: `${input.idempotencyKey}-end`,
        payload: {
          assignmentId: input.assignmentId,
          effectiveTo: completedAt.toISOString(),
          reason: "offboarding.complete",
        },
      });
      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "offboarding",
        aggregateId: completionId,
        eventType: "offboarding.completed",
        idempotencyKey: `${input.idempotencyKey}-complete`,
        payload: {
          offboardingId: completionId,
          assignmentId: input.assignmentId,
          completedAt: completedAt.toISOString(),
        },
      });

      const response = {
        assignmentId: input.assignmentId,
        offboardingId: completionId,
        completedAt: completedAt.toISOString(),
        replayed: false,
      };
      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "offboarding.complete",
          assignmentId: input.assignmentId,
          completedAt: completedAt.toISOString(),
          snapshot: input.snapshot ?? {},
        }),
        responseBlob: response,
      });
      return response;
    });
  }
}

export function buildOffboardingService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new OffboardingService(access);
}
