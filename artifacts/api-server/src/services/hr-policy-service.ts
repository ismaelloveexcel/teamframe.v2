import { and, eq } from "drizzle-orm";
import {
  db,
  hrPolicyAcknowledgementTable,
  hrPolicyTable,
  type HrPolicy,
  type HrPolicyAcknowledgement,
} from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

export type CreatePolicyInput = { title: string; body: string; version?: number };

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

export async function createPolicy(
  companyId: string,
  actorId: string,
  input: CreatePolicyInput,
): Promise<HrPolicy> {
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrPolicyTable)
      .values({ ...input, companyId, createdBy: actorId, updatedBy: actorId })
      .returning();
    return {
      result: row,
      audit: { companyId, entityType: "policy", entityId: row.id, action: "create" as const, after: rec(row), actorId },
    };
  });
}

export async function updatePolicy(
  companyId: string,
  actorId: string,
  id: string,
  patch: Partial<CreatePolicyInput>,
): Promise<HrPolicy | null> {
  return mutateWithAudit(async (tx) => {
    const [before] = await tx
      .select()
      .from(hrPolicyTable)
      .where(and(eq(hrPolicyTable.id, id), eq(hrPolicyTable.companyId, companyId)));
    if (!before) {
      return {
        result: null,
        audit: { companyId, entityType: "policy", entityId: id, action: "update" as const, actorId: null },
      };
    }
    const [row] = await tx
      .update(hrPolicyTable)
      .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
      .where(and(eq(hrPolicyTable.id, id), eq(hrPolicyTable.companyId, companyId)))
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "policy",
        entityId: id,
        action: "update" as const,
        before: rec(before),
        after: rec(row),
        actorId,
      },
    };
  });
}

export function listPolicies(companyId: string): Promise<HrPolicy[]> {
  return db.select().from(hrPolicyTable).where(eq(hrPolicyTable.companyId, companyId));
}

export async function getPolicy(companyId: string, id: string): Promise<HrPolicy | null> {
  const [row] = await db
    .select()
    .from(hrPolicyTable)
    .where(and(eq(hrPolicyTable.id, id), eq(hrPolicyTable.companyId, companyId)));
  return row ?? null;
}

/**
 * Record an acknowledgement for an employee against a policy version. The
 * version is read from the policy at ack time, so the ack is pinned to the
 * version the employee saw. Unique per (policy, employee, version).
 */
export async function acknowledgePolicy(
  companyId: string,
  actorId: string,
  policyId: string,
  employeeId: string,
): Promise<HrPolicyAcknowledgement | null> {
  return mutateWithAudit(async (tx) => {
    const [policy] = await tx
      .select()
      .from(hrPolicyTable)
      .where(and(eq(hrPolicyTable.id, policyId), eq(hrPolicyTable.companyId, companyId)));
    if (!policy) {
      return {
        result: null,
        audit: { companyId, entityType: "policy_acknowledgement", entityId: policyId, action: "create" as const, actorId: null },
      };
    }
    const [row] = await tx
      .insert(hrPolicyAcknowledgementTable)
      .values({ companyId, policyId, employeeId, version: policy.version, createdBy: actorId })
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "policy_acknowledgement",
        entityId: row.id,
        action: "create" as const,
        after: rec(row),
        actorId,
      },
    };
  });
}

export function listAcknowledgements(companyId: string, policyId?: string): Promise<HrPolicyAcknowledgement[]> {
  if (policyId) {
    return db
      .select()
      .from(hrPolicyAcknowledgementTable)
      .where(
        and(eq(hrPolicyAcknowledgementTable.companyId, companyId), eq(hrPolicyAcknowledgementTable.policyId, policyId)),
      );
  }
  return db
    .select()
    .from(hrPolicyAcknowledgementTable)
    .where(eq(hrPolicyAcknowledgementTable.companyId, companyId));
}
