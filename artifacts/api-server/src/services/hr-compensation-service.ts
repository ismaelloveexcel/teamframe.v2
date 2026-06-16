import { and, eq } from "drizzle-orm";
import { db, hrCompensationTable, type HrCompensation } from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

export type CreateCompensationInput = {
  employeeId: string;
  amount?: number;
  currency: string;
  components?: Record<string, number> | null;
  effectiveDate?: string | null;
  bankName?: string | null;
  iban?: string | null;
  swiftCode?: string | null;
};

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

export async function createCompensation(
  companyId: string,
  actorId: string,
  input: CreateCompensationInput,
): Promise<HrCompensation> {
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrCompensationTable)
      .values({ ...input, companyId, createdBy: actorId, updatedBy: actorId })
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "compensation",
        entityId: row.id,
        action: "create" as const,
        after: rec(row),
        actorId,
      },
    };
  });
}

export async function updateCompensation(
  companyId: string,
  actorId: string,
  id: string,
  patch: Partial<CreateCompensationInput>,
): Promise<HrCompensation | null> {
  return mutateWithAudit(async (tx) => {
    const [before] = await tx
      .select()
      .from(hrCompensationTable)
      .where(and(eq(hrCompensationTable.id, id), eq(hrCompensationTable.companyId, companyId)));
    if (!before) {
      return {
        result: null,
        audit: { companyId, entityType: "compensation", entityId: id, action: "update" as const, actorId: null },
      };
    }
    const [row] = await tx
      .update(hrCompensationTable)
      .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
      .where(and(eq(hrCompensationTable.id, id), eq(hrCompensationTable.companyId, companyId)))
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "compensation",
        entityId: id,
        action: "update" as const,
        before: rec(before),
        after: rec(row),
        actorId,
      },
    };
  });
}

export async function deleteCompensation(
  companyId: string,
  actorId: string,
  id: string,
): Promise<boolean> {
  return mutateWithAudit(async (tx) => {
    const [before] = await tx
      .select()
      .from(hrCompensationTable)
      .where(and(eq(hrCompensationTable.id, id), eq(hrCompensationTable.companyId, companyId)));
    if (!before) {
      return {
        result: false,
        audit: { companyId, entityType: "compensation", entityId: id, action: "delete" as const, actorId: null },
      };
    }
    await tx
      .delete(hrCompensationTable)
      .where(and(eq(hrCompensationTable.id, id), eq(hrCompensationTable.companyId, companyId)));
    return {
      result: true,
      audit: {
        companyId,
        entityType: "compensation",
        entityId: id,
        action: "delete" as const,
        before: rec(before),
        actorId,
      },
    };
  });
}

export function listCompensation(companyId: string, employeeId?: string): Promise<HrCompensation[]> {
  if (employeeId) {
    return db
      .select()
      .from(hrCompensationTable)
      .where(and(eq(hrCompensationTable.companyId, companyId), eq(hrCompensationTable.employeeId, employeeId)));
  }
  return db.select().from(hrCompensationTable).where(eq(hrCompensationTable.companyId, companyId));
}

export async function getCompensation(companyId: string, id: string): Promise<HrCompensation | null> {
  const [row] = await db
    .select()
    .from(hrCompensationTable)
    .where(and(eq(hrCompensationTable.id, id), eq(hrCompensationTable.companyId, companyId)));
  return row ?? null;
}
