import {
  aggregateVersionMapKey,
  type AggregateQuarantineLookup,
  type AggregateVersionLookup,
  type EventStore,
  type EventStoreSnapshot,
  type EventStoreTransaction,
} from "./store";
import type { EventEnvelope, IdempotencyRecord, OutboxEvent } from "./types";

type MutableState = {
  events: EventEnvelope[];
  eventIds: string[];
  outbox: OutboxEvent[];
  versions: Map<string, number>;
  idempotency: Map<string, IdempotencyRecord<Record<string, unknown>>>;
  quarantined: Set<string>;
};

function cloneState(state: MutableState): MutableState {
  return {
    events: structuredClone(state.events),
    eventIds: [...state.eventIds],
    outbox: structuredClone(state.outbox),
    versions: new Map(state.versions),
    idempotency: new Map(state.idempotency),
    quarantined: new Set(state.quarantined),
  };
}

class InMemoryEventStoreTransaction implements EventStoreTransaction {
  constructor(private readonly state: MutableState) {}

  async getIdempotencyRecord<TResponse extends Record<string, unknown>>(
    orgId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyRecord<TResponse> | null> {
    const key = `${orgId}:${idempotencyKey}`;
    const record = this.state.idempotency.get(key);
    if (!record) return null;
    return structuredClone(record) as IdempotencyRecord<TResponse>;
  }

  async putIdempotencyRecord<TResponse extends Record<string, unknown>>(
    orgId: string,
    idempotencyKey: string,
    record: IdempotencyRecord<TResponse>,
  ): Promise<void> {
    const key = `${orgId}:${idempotencyKey}`;
    this.state.idempotency.set(
      key,
      structuredClone(record) as IdempotencyRecord<Record<string, unknown>>,
    );
  }

  async getAggregateVersion(input: AggregateVersionLookup): Promise<number> {
    const key = aggregateVersionMapKey(input);
    return this.state.versions.get(key) ?? 0;
  }

  async setAggregateVersion(input: AggregateVersionLookup, version: number): Promise<void> {
    const key = aggregateVersionMapKey(input);
    this.state.versions.set(key, version);
  }

  async isAggregateQuarantined(input: AggregateQuarantineLookup): Promise<boolean> {
    return this.state.quarantined.has(aggregateVersionMapKey(input));
  }

  async appendEvent(event: EventEnvelope): Promise<string> {
    const id = `evt-${this.state.eventIds.length + 1}`;
    this.state.eventIds.push(id);
    this.state.events.push(structuredClone(event));
    return id;
  }

  async enqueueOutbox(event: OutboxEvent): Promise<void> {
    this.state.outbox.push(structuredClone(event));
  }
}

export class InMemoryEventStore implements EventStore {
  private state: MutableState = {
    events: [],
    eventIds: [],
    outbox: [],
    versions: new Map<string, number>(),
    idempotency: new Map<string, IdempotencyRecord<Record<string, unknown>>>(),
    quarantined: new Set<string>(),
  };

  quarantine(input: AggregateVersionLookup) {
    this.state.quarantined.add(aggregateVersionMapKey(input));
  }

  async runInTransaction<T>(fn: (tx: EventStoreTransaction) => Promise<T>): Promise<T> {
    const transactionState = cloneState(this.state);
    const tx = new InMemoryEventStoreTransaction(transactionState);
    const result = await fn(tx);
    this.state = transactionState;
    return result;
  }

  snapshot(): EventStoreSnapshot {
    return {
      events: structuredClone(this.state.events),
      outbox: structuredClone(this.state.outbox),
      versions: Object.fromEntries(this.state.versions.entries()),
      idempotencyKeys: [...this.state.idempotency.keys()],
      quarantinedAggregates: [...this.state.quarantined.values()],
    };
  }
}

