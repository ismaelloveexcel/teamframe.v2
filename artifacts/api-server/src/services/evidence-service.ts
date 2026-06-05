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
  personPositionAssignmentsTable,
  positionRequirementOverridesTable,
  positionsTable,
} from "@workspace/db";
import {
  deriveEvidenceStatusByAssignment,
  deriveEvidenceStatusByPosition,
  type ComplianceDerivedStatus,
  type DocumentLifecycleState,
  type RequirementRule,
} from "../domain/aggregates/evidence";
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

async function loadRequirementRules(executor: any, organizationId: string): Promise<RequirementRule[]> {
  const requirements = await executor
    .select({
      positionId: evidenceRequirementProfilesTable.positionId,
      requirementKey: evidenceRequirementsTable.requirementKey,
      isRequired: evidenceRequirementsTable.isRequired,
    })
    .from(evidenceRequirementsTable)
    .innerJoin(
      evidenceRequirementProfilesTable,
      eq(evidenceRequirementProfilesTable.id, evidenceRequirementsTable.profileId),
    )
    .where(eq(evidenceRequirementsTable.organizationId, organizationId));
  const overrides = await executor
    .select({
      positionId: positionRequirementOverridesTable.positionId,
      requirementKey: positionRequirementOverridesTable.requirementKey,
      isRequired: positionRequirementOverridesTable.isRequired,
    })
    .from(positionRequirementOverridesTable)
    .where(eq(positionRequirementOverridesTable.organizationId, organizationId));

  const map = new Map<string, RequirementRule>();
  for (const requirement of requirements) {
    map.set(`${requirement.positionId}:${requirement.requirementKey}`, {
      positionId: requirement.positionId,
      requirementKey: requirement.requirementKey,
      isRequired: requirement.isRequired,
    });
  }
  for (const override of overrides) {
    map.set(`${override.positionId}:${override.requirementKey}`, {
      positionId: override.positionId,
      requirementKey: override.requirementKey,
      isRequired: override.isRequired,
    });
  }
  return [...map.values()].sort((a, b) =>
    `${a.positionId}:${a.requirementKey}`.localeCompare(`${b.positionId}:${b.requirementKey}`),
  );
}

export class EvidenceService {
  constructor(
    private readonly access: OrganizationAccessControl,
    private readonly positions: PositionRepository,
    private readonly assignments: PersonPositionAssignmentRepository,
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

      await this.recomputeProjectionsTx(tx, organizationId);

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

      await this.recomputeProjectionsTx(tx, organizationId);

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

      await this.recomputeProjectionsTx(tx, organizationId);

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

      await this.recomputeProjectionsTx(tx, organizationId);

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
      await this.recomputeProjectionsTx(tx, organizationId);
    });
    return {
      organizationId,
      recomputedAt: new Date().toISOString(),
    };
  }

  private async recomputeProjectionsTx(tx: any, organizationId: string) {
    const rules = await loadRequirementRules(tx, organizationId);
    const activeAssignments = await tx
      .select()
      .from(personPositionAssignmentsTable)
      .where(
        and(
          eq(personPositionAssignmentsTable.organizationId, organizationId),
          eq(personPositionAssignmentsTable.status, "active"),
        ),
      );
    const docs = await tx
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.organizationId, organizationId));
    const positions = await tx
      .select({ id: positionsTable.id })
      .from(positionsTable)
      .where(eq(positionsTable.organizationId, organizationId));

    const latestByAssignmentRequirement = new Map<string, (typeof docs)[number]>();
    const sortedDocs = [...docs].sort((a, b) => `${a.updatedAt.toISOString()}:${a.id}`.localeCompare(`${b.updatedAt.toISOString()}:${b.id}`));
    for (const doc of sortedDocs) {
      latestByAssignmentRequirement.set(`${doc.assignmentId}:${doc.requirementKey}`, doc);
    }

    const assignmentStatuses = deriveEvidenceStatusByAssignment({
      requirementRules: rules,
      documentSnapshots: [...latestByAssignmentRequirement.values()].map((doc) => ({
        documentId: doc.id,
        assignmentId: doc.assignmentId,
        positionId: doc.positionId,
        requirementKey: doc.requirementKey,
        state: doc.state,
        occurredAt: doc.updatedAt.toISOString(),
      })),
      events: activeAssignments.map((assignment: any) => ({
        orgId: organizationId,
        aggregateType: "assignment" as const,
        aggregateId: assignment.id,
        eventType: "assignment.started",
        version: 1,
        occurredAt: assignment.startedAt.toISOString(),
        actorId: "projection",
        idempotencyKey: `projection-${assignment.id}`,
        schemaVersion: 1,
        payload: {
          assignmentId: assignment.id,
          positionId: assignment.positionId,
          employeeId: assignment.personId,
          effectiveFrom: assignment.startedAt.toISOString(),
          effectiveTo: assignment.endedAt?.toISOString() ?? null,
        },
        payloadHash: "projection",
      })),
    });

    await tx
      .delete(evidenceStatusByAssignmentTable)
      .where(eq(evidenceStatusByAssignmentTable.organizationId, organizationId));

    for (const status of assignmentStatuses) {
      await tx
        .insert(evidenceStatusByAssignmentTable)
        .values({
          assignmentId: status.assignmentId,
          organizationId,
          positionId: status.positionId,
          status: status.status as ComplianceDerivedStatus,
          missingCount: status.missingCount,
          pendingCount: status.pendingCount,
          nonCompliantCount: status.nonCompliantCount,
          computedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [evidenceStatusByAssignmentTable.assignmentId],
          set: {
            organizationId,
            positionId: status.positionId,
            status: status.status as ComplianceDerivedStatus,
            missingCount: status.missingCount,
            pendingCount: status.pendingCount,
            nonCompliantCount: status.nonCompliantCount,
            computedAt: new Date(),
          },
        });
    }

    const byPosition = deriveEvidenceStatusByPosition(assignmentStatuses);
    const requiredCountByPosition = new Map<string, number>();
    for (const rule of rules) {
      if (!rule.isRequired) continue;
      requiredCountByPosition.set(rule.positionId, (requiredCountByPosition.get(rule.positionId) ?? 0) + 1);
    }

    for (const position of positions) {
      if (byPosition.some((entry) => entry.positionId === position.id)) continue;
      byPosition.push({
        positionId: position.id,
        status: "missing",
        missingCount: requiredCountByPosition.get(position.id) ?? 0,
        pendingCount: 0,
        nonCompliantCount: 0,
      });
    }

    await tx
      .delete(evidenceStatusByPositionTable)
      .where(eq(evidenceStatusByPositionTable.organizationId, organizationId));

    for (const status of byPosition) {
      await tx.insert(evidenceStatusByPositionTable).values({
        positionId: status.positionId,
        organizationId,
        status: status.status as ComplianceDerivedStatus,
        missingCount: status.missingCount,
        pendingCount: status.pendingCount,
        nonCompliantCount: status.nonCompliantCount,
        computedAt: new Date(),
      });
    }
  }
}

export function buildEvidenceService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new EvidenceService(access, new PositionRepository(), new PersonPositionAssignmentRepository());
}
