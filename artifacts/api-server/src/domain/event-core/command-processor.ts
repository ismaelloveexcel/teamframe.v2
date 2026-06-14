import {
  ConflictError,
  QuarantinedAggregateError,
  ValidationError,
  createHashBundle,
  stableHash,
  type AggregateVersionMap,
  type CommandExecutionResult,
  type CommandRequest,
  type EventEnvelope,
  type EventPayload,
} from "./types";
import { expectedVersionMapToLookup, type EventStore } from "./store";

type CommandValidator<TPayload extends EventPayload> = (
  request: CommandRequest<TPayload>,
) => Promise<void> | void;

export type BuildEventsInput<TPayload extends EventPayload> = {
  request: CommandRequest<TPayload>;
  payloadHash: string;
  nextVersions: AggregateVersionMap;
};

export type CommandHandler<TPayload extends EventPayload, TResponse extends EventPayload> = {
  validateSchema: CommandValidator<TPayload>;
  authorize: CommandValidator<TPayload>;
  validateInvariants: CommandValidator<TPayload>;
  buildEvents: (
    input: BuildEventsInput<TPayload>,
  ) => Promise<{ events: EventEnvelope[]; response: TResponse }> | { events: EventEnvelope[]; response: TResponse };
};

export class CommandProcessor {
  constructor(private readonly store: EventStore) {}

  async execute<TPayload extends EventPayload, TResponse extends EventPayload>(
    request: CommandRequest<TPayload>,
    handler: CommandHandler<TPayload, TResponse>,
  ): Promise<CommandExecutionResult<TResponse>> {
    const hashes = createHashBundle(request);

    return this.store.runInTransaction(async (tx) => {
      // 1) schema validation
      await handler.validateSchema(request);
      // 2) auth
      await handler.authorize(request);
      // 3) invariant validation
      await handler.validateInvariants(request);

      const existing = await tx.getIdempotencyRecord<TResponse>(
        request.orgId,
        request.idempotencyKey,
      );
      if (existing) {
        if (existing.requestHash !== hashes.requestHash) {
          throw new ConflictError(
            "idempotency_key already used with a different request payload.",
            "idempotency_payload_conflict",
          );
        }
        return {
          response: existing.response,
          events: [],
          nextVersions: request.expectedVersions,
        };
      }

      // 4) OCC checks + quarantine checks
      const expectedLookups = expectedVersionMapToLookup(
        request.orgId,
        request.expectedVersions,
      );
      const nextVersions: AggregateVersionMap = {};
      for (const lookup of expectedLookups) {
        if (await tx.isAggregateQuarantined(lookup)) {
          throw new QuarantinedAggregateError(
            `Aggregate ${lookup.aggregateType}:${lookup.aggregateId} is quarantined.`,
          );
        }
        const currentVersion = await tx.getAggregateVersion(lookup);
        const lookupKey = `${lookup.aggregateType}:${lookup.aggregateId}`;
        const expectedVersion = request.expectedVersions[lookupKey];
        if (expectedVersion !== currentVersion) {
          throw new ConflictError(
            `OCC conflict on ${lookupKey}: expected=${expectedVersion} current=${currentVersion}`,
            "occ_version_conflict",
          );
        }
        nextVersions[lookupKey] = currentVersion;
      }

      const { events, response } = await handler.buildEvents({
        request,
        payloadHash: hashes.payloadHash,
        nextVersions,
      });

      if (events.length === 0) {
        throw new ValidationError("Commands must produce at least one event.");
      }

      for (const event of events) {
        if (event.orgId !== request.orgId) {
          throw new ValidationError("Event org_id must match command org_id.");
        }
        if (!event.aggregateType || !event.aggregateId) {
          throw new ValidationError("Event aggregate boundary is required.");
        }

        const aggregateKey = `${event.aggregateType}:${event.aggregateId}`;
        const currentVersion = nextVersions[aggregateKey] ?? 0;
        const nextVersion = currentVersion + 1;
        event.version = nextVersion;
        event.payloadHash = stableHash(event.payload);
        nextVersions[aggregateKey] = nextVersion;

        // 5) event insert
        const eventId = await tx.appendEvent(event);
        // 6) aggregate version update
        await tx.setAggregateVersion(
          {
            orgId: event.orgId,
            aggregateType: event.aggregateType,
            aggregateId: event.aggregateId,
          },
          nextVersion,
        );
        // 7) outbox write
        await tx.enqueueOutbox({
          orgId: event.orgId,
          eventId,
          type: event.eventType,
          payload: event.payload,
        });
      }

      await tx.putIdempotencyRecord<TResponse>(request.orgId, request.idempotencyKey, {
        requestHash: hashes.requestHash,
        response,
      });

      return {
        response,
        events,
        nextVersions,
      };
    });
  }
}

