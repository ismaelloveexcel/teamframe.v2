import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  compensationRecordsTable,
  db,
  documentsTable,
  idempotencyRecordsTable,
  personPositionAssignmentsTable,
} from "@workspace/db";
import { stableHash } from "../domain/event-core";
import { OrganizationAccessControl } from "../access/organization-access";
import { badRequest } from "../lib/http-error";
import type { ActorContext } from "../lib/request-context";
import { MembershipRepository, OrganizationRepository } from "../persistence/repositories";
import { appendDomainEvent, assertIdempotencyKey, parseDateOrNow } from "./event-store-write";
import { buildProjectionBuilderService, ProjectionBuilderService } from "./projection-builder-service";

export class CompensationService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly projector: ProjectionBuilderService,
  ) {}

  async listRecords(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return db
      .select()
      .from(compensationRecordsTable)
      .where(eq(compensationRecordsTable.organizationId, organizationId));
  }

  async listCurrent(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return db
      .select()
      .from(compensationCurrentTable)
      .where(eq(compensationCurrentTable.organizationId, organizationId));
  }

  async record(
    actor: ActorContext,
    organizationId: string,
    input: {
      assignmentId: string;
      sourceDocumentId: string;
      amount: number;
      currency: string;
      effectiveFrom?: string;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertIdempotencyKey(input.idempotencyKey);

    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      badRequest("amount must be a positive integer minor-unit value");
    }
    const currency = input.currency.trim().toUpperCase();
    if (currency.length !== 3) {
      badRequest("currency must be a 3-letter ISO code");
    }

    const effectiveFrom = parseDateOrNow(input.effectiveFrom);

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

      const assignment = await tx
        .select()
        .from(personPositionAssignmentsTable)
        .where(
          and(
            eq(personPositionAssignmentsTable.organizationId, organizationId),
            eq(personPositionAssignmentsTable.id, input.assignmentId),
          ),
        )
        .limit(1);
      const sourceDocument = await tx
        .select()
        .from(documentsTable)
        .where(
          and(
            eq(documentsTable.organizationId, organizationId),
            eq(documentsTable.id, input.sourceDocumentId),
          ),
        )
        .limit(1);
      if (!assignment[0]) badRequest("assignmentId must belong to organization");
      if (!sourceDocument[0]) badRequest("sourceDocumentId must belong to organization");
      if (sourceDocument[0].assignmentId !== input.assignmentId) {
        badRequest("sourceDocumentId must belong to assignmentId");
      }

      const compensationRecordId = randomUUID();
      const [record] = await tx
        .insert(compensationRecordsTable)
        .values({
          id: compensationRecordId,
          organizationId,
          assignmentId: input.assignmentId,
          sourceDocumentId: input.sourceDocumentId,
          amount: input.amount,
          currency,
          effectiveFrom,
        })
        .returning();
      if (!record) badRequest("Failed to create compensation record");

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "compensation",
        aggregateId: compensationRecordId,
        eventType: "compensation.recorded",
        idempotencyKey: input.idempotencyKey,
        payload: {
          compensationRecordId,
          assignmentId: input.assignmentId,
          sourceDocumentId: input.sourceDocumentId,
          amount: input.amount,
          currency,
          effectiveFrom: effectiveFrom.toISOString(),
        },
      });

      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          compensationCurrent: true,
        },
      });

      const response = {
        compensationRecord: record,
        replayed: false,
      };
      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "compensation.record",
          assignmentId: input.assignmentId,
          sourceDocumentId: input.sourceDocumentId,
          amount: input.amount,
          currency,
          effectiveFrom: effectiveFrom.toISOString(),
        }),
        responseBlob: response,
      });
      return response;
    });
  }
}

export function buildCompensationService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new CompensationService(access, buildProjectionBuilderService());
}
