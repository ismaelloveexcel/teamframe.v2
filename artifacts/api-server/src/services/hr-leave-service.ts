import { and, eq } from "drizzle-orm";
import {
  db,
  hrLeaveBalanceTable,
  hrLeaveTable,
  type HrLeave,
  type HrLeaveBalance,
} from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

// UAE statutory leave types + unpaid (matches hr_leave_type pgEnum).
export const LEAVE_TYPES = [
  "annual",
  "sick",
  "maternity",
  "paternity",
  "hajj",
  "bereavement",
  "unpaid",
] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export type CreateLeaveInput = {
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status?: string;
};

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

/**
 * Create a leave record. If the leave is approved and a balance row exists for
 * the (employee, type), decrement balanceDays in the SAME transaction.
 */
export async function createLeave(
  companyId: string,
  actorId: string,
  input: CreateLeaveInput,
): Promise<HrLeave> {
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrLeaveTable)
      .values({ ...input, status: input.status ?? "approved", companyId, createdBy: actorId, updatedBy: actorId })
      .returning();
    if (row.status === "approved") {
      const [bal] = await tx
        .select()
        .from(hrLeaveBalanceTable)
        .where(
          and(
            eq(hrLeaveBalanceTable.companyId, companyId),
            eq(hrLeaveBalanceTable.employeeId, input.employeeId),
            eq(hrLeaveBalanceTable.type, input.type),
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
    const [row] = await tx
      .update(hrLeaveTable)
      .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
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

export type SetBalanceInput = { employeeId: string; type: LeaveType; balanceDays: number };

/** Create or set a leave-balance row for (employee, type). */
export async function setLeaveBalance(
  companyId: string,
  actorId: string,
  input: SetBalanceInput,
): Promise<HrLeaveBalance> {
  return mutateWithAudit(async (tx) => {
    const [existing] = await tx
      .select()
      .from(hrLeaveBalanceTable)
      .where(
        and(
          eq(hrLeaveBalanceTable.companyId, companyId),
          eq(hrLeaveBalanceTable.employeeId, input.employeeId),
          eq(hrLeaveBalanceTable.type, input.type),
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
      .values({ ...input, companyId, createdBy: actorId, updatedBy: actorId })
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
