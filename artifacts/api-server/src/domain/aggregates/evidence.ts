import type { EventEnvelope } from "../event-core";
import { deriveAssignments } from "./assignment";

export type DocumentLifecycleState = "uploaded" | "signed" | "expired" | "revoked";
export type ComplianceDerivedStatus = "missing" | "pending" | "compliant" | "non_compliant";

export type RequirementRule = {
  positionId: string;
  requirementKey: string;
  isRequired: boolean;
};

export type DocumentSnapshot = {
  documentId: string;
  assignmentId: string;
  positionId: string;
  requirementKey: string;
  state: DocumentLifecycleState;
  occurredAt: string;
};

export type AssignmentEvidenceStatus = {
  assignmentId: string;
  positionId: string;
  status: ComplianceDerivedStatus;
  missingCount: number;
  pendingCount: number;
  nonCompliantCount: number;
};

function eventSort(a: EventEnvelope, b: EventEnvelope): number {
  const byOccurred = a.occurredAt.localeCompare(b.occurredAt);
  if (byOccurred !== 0) return byOccurred;
  const byVersion = a.version - b.version;
  if (byVersion !== 0) return byVersion;
  const byAggregate = a.aggregateId.localeCompare(b.aggregateId);
  if (byAggregate !== 0) return byAggregate;
  return a.eventType.localeCompare(b.eventType);
}

export function deriveRequirementRulesFromEvents(events: EventEnvelope[]): RequirementRule[] {
  const sorted = [...events].sort(eventSort);
  const rules = new Map<string, RequirementRule>();
  for (const event of sorted) {
    if (event.eventType === "evidence.profile.upserted") {
      const payload = event.payload as Record<string, unknown>;
      const positionId = String(payload.positionId ?? "");
      const requirements = Array.isArray(payload.requirements) ? payload.requirements : [];
      for (const requirement of requirements) {
        const record = requirement as Record<string, unknown>;
        const requirementKey = String(record.requirementKey ?? "");
        if (!positionId || !requirementKey) continue;
        rules.set(`${positionId}:${requirementKey}`, {
          positionId,
          requirementKey,
          isRequired: Boolean(record.isRequired ?? true),
        });
      }
    }
    if (event.eventType === "evidence.override.set") {
      const payload = event.payload as Record<string, unknown>;
      const positionId = String(payload.positionId ?? "");
      const requirementKey = String(payload.requirementKey ?? "");
      if (!positionId || !requirementKey) continue;
      rules.set(`${positionId}:${requirementKey}`, {
        positionId,
        requirementKey,
        isRequired: Boolean(payload.isRequired),
      });
    }
  }
  return [...rules.values()].sort((a, b) =>
    `${a.positionId}:${a.requirementKey}`.localeCompare(`${b.positionId}:${b.requirementKey}`),
  );
}

export function deriveDocumentSnapshotsFromEvents(events: EventEnvelope[]): DocumentSnapshot[] {
  const sorted = [...events].sort(eventSort);
  const docs = new Map<string, DocumentSnapshot>();
  for (const event of sorted) {
    if (event.aggregateType !== "document") continue;
    const payload = event.payload as Record<string, unknown>;
    const documentId = String(payload.documentId ?? event.aggregateId ?? "");
    const assignmentId = String(payload.assignmentId ?? "");
    const positionId = String(payload.positionId ?? "");
    const requirementKey = String(payload.requirementKey ?? "");
    if (!documentId || !assignmentId || !positionId || !requirementKey) continue;

    if (event.eventType === "document.uploaded") {
      docs.set(documentId, {
        documentId,
        assignmentId,
        positionId,
        requirementKey,
        state: "uploaded",
        occurredAt: event.occurredAt,
      });
      continue;
    }

    const existing = docs.get(documentId);
    if (!existing) continue;
    if (event.eventType === "document.signed") {
      docs.set(documentId, { ...existing, state: "signed", occurredAt: event.occurredAt });
    } else if (event.eventType === "document.expired") {
      docs.set(documentId, { ...existing, state: "expired", occurredAt: event.occurredAt });
    } else if (event.eventType === "document.revoked") {
      docs.set(documentId, { ...existing, state: "revoked", occurredAt: event.occurredAt });
    }
  }
  return [...docs.values()].sort((a, b) => a.documentId.localeCompare(b.documentId));
}

export function deriveEvidenceStatusByAssignment(input: {
  requirementRules: RequirementRule[];
  documentSnapshots: DocumentSnapshot[];
  events: EventEnvelope[];
}): AssignmentEvidenceStatus[] {
  const activeAssignments = deriveAssignments(input.events)
    .filter((assignment) => assignment.status === "active")
    .map((assignment) => ({
      assignmentId: assignment.assignmentId,
      positionId: assignment.positionId,
    }))
    .sort((a, b) => a.assignmentId.localeCompare(b.assignmentId));

  const requiredByPosition = new Map<string, string[]>();
  for (const rule of input.requirementRules) {
    if (!rule.isRequired) continue;
    const list = requiredByPosition.get(rule.positionId) ?? [];
    list.push(rule.requirementKey);
    requiredByPosition.set(rule.positionId, list);
  }
  for (const [positionId, keys] of requiredByPosition.entries()) {
    requiredByPosition.set(positionId, [...new Set(keys)].sort((a, b) => a.localeCompare(b)));
  }

  const latestDocs = new Map<string, DocumentSnapshot>();
  const orderedDocs = [...input.documentSnapshots].sort((a, b) =>
    `${a.occurredAt}:${a.documentId}`.localeCompare(`${b.occurredAt}:${b.documentId}`),
  );
  for (const doc of orderedDocs) {
    latestDocs.set(`${doc.assignmentId}:${doc.requirementKey}`, doc);
  }

  return activeAssignments.map((assignment) => {
    const requiredKeys = requiredByPosition.get(assignment.positionId) ?? [];
    let missingCount = 0;
    let pendingCount = 0;
    let nonCompliantCount = 0;

    for (const requirementKey of requiredKeys) {
      const doc = latestDocs.get(`${assignment.assignmentId}:${requirementKey}`);
      if (!doc) {
        missingCount += 1;
      } else if (doc.state === "uploaded") {
        pendingCount += 1;
      } else if (doc.state === "expired" || doc.state === "revoked") {
        nonCompliantCount += 1;
      }
    }

    let status: ComplianceDerivedStatus = "compliant";
    if (missingCount > 0) status = "missing";
    else if (pendingCount > 0) status = "pending";
    else if (nonCompliantCount > 0) status = "non_compliant";

    return {
      assignmentId: assignment.assignmentId,
      positionId: assignment.positionId,
      status,
      missingCount,
      pendingCount,
      nonCompliantCount,
    };
  });
}

export function deriveEvidenceStatusByPosition(
  statuses: AssignmentEvidenceStatus[],
): Array<{
  positionId: string;
  status: ComplianceDerivedStatus;
  missingCount: number;
  pendingCount: number;
  nonCompliantCount: number;
}> {
  const grouped = new Map<string, AssignmentEvidenceStatus[]>();
  for (const status of statuses) {
    const list = grouped.get(status.positionId) ?? [];
    list.push(status);
    grouped.set(status.positionId, list);
  }

  const results: Array<{
    positionId: string;
    status: ComplianceDerivedStatus;
    missingCount: number;
    pendingCount: number;
    nonCompliantCount: number;
  }> = [];

  for (const [positionId, list] of grouped.entries()) {
    const missingCount = list.reduce((acc, row) => acc + row.missingCount, 0);
    const pendingCount = list.reduce((acc, row) => acc + row.pendingCount, 0);
    const nonCompliantCount = list.reduce((acc, row) => acc + row.nonCompliantCount, 0);

    let status: ComplianceDerivedStatus = "compliant";
    if (nonCompliantCount > 0) status = "non_compliant";
    else if (missingCount > 0) status = "missing";
    else if (pendingCount > 0) status = "pending";

    results.push({
      positionId,
      status,
      missingCount,
      pendingCount,
      nonCompliantCount,
    });
  }

  return results.sort((a, b) => a.positionId.localeCompare(b.positionId));
}
