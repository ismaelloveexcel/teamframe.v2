import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  hrEmployeesTable,
  hrPositionAssignmentsTable,
  membershipsTable,
  usersTable,
  type HrEmployee,
  type HrPositionAssignment,
} from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

export type CreateEmployeeInput = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  nationality?: string | null;
  personalEmail?: string | null;
  companyEmail?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  emergencyContacts?: Record<string, unknown>[] | null;
  joinDate?: string | null;
  status?: string;
};

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

export async function createEmployee(
  companyId: string,
  actorId: string,
  input: CreateEmployeeInput,
): Promise<HrEmployee> {
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrEmployeesTable)
      .values({ ...input, companyId, createdBy: actorId, updatedBy: actorId })
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "employee",
        entityId: row.id,
        action: "create" as const,
        after: rec(row),
        actorId,
      },
    };
  });
}

export async function updateEmployee(
  companyId: string,
  actorId: string,
  id: string,
  patch: Partial<CreateEmployeeInput>,
): Promise<HrEmployee | null> {
  return mutateWithAudit(async (tx) => {
    const [before] = await tx
      .select()
      .from(hrEmployeesTable)
      .where(and(eq(hrEmployeesTable.id, id), eq(hrEmployeesTable.companyId, companyId)));
    if (!before) {
      return {
        result: null,
        audit: { companyId, entityType: "employee", entityId: id, action: "update" as const, actorId: null },
      };
    }
    const [row] = await tx
      .update(hrEmployeesTable)
      .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
      .where(and(eq(hrEmployeesTable.id, id), eq(hrEmployeesTable.companyId, companyId)))
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "employee",
        entityId: id,
        action: "update" as const,
        before: rec(before),
        after: rec(row),
        actorId,
      },
    };
  });
}

export function listEmployees(companyId: string): Promise<HrEmployee[]> {
  return db.select().from(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
}

export async function getEmployee(companyId: string, id: string): Promise<HrEmployee | null> {
  const [row] = await db
    .select()
    .from(hrEmployeesTable)
    .where(and(eq(hrEmployeesTable.id, id), eq(hrEmployeesTable.companyId, companyId)));
  return row ?? null;
}

/**
 * Assign an employee to a position. REASSIGNMENT RULE (build-spec §3): never
 * overwrite — if an active assignment exists (end_date IS NULL), end-date it and
 * insert a NEW row. History is preserved by rows.
 */
export async function assign(
  companyId: string,
  actorId: string,
  employeeId: string,
  positionId: string,
  startDate: string,
): Promise<HrPositionAssignment> {
  return mutateWithAudit(async (tx) => {
    const [active] = await tx
      .select()
      .from(hrPositionAssignmentsTable)
      .where(
        and(
          eq(hrPositionAssignmentsTable.companyId, companyId),
          eq(hrPositionAssignmentsTable.employeeId, employeeId),
          isNull(hrPositionAssignmentsTable.endDate),
        ),
      );
    let endedBefore: HrPositionAssignment | null = null;
    if (active) {
      await tx
        .update(hrPositionAssignmentsTable)
        .set({ endDate: startDate, updatedBy: actorId, updatedAt: new Date() })
        .where(eq(hrPositionAssignmentsTable.id, active.id));
      endedBefore = active;
    }
    const [created] = await tx
      .insert(hrPositionAssignmentsTable)
      .values({ companyId, employeeId, positionId, startDate, createdBy: actorId, updatedBy: actorId })
      .returning();
    return {
      result: created,
      audit: {
        companyId,
        entityType: "assignment",
        entityId: created.id,
        action: "create" as const,
        before: endedBefore ? rec(endedBefore) : null,
        after: rec(created),
        actorId,
      },
    };
  });
}

export function assignmentHistory(companyId: string, employeeId: string): Promise<HrPositionAssignment[]> {
  return db
    .select()
    .from(hrPositionAssignmentsTable)
    .where(
      and(
        eq(hrPositionAssignmentsTable.companyId, companyId),
        eq(hrPositionAssignmentsTable.employeeId, employeeId),
      ),
    );
}

/**
 * Employee -> User invite. Creates an 'invited' user + 'employee' membership and
 * links hr_employees.user_id. The user activates credentials separately.
 */
export async function invite(
  companyId: string,
  actorId: string,
  employeeId: string,
): Promise<{ userId: string } | null> {
  return mutateWithAudit(async (tx) => {
    const [emp] = await tx
      .select()
      .from(hrEmployeesTable)
      .where(and(eq(hrEmployeesTable.id, employeeId), eq(hrEmployeesTable.companyId, companyId)));
    if (!emp) {
      return {
        result: null,
        audit: { companyId, entityType: "employee", entityId: employeeId, action: "update" as const, actorId: null },
      };
    }
    const email = emp.companyEmail ?? emp.personalEmail ?? `${emp.employeeNo}@invite.local`;
    const [user] = await tx.insert(usersTable).values({ email, status: "invited" }).returning();
    await tx.insert(membershipsTable).values({ userId: user.id, companyId, role: "employee" });
    const [updated] = await tx
      .update(hrEmployeesTable)
      .set({ userId: user.id, updatedBy: actorId, updatedAt: new Date() })
      .where(eq(hrEmployeesTable.id, employeeId))
      .returning();
    return {
      result: { userId: user.id },
      audit: {
        companyId,
        entityType: "employee",
        entityId: employeeId,
        action: "update" as const,
        before: rec(emp),
        after: rec(updated),
        actorId,
      },
    };
  });
}
