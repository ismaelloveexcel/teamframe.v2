import type {
  AggregateType,
  AggregateVersionMap,
  EventEnvelope,
  IdempotencyRecord,
  OutboxEvent,
} from "./types";

export type AggregateVersionLookup = {
  orgId: string;
  aggregateType: AggregateType;
  aggregateId: string;
};

export type AggregateQuarantineLookup = AggregateVersionLookup;

export type EventStoreSnapshot = {
  events: EventEnvelope[];
  outbox: OutboxEvent[];
  versions: Record<string, number>;
  idempotencyKeys: string[];
  quarantinedAggregates: string[];
};

export interface EventStoreTransaction {
  getIdempotencyRecord<TResponse extends Record<string, unknown>>(
    orgId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord<TResponse> | null>;
  putIdempotencyRecord<TResponse extends Record<string, unknown>>(
    orgId: string,
    idempotencyKey: string,
    record: IdempotencyRecord<TResponse>,
  ): Promise<void>;
  getAggregateVersion(input: AggregateVersionLookup): Promise<number>;
  setAggregateVersion(input: AggregateVersionLookup, version: number): Promise<void>;
  isAggregateQuarantined(input: AggregateQuarantineLookup): Promise<boolean>;
  appendEvent(event: EventEnvelope): Promise<string>;
  enqueueOutbox(event: OutboxEvent): Promise<void>;
}

export interface EventStore {
  runInTransaction<T>(fn: (tx: EventStoreTransaction) => Promise<T>): Promise<T>;
  snapshot(): EventStoreSnapshot;
}

export function aggregateVersionMapKey(input: AggregateVersionLookup): string {
  return `${input.orgId}:${input.aggregateType}:${input.aggregateId}`;
}

export function expectedVersionMapToLookup(
  orgId: string,
  expectedVersions: AggregateVersionMap,
): AggregateVersionLookup[] {
  return Object.entries(expectedVersions).map(([aggregatePath]) => {
    const [aggregateType, ...rest] = aggregatePath.split(":");
    const aggregateId = rest.join(":");
    if (!aggregateType || !aggregateId) {
      throw new Error(
        `Expected version key must be aggregateType:aggregateId. Received "${aggregatePath}".`,
      );
    }
    return {
      orgId,
      aggregateType: aggregateType as AggregateType,
      aggregateId,
    };
  });
}

