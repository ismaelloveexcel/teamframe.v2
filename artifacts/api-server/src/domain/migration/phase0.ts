import { stableHash, type EventEnvelope } from "../event-core/types";

export type LegacySnapshot = {
  orgId: string;
  positions: Array<{ id: string; title: string; reportsToId?: string | null }>;
  assignments: Array<{
    id: string;
    positionId: string;
    employeeId: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
  }>;
  documents: Array<{
    id: string;
    assignmentId?: string | null;
    positionId: string;
    type: string;
    status: "uploaded" | "signed" | "expired" | "revoked";
  }>;
};

export type MigrationConfig = {
  enableDualWrite: boolean;
  legacyModePresent: boolean;
};

export function shouldRunDualWrite(config: MigrationConfig): boolean {
  if (!config.enableDualWrite) return false;
  return config.legacyModePresent;
}

export function buildBackfillEvents(
  snapshot: LegacySnapshot,
  actorId: string,
): EventEnvelope[] {
  const events: EventEnvelope[] = [];

  for (const position of snapshot.positions) {
    events.push({
      orgId: snapshot.orgId,
      aggregateType: "position",
      aggregateId: position.id,
      eventType: "position.created",
      version: 1,
      occurredAt: new Date().toISOString(),
      actorId,
      idempotencyKey: `phase0-backfill-position-${position.id}`,
      schemaVersion: 1,
      payload: {
        id: position.id,
        title: position.title,
        reportsToId: position.reportsToId ?? null,
      },
      payloadHash: stableHash({
        id: position.id,
        title: position.title,
        reportsToId: position.reportsToId ?? null,
      }),
    });
  }

  for (const assignment of snapshot.assignments) {
    events.push({
      orgId: snapshot.orgId,
      aggregateType: "assignment",
      aggregateId: assignment.id,
      eventType: "assignment.started",
      version: 1,
      occurredAt: new Date().toISOString(),
      actorId,
      idempotencyKey: `phase0-backfill-assignment-${assignment.id}`,
      schemaVersion: 1,
      payload: {
        id: assignment.id,
        positionId: assignment.positionId,
        employeeId: assignment.employeeId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo ?? null,
      },
      payloadHash: stableHash({
        id: assignment.id,
        positionId: assignment.positionId,
        employeeId: assignment.employeeId,
        effectiveFrom: assignment.effectiveFrom,
        effectiveTo: assignment.effectiveTo ?? null,
      }),
    });
  }

  for (const document of snapshot.documents) {
    events.push({
      orgId: snapshot.orgId,
      aggregateType: "document",
      aggregateId: document.id,
      eventType: "document.uploaded",
      version: 1,
      occurredAt: new Date().toISOString(),
      actorId,
      idempotencyKey: `phase0-backfill-document-${document.id}`,
      schemaVersion: 1,
      payload: {
        id: document.id,
        assignmentId: document.assignmentId ?? null,
        positionId: document.positionId,
        type: document.type,
        status: document.status,
      },
      payloadHash: stableHash({
        id: document.id,
        assignmentId: document.assignmentId ?? null,
        positionId: document.positionId,
        type: document.type,
        status: document.status,
      }),
    });
  }

  return events;
}

export function buildIntegrityHash(input: unknown): string {
  return stableHash(input);
}

export function verifyCutover({
  snapshotProjection,
  replayProjection,
}: {
  snapshotProjection: unknown;
  replayProjection: unknown;
}): { matched: boolean; snapshotHash: string; replayHash: string } {
  const snapshotHash = buildIntegrityHash(snapshotProjection);
  const replayHash = buildIntegrityHash(replayProjection);
  return {
    matched: snapshotHash === replayHash,
    snapshotHash,
    replayHash,
  };
}

