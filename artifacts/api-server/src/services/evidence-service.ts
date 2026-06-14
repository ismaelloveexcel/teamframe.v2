import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  documentsTable,
  evidenceRequirementProfilesTable,
  evidenceRequirementsTable,
  evidenceStatusByAssignmentTable,
  evidenceStatusByPositionTable,
  idempotencyRecordsTable,
  positionRequirementOverridesTable,
} from "@workspace/db";
import { type DocumentLifecycleState } from "../domain/aggregates/evidence";
import { stableHash } from "../domain/event-core";
import { OrganizationAccessControl } from "../access/organization-access";
import { badRequest, notFound } from "../lib/http-error";
import type { ActorContext } from "../lib/request-context";
import {
  MembershipRepository,
  OrganizationRepository,
  PersonPositionAssignmentRepository,
  PositionRepository,
} from "../persistence/repositories";
import { appendDomainEvent, assertIdempotencyKey, parseDateOrNow } from "./event-store-write";
import { buildProjectionBuilderService, ProjectionBuilderService } from "./projection-builder-service";

type RequiredInput = {
  idempotencyKey: string;
};

type RequirementInput = {
  requirementKey: string;
  displayName: string;
  isRequired?: boolean;
};

function validateRequirementKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  if (!normalized) badRequest("requirementKey is required");
  return normalized;
}

function validateRequirements(requirements: RequirementInput[]): RequirementInput[] {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    badRequest("requirements must contain at least one requirement");
  }
  const seen = new Set<string>();
  return requirements.map((requirement) => {
    const requirementKey = validateRequirementKey(requirement.requirementKey);
    if (seen.has(requirementKey)) badRequest(`duplicate requirementKey: ${requirementKey}`);
    seen.add(requirementKey);
    return {
      requirementKey,
      displayName: requirement.displayName.trim(),
      isRequired: requirement.isRequired ?? true,
    };
  });
}

function transitionEventType(state: DocumentLifecycleState): string {
  if (state === "signed") return "document.signed";
  if (state === "expired") return "document.expired";
  return "document.revoked";
}

function assertAllowedDocumentTransition(
  from: DocumentLifecycleState,
  to: DocumentLifecycleState,
): void {
  const allowed: Record<DocumentLifecycleState, DocumentLifecycleState[]> = {
    uploaded: ["signed", "revoked"],
    signed: ["expired", "revoked"],
    expired: [],
    revoked: [],
  };
  if (!allowed[from].includes(to)) {
    badRequest(`Invalid document transition: ${from} -> ${to}`);
  }
}

export class EvidenceService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly positions: PositionRepository,
    private readonly assignments: PersonPositionAssignmentRepository,
    private readonly projector: ProjectionBuilderService,
  ) {}

  async listAssignmentStatuses(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return db
      .select()
      .from(evidenceStatusByAssignmentTable)
      .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId));
  }

  async listPositionStatuses(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "member");
    return db
      .select()
      .from(evidenceStatusByPositionTable)
      .where(eq(evidenceStatusByPositionTable.organizationId, organizationId));
  }

  async upsertRequirementProfile(
    actor: ActorContext,
    organizationId: string,
    input: {
      positionId: string;
      profileName: string;
      requirements: RequirementInput[];
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertIdempotencyKey(input.idempotencyKey);

    const position = await this.positions.getById(organizationId, input.positionId);
    if (!position) badRequest("positionId must belong to the same organization");
    const requirements = validateRequirements(input.requirements);

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

      let profileId = randomUUID();
      const [existingProfile] = await tx
        .select({ id: evidenceRequirementProfilesTable.id })
        .from(evidenceRequirementProfilesTable)
        .where(
          and(
            eq(evidenceRequirementProfilesTable.organizationId, organizationId),
            eq(evidenceRequirementProfilesTable.positionId, input.positionId),
          ),
        )
        .limit(1);
      if (existingProfile) {
        profileId = existingProfile.id as typeof profileId;
        await tx
          .update(evidenceRequirementProfilesTable)
          .set({
            profileName: input.profileName.trim(),
            updatedAt: new Date(),
          })
          .where(eq(evidenceRequirementProfilesTable.id, existingProfile.id));
        await tx
          .delete(evidenceRequirementsTable)
          .where(eq(evidenceRequirementsTable.profileId, existingProfile.id));
      } else {
        await tx.insert(evidenceRequirementProfilesTable).values({
          id: profileId,
          organizationId,
          positionId: input.positionId,
          profileName: input.profileName.trim(),
          updatedAt: new Date(),
        });
      }

      await tx.insert(evidenceRequirementsTable).values(
        requirements.map((requirement) => ({
          id: randomUUID(),
          organizationId,
          profileId,
          requirementKey: requirement.requirementKey,
          displayName: requirement.displayName,
          isRequired: requirement.isRequired ?? true,
          updatedAt: new Date(),
        })),
      );

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "position",
        aggregateId: input.positionId,
        eventType: "evidence.profile.upserted",
        idempotencyKey: input.idempotencyKey,
        payload: {
          profileId,
          positionId: input.positionId,
          profileName: input.profileName.trim(),
          requirements: requirements.map((requirement) => ({
            requirementKey: requirement.requirementKey,
            displayName: requirement.displayName,
            isRequired: requirement.isRequired ?? true,
          })),
        },
      });

      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          evidence: true,
        },
      });

      const response = {
        profileId,
        positionId: input.positionId,
        requirementCount: requirements.length,
        replayed: false,
      };
      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "evidence.profile.upsert",
          positionId: input.positionId,
          requirements,
        }),
        responseBlob: response,
      });
      return response;
    });
  }

  async setRequirementOverride(
    actor: ActorContext,
    organizationId: string,
    input: {
      positionId: string;
      requirementKey: string;
      isRequired: boolean;
      reason?: string;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertIdempotencyKey(input.idempotencyKey);
    const position = await this.positions.getById(organizationId, input.positionId);
    if (!position) badRequest("positionId must belong to the same organization");
    const requirementKey = validateRequirementKey(input.requirementKey);

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

      await tx
        .insert(positionRequirementOverridesTable)
        .values({
          id: randomUUID(),
          organizationId,
          positionId: input.positionId,
          requirementKey,
          isRequired: input.isRequired,
          reason: input.reason?.trim() ?? "",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            positionRequirementOverridesTable.organizationId,
            positionRequirementOverridesTable.positionId,
            positionRequirementOverridesTable.requirementKey,
          ],
          set: {
            isRequired: input.isRequired,
            reason: input.reason?.trim() ?? "",
            updatedAt: new Date(),
          },
        });

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "position",
        aggregateId: input.positionId,
        eventType: "evidence.override.set",
        idempotencyKey: input.idempotencyKey,
        payload: {
          positionId: input.positionId,
          requirementKey,
          isRequired: input.isRequired,
          reason: input.reason?.trim() ?? "",
        },
      });

      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          evidence: true,
        },
      });

      const response = {
        positionId: input.positionId,
        requirementKey,
        isRequired: input.isRequired,
        replayed: false,
      };
      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "evidence.override.set",
          positionId: input.positionId,
          requirementKey,
          isRequired: input.isRequired,
        }),
        responseBlob: response,
      });
      return response;
    });
  }

  async uploadDocument(
    actor: ActorContext,
    organizationId: string,
    input: {
      assignmentId: string;
      requirementKey: string;
      sourceDocumentRef: string;
      uploadedAt?: string;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertIdempotencyKey(input.idempotencyKey);
    const requirementKey = validateRequirementKey(input.requirementKey);
    const assignment = await this.assignments.getById(organizationId, input.assignmentId);
    if (!assignment) badRequest("assignmentId must belong to the same organization");

    const uploadedAt = parseDateOrNow(input.uploadedAt);
    const documentId = randomUUID();

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

      const [document] = await tx
        .insert(documentsTable)
        .values({
          id: documentId,
          organizationId,
          assignmentId: input.assignmentId,
          positionId: assignment.positionId,
          requirementKey,
          sourceDocumentRef: input.sourceDocumentRef.trim(),
          state: "uploaded",
          uploadedAt,
          updatedAt: new Date(),
        })
        .returning();
      if (!document) badRequest("Failed to upload document");

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "document",
        aggregateId: documentId,
        eventType: "document.uploaded",
        idempotencyKey: input.idempotencyKey,
        payload: {
          documentId,
          assignmentId: input.assignmentId,
          positionId: assignment.positionId,
          requirementKey,
          sourceDocumentRef: input.sourceDocumentRef.trim(),
          state: "uploaded",
          uploadedAt: uploadedAt.toISOString(),
        },
      });

      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          evidence: true,
        },
      });

      const response = { document, replayed: false };
      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "document.upload",
          assignmentId: input.assignmentId,
          requirementKey,
          sourceDocumentRef: input.sourceDocumentRef.trim(),
          uploadedAt: uploadedAt.toISOString(),
        }),
        responseBlob: response,
      });
      return response;
    });
  }

  async transitionDocumentState(
    actor: ActorContext,
    organizationId: string,
    documentId: string,
    input: {
      toState: Exclude<DocumentLifecycleState, "uploaded">;
      effectiveAt?: string;
      idempotencyKey: string;
    },
  ) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    assertIdempotencyKey(input.idempotencyKey);

    const effectiveAt = parseDateOrNow(input.effectiveAt);

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

      const [current] = await tx
        .select()
        .from(documentsTable)
        .where(and(eq(documentsTable.organizationId, organizationId), eq(documentsTable.id, documentId)))
        .limit(1);
      if (!current) notFound("Document not found");
      assertAllowedDocumentTransition(current.state, input.toState);

      const setValues: Partial<typeof documentsTable.$inferInsert> = {
        state: input.toState,
        updatedAt: new Date(),
      };
      if (input.toState === "signed") setValues.signedAt = effectiveAt;
      if (input.toState === "expired") setValues.expiredAt = effectiveAt;
      if (input.toState === "revoked") setValues.revokedAt = effectiveAt;

      const [updated] = await tx
        .update(documentsTable)
        .set(setValues)
        .where(and(eq(documentsTable.organizationId, organizationId), eq(documentsTable.id, documentId)))
        .returning();
      if (!updated) notFound("Document not found");

      await appendDomainEvent(tx, {
        organizationId,
        actorUserId: actor.userId,
        aggregateType: "document",
        aggregateId: documentId,
        eventType: transitionEventType(input.toState),
        idempotencyKey: input.idempotencyKey,
        payload: {
          documentId: updated.id,
          assignmentId: updated.assignmentId,
          positionId: updated.positionId,
          requirementKey: updated.requirementKey,
          state: input.toState,
          effectiveAt: effectiveAt.toISOString(),
        },
      });

      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          evidence: true,
        },
      });

      const response = { document: updated, replayed: false };
      await tx.insert(idempotencyRecordsTable).values({
        orgId: organizationId,
        idempotencyKey: input.idempotencyKey,
        requestHash: stableHash({
          commandType: "document.transition",
          documentId,
          toState: input.toState,
          effectiveAt: effectiveAt.toISOString(),
        }),
        responseBlob: response,
      });
      return response;
    });
  }

  async recomputeProjections(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");
    await db.transaction(async (tx) => {
      await this.projector.rebuildFromEventsTx(tx, {
        organizationId,
        include: {
          evidence: true,
        },
      });
    });
    return {
      organizationId,
      recomputedAt: new Date().toISOString(),
    };
  }


}

export function buildEvidenceService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new EvidenceService(
    access,
    new PositionRepository(),
    new PersonPositionAssignmentRepository(),
    buildProjectionBuilderService(),
  );
}
