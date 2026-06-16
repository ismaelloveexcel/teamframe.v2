import { and, eq, lte } from "drizzle-orm";
import {
  db,
  hrCompensationTable,
  hrEmployeesTable,
  hrLeaveTable,
  hrOffboardingTable,
  hrReportTable,
  type HrReport,
} from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

/**
 * Reports are SELECT + render — no engines, no live recomputation. A generated
 * report is FROZEN: its serialized output is stored in hr_report.content at
 * generation time. The DB stays mutable; editing a source record AFTER
 * generation does NOT change the already-generated report (the audit log
 * captures the later change). Generation goes through mutateWithAudit so each
 * report creation is one audit row.
 */

// ── Finance / payroll report ────────────────────────────────────────────────

export type FinanceReportContent = {
  reportKind: "finance";
  companyId: string;
  periodCutoff: string;
  generatedAt: string;
  lines: Array<{
    employeeId: string;
    employeeNo: string;
    name: string;
    currency: string | null;
    amount: number;
    components: Record<string, number> | null;
    unpaidLeaveDays: number;
  }>;
  totals: {
    employees: number;
    grossAmount: number;
    totalUnpaidLeaveDays: number;
  };
};

/**
 * Generate the Finance handoff for a company + period cutoff date.
 * For each employee: their compensation components + the count of unpaid-leave
 * days for the period (WHERE leave start_date <= cutoff AND type = 'unpaid').
 * The rendered result is persisted as a FROZEN hr_report row (kind='finance').
 */
export async function generateFinanceReport(
  companyId: string,
  actorId: string,
  periodCutoff: string,
): Promise<HrReport> {
  // SELECT source data (RLS-scoped, companyId on every query).
  const employees = await db
    .select()
    .from(hrEmployeesTable)
    .where(eq(hrEmployeesTable.companyId, companyId));

  const compensation = await db
    .select()
    .from(hrCompensationTable)
    .where(eq(hrCompensationTable.companyId, companyId));

  // Unpaid leave whose period falls on/before the cutoff.
  const unpaidLeave = await db
    .select()
    .from(hrLeaveTable)
    .where(
      and(
        eq(hrLeaveTable.companyId, companyId),
        eq(hrLeaveTable.leaveTypeCode, "unpaid"),
        lte(hrLeaveTable.startDate, periodCutoff),
      ),
    );

  const compByEmployee = new Map<string, (typeof compensation)[number]>();
  for (const c of compensation) compByEmployee.set(c.employeeId, c);

  const unpaidDaysByEmployee = new Map<string, number>();
  for (const l of unpaidLeave) {
    unpaidDaysByEmployee.set(l.employeeId, (unpaidDaysByEmployee.get(l.employeeId) ?? 0) + l.days);
  }

  const lines: FinanceReportContent["lines"] = employees.map((e) => {
    const comp = compByEmployee.get(e.id);
    return {
      employeeId: e.id,
      employeeNo: e.employeeNo,
      name: `${e.firstName} ${e.lastName}`,
      currency: comp?.currency ?? null,
      amount: comp?.amount ?? 0,
      components: comp?.components ?? null,
      unpaidLeaveDays: unpaidDaysByEmployee.get(e.id) ?? 0,
    };
  });

  const content: FinanceReportContent = {
    reportKind: "finance",
    companyId,
    periodCutoff,
    generatedAt: new Date().toISOString(),
    lines,
    totals: {
      employees: lines.length,
      grossAmount: lines.reduce((s, l) => s + l.amount, 0),
      totalUnpaidLeaveDays: lines.reduce((s, l) => s + l.unpaidLeaveDays, 0),
    },
  };

  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrReportTable)
      .values({
        companyId,
        kind: "finance",
        subjectId: null,
        periodCutoff,
        content: rec(content),
        generatedBy: actorId,
      })
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "report",
        entityId: row.id,
        action: "create" as const,
        after: rec(row),
        actorId,
      },
    };
  });
}

// ── Exit report ─────────────────────────────────────────────────────────────

export type ExitReportContent = {
  reportKind: "exit";
  companyId: string;
  employeeId: string;
  exitDate: string | null;
  generatedAt: string;
  employee: Record<string, unknown>;
  offboarding: Record<string, unknown> | null;
  compensation: Record<string, unknown>[];
};

/**
 * Serialize an employee's FULL record at their exit_date into a FROZEN
 * document persisted as an hr_report row (kind='exit'). Pulls from
 * hr_offboarding + hr_employees + their compensation history.
 */
export async function generateExitReport(
  companyId: string,
  actorId: string,
  employeeId: string,
): Promise<HrReport> {
  const [employee] = await db
    .select()
    .from(hrEmployeesTable)
    .where(and(eq(hrEmployeesTable.id, employeeId), eq(hrEmployeesTable.companyId, companyId)));
  if (!employee) {
    throw new Error("Employee not found");
  }

  const [offboarding] = await db
    .select()
    .from(hrOffboardingTable)
    .where(
      and(eq(hrOffboardingTable.employeeId, employeeId), eq(hrOffboardingTable.companyId, companyId)),
    );

  const compensation = await db
    .select()
    .from(hrCompensationTable)
    .where(
      and(eq(hrCompensationTable.employeeId, employeeId), eq(hrCompensationTable.companyId, companyId)),
    );

  const exitDate = offboarding?.exitDate ?? employee.dateOfExit ?? null;

  const content: ExitReportContent = {
    reportKind: "exit",
    companyId,
    employeeId,
    exitDate,
    generatedAt: new Date().toISOString(),
    employee: rec(employee),
    offboarding: offboarding ? rec(offboarding) : null,
    compensation: compensation.map(rec),
  };

  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrReportTable)
      .values({
        companyId,
        kind: "exit",
        subjectId: employeeId,
        periodCutoff: null,
        content: rec(content),
        generatedBy: actorId,
      })
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "report",
        entityId: row.id,
        action: "create" as const,
        after: rec(row),
        actorId,
      },
    };
  });
}

// ── Read ────────────────────────────────────────────────────────────────────

export function listReports(companyId: string, kind?: "finance" | "exit"): Promise<HrReport[]> {
  if (kind) {
    return db
      .select()
      .from(hrReportTable)
      .where(and(eq(hrReportTable.companyId, companyId), eq(hrReportTable.kind, kind)));
  }
  return db.select().from(hrReportTable).where(eq(hrReportTable.companyId, companyId));
}

export async function getReport(companyId: string, id: string): Promise<HrReport | null> {
  const [row] = await db
    .select()
    .from(hrReportTable)
    .where(and(eq(hrReportTable.id, id), eq(hrReportTable.companyId, companyId)));
  return row ?? null;
}
