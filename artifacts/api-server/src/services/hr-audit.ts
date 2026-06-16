import { db, hrAuditLogTable } from "@workspace/db";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AuditEntry = {
  companyId: string;
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  actorId?: string | null;
};

/**
 * Run a mutation and its audit row inside ONE transaction (build-spec §4).
 * The audit row is inserted AFTER the mutation within the same tx, so:
 *  - if the mutation rolls back, no audit row is written;
 *  - if the audit insert fails, the whole mutation rolls back.
 * ALL HR create/update/delete operations must go through this helper.
 */
export async function mutateWithAudit<T>(
  mutate: (tx: Tx) => Promise<{ result: T; audit: AuditEntry }>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const { result, audit } = await mutate(tx);
    await tx.insert(hrAuditLogTable).values({
      companyId: audit.companyId,
      entityType: audit.entityType,
      entityId: audit.entityId,
      action: audit.action,
      before: audit.before ?? null,
      after: audit.after ?? null,
      actorId: audit.actorId ?? null,
    });
    return result;
  });
}
