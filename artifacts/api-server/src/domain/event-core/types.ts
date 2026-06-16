import { createHash } from "node:crypto";

export type AggregateType =
  | "position"
  | "assignment"
  | "document"
  | "compensation"
  | "offboarding"
  | "employee"
  | "system";

export type AggregateVersionMap = Record<string, number>;

export type EventPayload = Record<string, unknown>;

export type EventEnvelope = {
  orgId: string;
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  actorId: string;
  correlationId?: string;
  causationId?: string;
  schemaVersion: number;
  idempotencyKey: string;
  payload: EventPayload;
  payloadHash: string;
};

export type CommandRequest<TPayload extends EventPayload = EventPayload> = {
  orgId: string;
  actorId: string;
  idempotencyKey: string;
  commandType: string;
  expectedVersions: AggregateVersionMap;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
};

export type IdempotencyRecord<TResponse extends EventPayload = EventPayload> = {
  requestHash: string;
  response: TResponse;
};

export type OutboxEvent = {
  orgId: string;
  eventId: string;
  type: string;
  payload: EventPayload;
};

export type CommandExecutionResult<TResponse extends EventPayload = EventPayload> = {
  response: TResponse;
  events: EventEnvelope[];
  nextVersions: AggregateVersionMap;
};

export class CommandError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export class ValidationError extends CommandError {
  constructor(message: string) {
    super(message, 400, "validation_error");
  }
}

export class AuthorizationError extends CommandError {
  constructor(message: string) {
    super(message, 403, "authorization_error");
  }
}

export class InvariantViolationError extends CommandError {
  constructor(message: string) {
    super(message, 422, "invariant_violation");
  }
}

export class ConflictError extends CommandError {
  constructor(message: string, code = "conflict") {
    super(message, 409, code);
  }
}

export class QuarantinedAggregateError extends CommandError {
  constructor(message: string) {
    super(message, 423, "aggregate_quarantined");
  }
}

export type HashBundle = {
  requestHash: string;
  payloadHash: string;
};

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return Object.fromEntries(entries.map(([key, nested]) => [key, sortKeys(nested)]));
}

export function stableHash(value: unknown): string {
  const normalized = sortKeys(value);
  const serialized = JSON.stringify(normalized);
  return createHash("sha256").update(serialized).digest("hex");
}

export function createHashBundle<TPayload extends EventPayload>(
  request: CommandRequest<TPayload>,
): HashBundle {
  return {
    requestHash: stableHash({
      commandType: request.commandType,
      expectedVersions: request.expectedVersions,
      payload: request.payload,
      orgId: request.orgId,
      actorId: request.actorId,
    }),
    payloadHash: stableHash(request.payload),
  };
}

