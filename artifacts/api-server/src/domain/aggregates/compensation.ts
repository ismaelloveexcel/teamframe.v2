import type { EventEnvelope } from "../event-core";

export type CompensationRecordSnapshot = {
  compensationRecordId: string;
  assignmentId: string;
  sourceDocumentId: string;
  amount: number;
  currency: string;
  effectiveFrom: string;
  occurredAt: string;
};

export function deriveCompensationRecordsFromEvents(
  events: EventEnvelope[],
): CompensationRecordSnapshot[] {
  return events
    .filter(
      (event) => event.aggregateType === "compensation" && event.eventType === "compensation.recorded",
    )
    .map((event) => {
      const payload = event.payload as Record<string, unknown>;
      return {
        compensationRecordId: String(payload.compensationRecordId ?? event.aggregateId),
        assignmentId: String(payload.assignmentId ?? ""),
        sourceDocumentId: String(payload.sourceDocumentId ?? ""),
        amount: Number(payload.amount ?? 0),
        currency: String(payload.currency ?? ""),
        effectiveFrom: String(payload.effectiveFrom ?? ""),
        occurredAt: event.occurredAt,
      };
    })
    .filter(
      (row) =>
        row.compensationRecordId.length > 0 &&
        row.assignmentId.length > 0 &&
        row.sourceDocumentId.length > 0 &&
        row.currency.length > 0 &&
        row.effectiveFrom.length > 0,
    )
    .sort((a, b) => {
      const byEffective = a.effectiveFrom.localeCompare(b.effectiveFrom);
      if (byEffective !== 0) return byEffective;
      const byOccurred = a.occurredAt.localeCompare(b.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      return a.compensationRecordId.localeCompare(b.compensationRecordId);
    });
}

export function deriveCompensationCurrentByAssignment(
  records: CompensationRecordSnapshot[],
): Map<string, CompensationRecordSnapshot> {
  const current = new Map<string, CompensationRecordSnapshot>();
  for (const record of records) {
    const existing = current.get(record.assignmentId);
    if (!existing) {
      current.set(record.assignmentId, record);
      continue;
    }
    const existingKey = `${existing.effectiveFrom}:${existing.occurredAt}:${existing.compensationRecordId}`;
    const nextKey = `${record.effectiveFrom}:${record.occurredAt}:${record.compensationRecordId}`;
    if (nextKey.localeCompare(existingKey) >= 0) {
      current.set(record.assignmentId, record);
    }
  }
  return current;
}
