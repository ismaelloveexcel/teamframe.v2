import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrCompensationTable,
  hrEmployeesTable,
  hrLeaveTable,
  hrOffboardingTable,
  hrReportTable,
  usersTable,
} from "@workspace/db";
import {
  generateExitReport,
  generateFinanceReport,
  getReport,
} from "../services/hr-report-service.js";
import { createOffboarding } from "../services/hr-offboarding-service.js";
import { updateCompensation } from "../services/hr-compensation-service.js";
import { updateEmployee } from "../services/hr-employee-service.js";
import type { ExitReportContent, FinanceReportContent } from "../services/hr-report-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Report Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `reportgate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const [emp] = await db
    .insert(hrEmployeesTable)
    .values({
      companyId,
      employeeNo: "E001",
      firstName: "Reema",
      lastName: "Khan",
      dateOfExit: "2024-06-30",
      status: "Active",
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();

  // Compensation: 12,000 AED/mo (minor units), with components.
  const [comp] = await db
    .insert(hrCompensationTable)
    .values({
      companyId,
      employeeId: emp.id,
      amount: 1_200_000,
      currency: "AED",
      components: { basic: 800_000, housing: 300_000, transport: 100_000 },
      effectiveDate: "2021-01-01",
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();

  const cutoff = "2024-03-31";
  // Unpaid leave IN period (start_date <= cutoff): 3 + 2 = 5 days.
  await db.insert(hrLeaveTable).values([
    { companyId, employeeId: emp.id, type: "unpaid", startDate: "2024-01-10", endDate: "2024-01-12", days: 3, status: "approved", createdBy: actorId, updatedBy: actorId },
    { companyId, employeeId: emp.id, type: "unpaid", startDate: "2024-03-01", endDate: "2024-03-02", days: 2, status: "approved", createdBy: actorId, updatedBy: actorId },
  ]);
  // Unpaid leave OUTSIDE period (start_date > cutoff): 4 days — must NOT count.
  await db.insert(hrLeaveTable).values([
    { companyId, employeeId: emp.id, type: "unpaid", startDate: "2024-05-01", endDate: "2024-05-04", days: 4, status: "approved", createdBy: actorId, updatedBy: actorId },
  ]);
  // A NON-unpaid (annual) leave in period — must NOT count either.
  await db.insert(hrLeaveTable).values([
    { companyId, employeeId: emp.id, type: "annual", startDate: "2024-02-01", endDate: "2024-02-05", days: 5, status: "approved", createdBy: actorId, updatedBy: actorId },
  ]);

  const EXPECTED_UNPAID_IN_PERIOD = 5;

  // Frozen offboarding exit record (source for the exit report).
  await createOffboarding(companyId, actorId, {
    employeeId: emp.id,
    exitDate: "2024-06-30",
    reason: "resignation",
    eosg: { basicMonthlyPay: 800_000, joinDate: "2021-01-01", exitDate: "2024-06-30" },
  });

  // ── 1. Finance report ─────────────────────────────────────────────────────
  const finance = await generateFinanceReport(companyId, actorId, cutoff);
  const fc = finance.content as FinanceReportContent;
  const line = fc.lines.find((l) => l.employeeId === emp.id)!;
  const passFinanceUnpaid =
    line.unpaidLeaveDays === EXPECTED_UNPAID_IN_PERIOD &&
    fc.totals.totalUnpaidLeaveDays === EXPECTED_UNPAID_IN_PERIOD;
  const passFinanceComp =
    line.amount === 1_200_000 &&
    line.currency === "AED" &&
    (line.components as Record<string, number>)?.basic === 800_000;

  // ── 2. Exit report (frozen at exit_date) ──────────────────────────────────
  const exit = await generateExitReport(companyId, actorId, emp.id);
  const ec = exit.content as ExitReportContent;
  const passExitFrozen =
    ec.exitDate === "2024-06-30" &&
    (ec.employee as Record<string, unknown>).lastName === "Khan" &&
    ec.offboarding != null &&
    (ec.offboarding as Record<string, unknown>).reason === "resignation" &&
    ec.compensation.length === 1 &&
    (ec.compensation[0] as Record<string, unknown>).amount === 1_200_000;

  // ── 3. KEY TEST: edit source records AFTER generation; reports stay frozen ─
  await updateEmployee(companyId, actorId, emp.id, { lastName: "Al-Mansoori" });
  await updateCompensation(companyId, actorId, comp.id, { amount: 9_999_999 });

  // Re-read the STORED reports — content must be UNCHANGED.
  const financeReread = await getReport(companyId, finance.id);
  const exitReread = await getReport(companyId, exit.id);
  const frc = financeReread!.content as FinanceReportContent;
  const erc = exitReread!.content as ExitReportContent;
  const frozenLine = frc.lines.find((l) => l.employeeId === emp.id)!;

  const passFrozenAfterEdit =
    frozenLine.amount === 1_200_000 && // NOT 9,999,999
    frozenLine.name === "Reema Khan" && // NOT Al-Mansoori
    (erc.employee as Record<string, unknown>).lastName === "Khan" &&
    (erc.compensation[0] as Record<string, unknown>).amount === 1_200_000;

  // Live source DB reflects the edits (DB stays mutable).
  const [liveEmp] = await db
    .select()
    .from(hrEmployeesTable)
    .where(eq(hrEmployeesTable.id, emp.id));
  const [liveComp] = await db
    .select()
    .from(hrCompensationTable)
    .where(eq(hrCompensationTable.id, comp.id));
  const passLiveChanged = liveEmp.lastName === "Al-Mansoori" && liveComp.amount === 9_999_999;

  // Audit log captured the later updates (and the report generations).
  const audit = await db
    .select()
    .from(hrAuditLogTable)
    .where(eq(hrAuditLogTable.companyId, companyId));
  const empUpdate = audit.find(
    (a) => a.entityType === "employee" && a.entityId === emp.id && a.action === "update",
  );
  const compUpdate = audit.find(
    (a) => a.entityType === "compensation" && a.entityId === comp.id && a.action === "update",
  );
  const reportCreates = audit.filter((a) => a.entityType === "report" && a.action === "create");
  const passAudit =
    !!empUpdate &&
    (empUpdate.after as Record<string, unknown>)?.lastName === "Al-Mansoori" &&
    !!compUpdate &&
    (compUpdate.after as Record<string, unknown>)?.amount === 9_999_999 &&
    reportCreates.length === 2;

  console.log("=== Report Gate (Prompt 7) ===");
  console.log(`finance: unpaid-leave days counted only IN period (=${EXPECTED_UNPAID_IN_PERIOD}) -> ${passFinanceUnpaid ? "PASS" : "FAIL"} (got ${line.unpaidLeaveDays})`);
  console.log(`finance: compensation components serialized -> ${passFinanceComp ? "PASS" : "FAIL"} (amount=${line.amount} ${line.currency})`);
  console.log(`exit: record serialized + frozen at exit_date -> ${passExitFrozen ? "PASS" : "FAIL"} (exitDate=${ec.exitDate})`);
  console.log(`FROZEN: editing source records leaves stored report UNCHANGED -> ${passFrozenAfterEdit ? "PASS" : "FAIL"} (frozen amount=${frozenLine.amount}, name=${frozenLine.name})`);
  console.log(`live DB reflects the edits (DB stays mutable) -> ${passLiveChanged ? "PASS" : "FAIL"} (live amount=${liveComp.amount}, name=${liveEmp.lastName})`);
  console.log(`audit log captured the later updates + report generations -> ${passAudit ? "PASS" : "FAIL"} (report creates=${reportCreates.length})`);

  // cleanup (delete audit rows, report rows, source rows, then company)
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrReportTable).where(eq(hrReportTable.companyId, companyId));
  await db.delete(hrOffboardingTable).where(eq(hrOffboardingTable.companyId, companyId));
  await db.delete(hrLeaveTable).where(eq(hrLeaveTable.companyId, companyId));
  await db.delete(hrCompensationTable).where(eq(hrCompensationTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok =
    passFinanceUnpaid &&
    passFinanceComp &&
    passExitFrozen &&
    passFrozenAfterEdit &&
    passLiveChanged &&
    passAudit;
  console.log(ok ? "=== Report gate PASSED ===" : "=== Report gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
