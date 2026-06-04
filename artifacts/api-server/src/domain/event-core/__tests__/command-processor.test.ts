import assert from "node:assert/strict";
import test from "node:test";
import {
  CommandProcessor,
  ConflictError,
  InvariantViolationError,
  InMemoryEventStore,
  QuarantinedAggregateError,
  ValidationError,
  stableHash,
  type CommandRequest,
  type EventEnvelope,
} from "../index";

type DemoPayload = {
  aggregateType: "position" | "assignment";
  aggregateId: string;
  title: string;
};

type DemoResponse = {
  ok: true;
  aggregatePath: string;
};

function baseRequest(overrides: Partial<CommandRequest<DemoPayload>> = {}): CommandRequest<DemoPayload> {
  return {
    orgId: "00000000-0000-4000-8000-000000000111",
    actorId: "11111111-1111-4111-8111-111111111111",
    idempotencyKey: "idem-1",
    commandType: "position.create",
    expectedVersions: { "position:pos-1": 0 },
    payload: {
      aggregateType: "position",
      aggregateId: "pos-1",
      title: "CEO",
    },
    ...overrides,
  };
}

function buildDemoEvent(request: CommandRequest<DemoPayload>): EventEnvelope {
  return {
    orgId: request.orgId,
    aggregateType: request.payload.aggregateType,
    aggregateId: request.payload.aggregateId,
    eventType: `${request.payload.aggregateType}.created`,
    version: 0,
    occurredAt: new Date().toISOString(),
    actorId: request.actorId,
    idempotencyKey: request.idempotencyKey,
    schemaVersion: 1,
    payload: {
      title: request.payload.title,
    },
    payloadHash: stableHash({
      title: request.payload.title,
    }),
  };
}

const happyHandler = {
  validateSchema: (request: CommandRequest<DemoPayload>) => {
    if (!request.payload.title.trim()) {
      throw new ValidationError("Title is required.");
    }
  },
  authorize: () => {},
  validateInvariants: () => {},
  buildEvents: ({ request }: { request: CommandRequest<DemoPayload> }) => ({
    events: [buildDemoEvent(request)],
    response: {
      ok: true,
      aggregatePath: `${request.payload.aggregateType}:${request.payload.aggregateId}`,
    } satisfies DemoResponse,
  }),
};

test("Phase 1 gate: duplicate idempotent command does not duplicate events", async () => {
  const store = new InMemoryEventStore();
  const processor = new CommandProcessor(store);
  const request = baseRequest();

  const first = await processor.execute(request, happyHandler);
  const second = await processor.execute(request, happyHandler);

  assert.equal(first.events.length, 1);
  assert.equal(second.events.length, 0);
  assert.deepEqual(first.response, second.response);
  assert.equal(store.snapshot().events.length, 1);
  assert.equal(store.snapshot().outbox.length, 1);
});

test("Phase 1 gate: idempotency key reused with different request hash is rejected", async () => {
  const store = new InMemoryEventStore();
  const processor = new CommandProcessor(store);
  await processor.execute(baseRequest(), happyHandler);

  await assert.rejects(
    async () =>
      processor.execute(
        baseRequest({
          payload: {
            aggregateType: "position",
            aggregateId: "pos-1",
            title: "CEO Updated",
          },
        }),
        happyHandler,
      ),
    (error: unknown) =>
      error instanceof ConflictError && error.code === "idempotency_payload_conflict",
  );
  assert.equal(store.snapshot().events.length, 1);
});

test("Phase 1 gate: invalid command fails fast with zero writes", async () => {
  const store = new InMemoryEventStore();
  const processor = new CommandProcessor(store);
  await assert.rejects(
    async () =>
      processor.execute(
        baseRequest({
          payload: {
            aggregateType: "position",
            aggregateId: "pos-1",
            title: " ",
          },
        }),
        happyHandler,
      ),
    (error: unknown) => error instanceof ValidationError,
  );
  assert.equal(store.snapshot().events.length, 0);
  assert.equal(store.snapshot().outbox.length, 0);
});

test("Phase 1 gate: OCC mismatch returns conflict and writes nothing", async () => {
  const store = new InMemoryEventStore();
  const processor = new CommandProcessor(store);

  await assert.rejects(
    async () =>
      processor.execute(
        baseRequest({
          expectedVersions: {
            "position:pos-1": 1,
          },
        }),
        happyHandler,
      ),
    (error: unknown) => error instanceof ConflictError && error.code === "occ_version_conflict",
  );
  assert.equal(store.snapshot().events.length, 0);
});

test("Phase 1 gate: multi-aggregate OCC rejects when any version mismatches", async () => {
  const store = new InMemoryEventStore();
  const processor = new CommandProcessor(store);

  await processor.execute(baseRequest(), happyHandler);

  await assert.rejects(
    async () =>
      processor.execute(
        baseRequest({
          idempotencyKey: "idem-2",
          expectedVersions: {
            "position:pos-1": 1,
            "assignment:asg-1": 1,
          },
          payload: {
            aggregateType: "assignment",
            aggregateId: "asg-1",
            title: "Initial assignment",
          },
        }),
        happyHandler,
      ),
    (error: unknown) => error instanceof ConflictError && error.code === "occ_version_conflict",
  );
  assert.equal(store.snapshot().events.length, 1);
});

test("Phase 1 gate: quarantined aggregate blocks command execution", async () => {
  const store = new InMemoryEventStore();
  store.quarantine({
    orgId: "00000000-0000-4000-8000-000000000111",
    aggregateType: "position",
    aggregateId: "pos-1",
  });
  const processor = new CommandProcessor(store);

  await assert.rejects(
    async () => processor.execute(baseRequest(), happyHandler),
    (error: unknown) => error instanceof QuarantinedAggregateError,
  );
  assert.equal(store.snapshot().events.length, 0);
});

test("Phase 1 gate: invariant validation blocks event emission", async () => {
  const store = new InMemoryEventStore();
  const processor = new CommandProcessor(store);
  const invariantFailureHandler = {
    ...happyHandler,
    validateInvariants: () => {
      throw new InvariantViolationError("Invariant failure");
    },
  };

  await assert.rejects(
    async () => processor.execute(baseRequest(), invariantFailureHandler),
    (error: unknown) => error instanceof InvariantViolationError,
  );
  assert.equal(store.snapshot().events.length, 0);
  assert.equal(store.snapshot().outbox.length, 0);
});

