import { and, asc, eq, lte } from "drizzle-orm";
import {
  db,
  outboxDeadLettersTable,
  outboxDeliveryReceiptsTable,
  outboxEventsTable,
} from "@workspace/db";

export type OutboxDeliveryHandler = (event: {
  outboxEventId: string;
  orgId: string;
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

export class OutboxReliabilityService {
  async processDueEvents(input: {
    consumerKey: string;
    maxBatchSize?: number;
    maxAttempts?: number;
    baseBackoffMs?: number;
    now?: Date;
    handler: OutboxDeliveryHandler;
  }) {
    const maxBatchSize = input.maxBatchSize ?? 5000;
    const maxAttempts = input.maxAttempts ?? 5;
    const baseBackoffMs = input.baseBackoffMs ?? 1000;
    const now = input.now ?? new Date();

    const dueEvents = await db
      .select()
      .from(outboxEventsTable)
      .where(
        and(
          eq(outboxEventsTable.processed, false),
          lte(outboxEventsTable.nextAttemptAt, now),
        ),
      )
      .orderBy(asc(outboxEventsTable.createdAt))
      .limit(maxBatchSize);

    const stats = {
      attempted: 0,
      delivered: 0,
      deduped: 0,
      retried: 0,
      deadLettered: 0,
      failures: 0,
    };

    for (const event of dueEvents) {
      stats.attempted += 1;
      await db.transaction(async (tx) => {
        const [latest] = await tx
          .select()
          .from(outboxEventsTable)
          .where(eq(outboxEventsTable.id, event.id))
          .limit(1);
        if (!latest || latest.processed) {
          return;
        }

        const [receipt] = await tx
          .select()
          .from(outboxDeliveryReceiptsTable)
          .where(
            and(
              eq(outboxDeliveryReceiptsTable.orgId, latest.orgId),
              eq(outboxDeliveryReceiptsTable.eventId, latest.eventId),
              eq(outboxDeliveryReceiptsTable.consumerKey, input.consumerKey),
            ),
          )
          .limit(1);

        if (receipt) {
          stats.deduped += 1;
          await tx
            .update(outboxEventsTable)
            .set({
              processed: true,
              processedAt: now,
              attempts: latest.attempts + 1,
              lastError: null,
            })
            .where(eq(outboxEventsTable.id, latest.id));
          return;
        }

        try {
          await input.handler({
            outboxEventId: latest.id,
            orgId: latest.orgId,
            eventId: latest.eventId,
            type: latest.type,
            payload: latest.payload,
          });

          await tx
            .insert(outboxDeliveryReceiptsTable)
            .values({
              orgId: latest.orgId,
              eventId: latest.eventId,
              consumerKey: input.consumerKey,
              deliveredAt: now,
            })
            .onConflictDoNothing();

          await tx
            .update(outboxEventsTable)
            .set({
              processed: true,
              processedAt: now,
              attempts: latest.attempts + 1,
              lastError: null,
            })
            .where(eq(outboxEventsTable.id, latest.id));
          stats.delivered += 1;
        } catch (error) {
          stats.failures += 1;
          const nextAttempts = latest.attempts + 1;
          const reason = error instanceof Error ? error.message : "unknown_delivery_error";

          if (nextAttempts >= maxAttempts) {
            await tx
              .insert(outboxDeadLettersTable)
              .values({
                orgId: latest.orgId,
                outboxEventId: latest.id,
                eventId: latest.eventId,
                consumerKey: input.consumerKey,
                reason,
                attempts: nextAttempts,
                payload: latest.payload,
              })
              .onConflictDoNothing();
            await tx
              .update(outboxEventsTable)
              .set({
                processed: true,
                processedAt: now,
                attempts: nextAttempts,
                lastError: reason,
              })
              .where(eq(outboxEventsTable.id, latest.id));
            stats.deadLettered += 1;
            return;
          }

          const backoffMs = baseBackoffMs * 2 ** (nextAttempts - 1);
          await tx
            .update(outboxEventsTable)
            .set({
              attempts: nextAttempts,
              nextAttemptAt: new Date(now.getTime() + backoffMs),
              lastError: reason,
            })
            .where(eq(outboxEventsTable.id, latest.id));
          stats.retried += 1;
        }
      });
    }

    return stats;
  }

  async getHealth(organizationId: string) {
    const [queueDepthRows, deadLetterRows, processedRows] = await Promise.all([
      db
        .select({ id: outboxEventsTable.id })
        .from(outboxEventsTable)
        .where(and(eq(outboxEventsTable.orgId, organizationId), eq(outboxEventsTable.processed, false))),
      db
        .select({ id: outboxDeadLettersTable.id })
        .from(outboxDeadLettersTable)
        .where(eq(outboxDeadLettersTable.orgId, organizationId)),
      db
        .select({ id: outboxEventsTable.id })
        .from(outboxEventsTable)
        .where(and(eq(outboxEventsTable.orgId, organizationId), eq(outboxEventsTable.processed, true))),
    ]);

    return {
      organizationId,
      queueDepth: queueDepthRows.length,
      deadLetterCount: deadLetterRows.length,
      processedCount: processedRows.length,
    };
  }
}

export function buildOutboxReliabilityService() {
  return new OutboxReliabilityService();
}
