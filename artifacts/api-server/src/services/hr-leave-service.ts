import { and, eq } from "drizzle-orm";
import {
  db,
  hrLeaveBalanceTable,
  hrLeaveTable,
  type HrLeave,
  type HrLeaveBalance,
} from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";
import { resolveProviderForCompany, type LeaveType } from "../compliance/index.js";
import { badRequest } from "../lib/http-error.js";

export type { LeaveType };

export type CreateLeaveInput = {
  employeeId: string;
  type: string; // leave_type_code; validated against the company's allowed set
  startDate: string;
  endDate: string;
  days: number;
  status?: string;
};

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

/**
 * The set of leave types a company may use = its jurisdiction provider's leave
 * types (global defaults) UNION any company-specific overrides (active).
 * getLeaveTypes already performs that union.
 */
export async function allowedLeaveTypes(companyId: string): Promise<LeaveType[]> {
  const provider = await resolveProviderForCompany(companyId);
  return provider.getLeaveTypes(companyId);
}

async function assertAllowedCode(companyId: string, code: string): Promise<void> {
  const allowed = await allowedLeaveTypes(companyId);
  if (!allowed.some((t) => t.code === code)) {
    badRequest(`Unknown leave type "${code}" for this company`);
  }
}

/**
 * Create a leave record. If the leave is approved and a balance row exists for
 * the (employee, code), decrement balanceDays in the SAME transaction.
 */
export async function createLeave(
  companyId: string,
  actorId: string,
  input: CreateLeaveInput,
): Promise<HrLeave> {
  await assertAllowedCode(companyId, input.type);
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrLeaveTable)
      .values({
        companyId,
        employeeId: input.employeeId,
        leaveTypeCode: input.type,
        startDate: input.startDate,
        endDate: input.endDate,
        days: input.days,
        status: input.status ?? "approved",
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    if (row.status === "approved") {
      const [bal] = await tx
        .select()
        .from(hrLeaveBalanceTable)
        .where(
          and(
            eq(hrLeaveBalanceTable.companyId, companyId),
            eq(hrLeaveBalanceTable.employeeId, input.employeeId),
            eq(hrLeaveBalanceTable.leaveTypeCode, input.type),
          ),
        );
      if (bal) {
        await tx
          .update(hrLeaveBalanceTable)
          .set({ balanceDays: bal.balanceDays - input.days, updatedBy: actorId, updatedAt: new Date() })
          .where(eq(hrLeaveBalanceTable.id, bal.id));
      }
    }
    return {
      result: row,
      audit: {
        companyId,
        entityType: "leave",
        entityId: row.id,
        action: "create" as const,
        after: rec(row),
        actorId,
      },
    };
  });
}

export async function updateLeave(
  companyId: string,
  actorId: string,
  id: string,
  patch: Partial<CreateLeaveInput>,
): Promise<HrLeave | null> {
  if (patch.type != null) await assertAllowedCode(companyId, patch.type);
  return mutateWithAudit(async (tx) => {
    const [before] = await tx
      .select()
      .from(hrLeaveTable)
      .where(and(eq(hrLeaveTable.id, id), eq(hrLeaveTable.companyId, companyId)));
    if (!before) {
      return {
        result: null,
        audit: { companyId, entityType: "leave", entityId: id, action: "update" as const, actorId: null },
      };
    }
    const { type, ...restPatch } = patch;
    const [row] = await tx
      .update(hrLeaveTable)
      .set({
        ...restPatch,
        ...(type != null ? { leaveTypeCode: type } : {}),
        updatedBy: actorId,
        updatedAt: new Date(),
      })
      .where(and(eq(hrLeaveTable.id, id), eq(hrLeaveTable.companyId, companyId)))
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "leave",
        entityId: id,
        action: "update" as const,
        before: rec(before),
        after: rec(row),
        actorId,
      },
    };
  });
}

export function listLeave(companyId: string, employeeId?: string): Promise<HrLeave[]> {
  if (employeeId) {
    return db
      .select()
      .from(hrLeaveTable)
      .where(and(eq(hrLeaveTable.companyId, companyId), eq(hrLeaveTable.employeeId, employeeId)));
  }
  return db.select().from(hrLeaveTable).where(eq(hrLeaveTable.companyId, companyId));
}

export async function getLeave(companyId: string, id: string): Promise<HrLeave | null> {
  const [row] = await db
    .select()
    .from(hrLeaveTable)
    .where(and(eq(hrLeaveTable.id, id), eq(hrLeaveTable.companyId, companyId)));
  return row ?? null;
}

// ── Leave balance ─────────────────────────────────────────────────────────

export type SetBalanceInput = { employeeId: string; type: string; balanceDays: number };

/** Create or set a leave-balance row for (employee, code). */
export async function setLeaveBalance(
  companyId: string,
  actorId: string,
  input: SetBalanceInput,
): Promise<HrLeaveBalance> {
  await assertAllowedCode(companyId, input.type);
  return mutateWithAudit(async (tx) => {
    const [existing] = await tx
      .select()
      .from(hrLeaveBalanceTable)
      .where(
        and(
          eq(hrLeaveBalanceTable.companyId, companyId),
          eq(hrLeaveBalanceTable.employeeId, input.employeeId),
          eq(hrLeaveBalanceTable.leaveTypeCode, input.type),
        ),
      );
    if (existing) {
      const [row] = await tx
        .update(hrLeaveBalanceTable)
        .set({ balanceDays: input.balanceDays, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(hrLeaveBalanceTable.id, existing.id))
        .returning();
      return {
        result: row,
        audit: {
          companyId,
          entityType: "leave_balance",
          entityId: row.id,
          action: "update" as const,
          before: rec(existing),
          after: rec(row),
          actorId,
        },
      };
    }
    const [row] = await tx
      .insert(hrLeaveBalanceTable)
      .values({
        companyId,
        employeeId: input.employeeId,
        leaveTypeCode: input.type,
        balanceDays: input.balanceDays,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "leave_balance",
        entityId: row.id,
        action: "create" as const,
        after: rec(row),
        actorId,
      },
    };
  });
}

export function listLeaveBalances(companyId: string, employeeId?: string): Promise<HrLeaveBalance[]> {
  if (employeeId) {
    return db
      .select()
      .from(hrLeaveBalanceTable)
      .where(and(eq(hrLeaveBalanceTable.companyId, companyId), eq(hrLeaveBalanceTable.employeeId, employeeId)));
  }
  return db.select().from(hrLeaveBalanceTable).where(eq(hrLeaveBalanceTable.companyId, companyId));
}
