import { and, eq, sql } from "drizzle-orm";
import {
  aggregateVersionsTable,
  orgEventsTable,
  outboxEventsTable,
  streamQuarantinesTable,
} from "@workspace/db";
import type { AggregateType } from "../domain/event-core";
import { badRequest } from "../lib/http-error";

export function assertIdempotencyKey(idempotencyKey: string): void {
  if (idempotencyKey.trim().length < 8) {
    badRequest("idempotencyKey must be at least 8 characters");
  }
}

export function parseDateOrNow(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    badRequest("Invalid timestamp format");
  }
  return parsed;
}

export async function appendDomainEvent(
  tx: any,
  input: {
    organizationId: string;
    actorUserId: string;
    aggregateType: AggregateType;
    aggregateId: string;
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  },
) {
  const [quarantine] = await tx
    .select({ state: streamQuarantinesTable.state })
    .from(streamQuarantinesTable)
    .where(
      and(
        eq(streamQuarantinesTable.orgId, input.organizationId),
        eq(streamQuarantinesTable.aggregateType, input.aggregateType),
        eq(streamQuarantinesTable.aggregateId, input.aggregateId),
      ),
    )
    .limit(1);

  if (quarantine?.state === "quarantined") {
    badRequest(`${input.aggregateType} aggregate ${input.aggregateId} is quarantined`);
  }

  const [currentVersion] = await tx
    .select({ version: aggregateVersionsTable.version })
    .from(aggregateVersionsTable)
    .where(
      and(
        eq(aggregateVersionsTable.orgId, input.organizationId),
        eq(aggregateVersionsTable.aggregateType, input.aggregateType),
        eq(aggregateVersionsTable.aggregateId, input.aggregateId),
      ),
    )
    .limit(1);

  const [eventVersion] = await tx
    .select({ version: sql<number>`coalesce(max(${orgEventsTable.version}), 0)` })
    .from(orgEventsTable)
    .where(
      and(
        eq(orgEventsTable.orgId, input.organizationId),
        eq(orgEventsTable.aggregateType, input.aggregateType),
        eq(orgEventsTable.aggregateId, input.aggregateId),
      ),
    );

  const baseVersion = Math.max(currentVersion?.version ?? 0, eventVersion?.version ?? 0);
  const nextVersion = baseVersion + 1;
  const [event] = await tx
    .insert(orgEventsTable)
    .values({
      orgId: input.organizationId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      eventType: input.eventType,
      version: nextVersion,
      actorUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      schemaVersion: 1,
      payload: input.payload,
    })
    .returning();

  if (!event) {
    badRequest(`Failed to append ${input.eventType} event`);
  }

  await tx
    .insert(aggregateVersionsTable)
    .values({
      orgId: input.organizationId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      version: nextVersion,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        aggregateVersionsTable.orgId,
        aggregateVersionsTable.aggregateType,
        aggregateVersionsTable.aggregateId,
      ],
      set: {
        version: nextVersion,
        updatedAt: new Date(),
      },
    });

  await tx.insert(outboxEventsTable).values({
    orgId: input.organizationId,
    eventId: event.id,
    type: input.eventType,
    payload: input.payload,
  });
}
