import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  orgEventsTable,
  streamQuarantinesTable,
  streamRepairAdaptersTable,
} from "@workspace/db";
import type { AggregateType } from "../domain";
import { badRequest } from "../lib/http-error";
import { appendDomainEvent } from "./event-store-write";

type SchemaViolation = {
  eventId: string;
  aggregateType: AggregateType;
  aggregateId: string;
  eventType: string;
  missingKeys: string[];
};

const EVENT_REQUIRED_KEYS: Record<string, string[]> = {
  "assignment.started": ["assignmentId", "positionId", "effectiveFrom"],
  "assignment.ended": ["assignmentId", "effectiveTo"],
  "document.uploaded": ["documentId", "assignmentId", "positionId", "requirementKey"],
  "document.signed": ["documentId", "assignmentId", "positionId", "requirementKey"],
  "document.expired": ["documentId", "assignmentId", "positionId", "requirementKey"],
  "document.revoked": ["documentId", "assignmentId", "positionId", "requirementKey"],
  "compensation.recorded": [
    "compensationRecordId",
    "assignmentId",
    "sourceDocumentId",
    "amount",
    "currency",
    "effectiveFrom",
  ],
  "offboarding.completed": ["offboardingId", "assignmentId", "completedAt"],
  "evidence.profile.upserted": ["positionId", "requirements"],
  "evidence.override.set": ["positionId", "requirementKey", "isRequired"],
  "position.created": ["positionId", "title"],
};

function detectContinuityErrors(rows: Array<typeof orgEventsTable.$inferSelect>) {
  const byAggregate = new Map<string, Array<typeof orgEventsTable.$inferSelect>>();
  for (const row of rows) {
    const key = `${row.aggregateType}:${row.aggregateId}`;
    const list = byAggregate.get(key) ?? [];
    list.push(row);
    byAggregate.set(key, list);
  }

  const errors: Array<{
    aggregateType: AggregateType;
    aggregateId: string;
    expectedVersion: number;
    actualVersion: number;
    eventId: string;
  }> = [];
  for (const [key, events] of byAggregate.entries()) {
    const [aggregateType, aggregateId] = key.split(":");
    const sorted = [...events].sort((a, b) => a.version - b.version);
    let expected = 1;
    for (const event of sorted) {
      if (event.version !== expected) {
        errors.push({
          aggregateType: aggregateType as AggregateType,
          aggregateId,
          expectedVersion: expected,
          actualVersion: event.version,
          eventId: event.id,
        });
        expected = event.version + 1;
      } else {
        expected += 1;
      }
    }
  }
  return errors;
}

function missingKeysForEvent(row: typeof orgEventsTable.$inferSelect): string[] {
  const required = EVENT_REQUIRED_KEYS[row.eventType];
  if (!required) return [];
  const payload = row.payload as Record<string, unknown>;
  const missing = required.filter((key) => payload[key] === undefined || payload[key] === null);
  if (row.eventType === "assignment.started") {
    const hasPersonId = payload.personId !== undefined && payload.personId !== null;
    const hasEmployeeId = payload.employeeId !== undefined && payload.employeeId !== null;
    if (!hasPersonId && !hasEmployeeId && !missing.includes("personId|employeeId")) {
      missing.push("personId|employeeId");
    }
  }
  return missing;
}

export class QuarantineService {
  async list(organizationId: string) {
    return db
      .select()
      .from(streamQuarantinesTable)
      .where(eq(streamQuarantinesTable.orgId, organizationId));
  }

  async detectAndQuarantine(organizationId: string, actorUserId: string) {
    const rows = await db.select().from(orgEventsTable).where(eq(orgEventsTable.orgId, organizationId));
    const adapters = await db
      .select({ eventId: streamRepairAdaptersTable.eventId })
      .from(streamRepairAdaptersTable)
      .where(eq(streamRepairAdaptersTable.orgId, organizationId));
    const ignoredEventIds = new Set(adapters.map((adapter) => adapter.eventId));

    const continuityErrors = detectContinuityErrors(rows);
    const schemaViolations: SchemaViolation[] = rows
      .filter((row) => !ignoredEventIds.has(row.id))
      .map((row) => ({
        eventId: row.id,
        aggregateType: row.aggregateType,
        aggregateId: row.aggregateId,
        eventType: row.eventType,
        missingKeys: missingKeysForEvent(row),
      }))
      .filter((violation) => violation.missingKeys.length > 0);

    const targets = new Map<string, { aggregateType: AggregateType; aggregateId: string; reason: string }>();
    for (const error of continuityErrors) {
      targets.set(`${error.aggregateType}:${error.aggregateId}`, {
        aggregateType: error.aggregateType,
        aggregateId: error.aggregateId,
        reason: `version_continuity_error expected=${error.expectedVersion} actual=${error.actualVersion}`,
      });
    }
    for (const violation of schemaViolations) {
      targets.set(`${violation.aggregateType}:${violation.aggregateId}`, {
        aggregateType: violation.aggregateType,
        aggregateId: violation.aggregateId,
        reason: `schema_violation event=${violation.eventType} missing=${violation.missingKeys.join(",")}`,
      });
    }

    const quarantined: Array<{ aggregateType: AggregateType; aggregateId: string; reason: string }> = [];
    await db.transaction(async (tx) => {
      for (const target of targets.values()) {
        await tx
          .insert(streamQuarantinesTable)
          .values({
            id: randomUUID(),
            orgId: organizationId,
            aggregateType: target.aggregateType,
            aggregateId: target.aggregateId,
            state: "quarantined",
            reason: target.reason,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [
              streamQuarantinesTable.orgId,
              streamQuarantinesTable.aggregateType,
              streamQuarantinesTable.aggregateId,
            ],
            set: {
              state: "quarantined",
              reason: target.reason,
              updatedAt: new Date(),
            },
          });

        await appendDomainEvent(tx, {
          organizationId,
          actorUserId,
          aggregateType: "system",
          aggregateId: `${target.aggregateType}:${target.aggregateId}`,
          eventType: "quarantine.applied",
          idempotencyKey: `quarantine-applied-${target.aggregateType}-${target.aggregateId}-${randomUUID()}`,
          payload: {
            aggregateType: target.aggregateType,
            aggregateId: target.aggregateId,
            reason: target.reason,
          },
        });

        quarantined.push(target);
      }
    });

    return {
      organizationId,
      continuityErrors,
      schemaViolations,
      projectionDriftMismatches: [],
      quarantined,
    };
  }

  async recoverStream(input: {
    organizationId: string;
    actorUserId: string;
    aggregateType: AggregateType;
    aggregateId: string;
    repairMode: "schema_adapter" | "none";
    notes?: string;
  }) {
    const [quarantine] = await db
      .select()
      .from(streamQuarantinesTable)
      .where(
        and(
          eq(streamQuarantinesTable.orgId, input.organizationId),
          eq(streamQuarantinesTable.aggregateType, input.aggregateType),
          eq(streamQuarantinesTable.aggregateId, input.aggregateId),
        ),
      )
      .limit(1);
    if (!quarantine || quarantine.state !== "quarantined") {
      badRequest("stream must be quarantined before recovery");
    }

    const streamEvents = await db
      .select()
      .from(orgEventsTable)
      .where(
        and(
          eq(orgEventsTable.orgId, input.organizationId),
          eq(orgEventsTable.aggregateType, input.aggregateType),
          eq(orgEventsTable.aggregateId, input.aggregateId),
        ),
      );
    const existingAdapters = await db
      .select({ eventId: streamRepairAdaptersTable.eventId })
      .from(streamRepairAdaptersTable)
      .where(eq(streamRepairAdaptersTable.orgId, input.organizationId));
    const adapterIds = new Set(existingAdapters.map((row) => row.eventId));

    const unresolvedSchemaViolations = streamEvents
      .filter((event) => !adapterIds.has(event.id))
      .map((event) => ({
        event,
        missingKeys: missingKeysForEvent(event),
      }))
      .filter((entry) => entry.missingKeys.length > 0);

    await db.transaction(async (tx) => {
      if (input.repairMode === "schema_adapter") {
        for (const violation of unresolvedSchemaViolations) {
          await tx
            .insert(streamRepairAdaptersTable)
            .values({
              id: randomUUID(),
              orgId: input.organizationId,
              eventId: violation.event.id,
              aggregateType: input.aggregateType,
              aggregateId: input.aggregateId,
              adapterType: "ignore_schema_violation",
              details: {
                eventType: violation.event.eventType,
                missingKeys: violation.missingKeys,
                notes: input.notes ?? "",
              },
            })
            .onConflictDoNothing();
        }
      } else if (unresolvedSchemaViolations.length > 0) {
        badRequest("recovery requires schema_adapter for unresolved schema violations");
      }

      await tx
        .update(streamQuarantinesTable)
        .set({
          state: "restored",
          reason: `recovered:${input.repairMode}${input.notes ? `:${input.notes}` : ""}`,
          updatedAt: new Date(),
        })
        .where(eq(streamQuarantinesTable.id, quarantine.id));

      await appendDomainEvent(tx, {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        aggregateType: "system",
        aggregateId: `${input.aggregateType}:${input.aggregateId}`,
        eventType: "quarantine.restored",
        idempotencyKey: `quarantine-restored-${input.aggregateType}-${input.aggregateId}-${randomUUID()}`,
        payload: {
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          repairMode: input.repairMode,
          notes: input.notes ?? "",
        },
      });
    });

    return {
      organizationId: input.organizationId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      recovered: true,
      repairMode: input.repairMode,
    };
  }
}

export function buildQuarantineService() {
  return new QuarantineService();
}
