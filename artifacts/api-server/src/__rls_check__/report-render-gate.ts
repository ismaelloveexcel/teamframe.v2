import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
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
import { renderReportHtml } from "../services/hr-report-render.js";
import { createOffboarding } from "../services/hr-offboarding-service.js";
import { updateCompensation } from "../services/hr-compensation-service.js";
import { updateEmployee } from "../services/hr-employee-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Lumière Holdings", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `rendergate-${companyId}@test.internal`, status: "active" })
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
      nationality: "Emirati",
      joinDate: "2021-01-01",
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
  await db.insert(hrLeaveTable).values([
    { companyId, employeeId: emp.id, leaveTypeCode: "unpaid", startDate: "2024-01-10", endDate: "2024-01-12", days: 3, status: "approved", createdBy: actorId, updatedBy: actorId },
    { companyId, employeeId: emp.id, leaveTypeCode: "unpaid", startDate: "2024-03-01", endDate: "2024-03-02", days: 2, status: "approved", createdBy: actorId, updatedBy: actorId },
  ]);

  // Frozen offboarding exit record (source for the exit report). EOSG computed
  // at write time from basic monthly pay 8,000 AED, ~3.49 years of service.
  const off = await createOffboarding(companyId, actorId, {
    employeeId: emp.id,
    exitDate: "2024-06-30",
    reason: "resignation",
    eosg: { basicMonthlyPay: 800_000, joinDate: "2021-01-01", exitDate: "2024-06-30" },
  });
  const expectedGratuity = off.eosg!.gratuityAmount; // minor units (UAE company)

  // ── Generate FROZEN reports ────────────────────────────────────────────────
  const finance = await generateFinanceReport(companyId, actorId, cutoff);
  const exit = await generateExitReport(companyId, actorId, emp.id);

  // Render WITHOUT letterhead opts so the asserted bytes derive solely from the
  // frozen content (determinism + frozen checks are about the financial data).
  const financeHtml1 = renderReportHtml(finance);
  const exitHtml1 = renderReportHtml(exit);

  // Pre-compute expected formatted strings.
  const fmtGross = "AED 12,000.00";
  const fmtGratuity = formatExpectedMoney(expectedGratuity);

  // ── 1. CONTAINS frozen values ──────────────────────────────────────────────
  const passFinanceContains =
    financeHtml1.includes("Reema Khan") &&
    financeHtml1.includes("E001") &&
    financeHtml1.includes("31 Mar 2024") && // period cutoff formatted
    financeHtml1.includes(fmtGross); // gross compensation formatted from minor units
  const passFinanceComponents =
    financeHtml1.includes("Basic AED 8,000.00") &&
    financeHtml1.includes("Housing AED 3,000.00") &&
    financeHtml1.includes("Transport AED 1,000.00") &&
    financeHtml1.includes("<!DOCTYPE html>") &&
    financeHtml1.includes("Frozen as of 31 Mar 2024");

  const passExitContains =
    exitHtml1.includes("Reema Khan") &&
    exitHtml1.includes("E001") &&
    exitHtml1.includes("30 Jun 2024") && // exit date formatted
    exitHtml1.includes("1 Jan 2021") && // join date formatted
    exitHtml1.includes("3 years, 5 months") && // tenure
    exitHtml1.includes(fmtGratuity) && // EOSG gratuity formatted from minor units
    exitHtml1.includes("Resignation") && // humanized reason
    exitHtml1.includes("Certificate of Service");

  // ── 2. DETERMINISM: same stored report renders byte-identical HTML ──────────
  const financeReread1 = await getReport(companyId, finance.id);
  const financeHtml2 = renderReportHtml(financeReread1!);
  const exitReread1 = await getReport(companyId, exit.id);
  const exitHtml2 = renderReportHtml(exitReread1!);
  const passDeterministic =
    Buffer.from(financeHtml1).equals(Buffer.from(financeHtml2)) &&
    Buffer.from(exitHtml1).equals(Buffer.from(exitHtml2));

  // ── 3. FROZEN: mutate live source AFTER render; re-render is UNCHANGED ──────
  await updateEmployee(companyId, actorId, emp.id, { lastName: "Al-Mansoori" });
  await updateCompensation(companyId, actorId, comp.id, { amount: 9_999_999 });

  const financeReread2 = await getReport(companyId, finance.id);
  const exitReread2 = await getReport(companyId, exit.id);
  const financeHtml3 = renderReportHtml(financeReread2!);
  const exitHtml3 = renderReportHtml(exitReread2!);

  const passFrozen =
    Buffer.from(financeHtml1).equals(Buffer.from(financeHtml3)) &&
    Buffer.from(exitHtml1).equals(Buffer.from(exitHtml3)) &&
    financeHtml3.includes("Reema Khan") && // NOT Al-Mansoori
    !financeHtml3.includes("Al-Mansoori") &&
    financeHtml3.includes(fmtGross) && // NOT 99,999.99
    !financeHtml3.includes("99,999.99");

  // Live DB reflects the edits (DB stays mutable).
  const [liveEmp] = await db.select().from(hrEmployeesTable).where(eq(hrEmployeesTable.id, emp.id));
  const [liveComp] = await db.select().from(hrCompensationTable).where(eq(hrCompensationTable.id, comp.id));
  const passLiveChanged = liveEmp.lastName === "Al-Mansoori" && liveComp.amount === 9_999_999;

  console.log("=== Report Render Gate (UX polish) ===");
  console.log(`finance HTML contains frozen employee/cutoff/gross -> ${passFinanceContains ? "PASS" : "FAIL"} (gross=${fmtGross}, cutoff=31 Mar 2024)`);
  console.log(`finance HTML contains formatted components + frozen stamp -> ${passFinanceComponents ? "PASS" : "FAIL"} (Basic AED 8,000.00 ...)`);
  console.log(`exit HTML contains identity/dates/tenure/EOSG -> ${passExitContains ? "PASS" : "FAIL"} (gratuity=${fmtGratuity})`);
  console.log(`DETERMINISM: same stored report -> byte-identical HTML -> ${passDeterministic ? "PASS" : "FAIL"}`);
  console.log(`FROZEN: mutate source -> re-rendered HTML UNCHANGED -> ${passFrozen ? "PASS" : "FAIL"} (still shows ${fmtGross} / Reema Khan)`);
  console.log(`live DB reflects the edits (DB stays mutable) -> ${passLiveChanged ? "PASS" : "FAIL"} (live amount=${liveComp.amount}, name=${liveEmp.lastName})`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrReportTable).where(eq(hrReportTable.companyId, companyId));
  await db.delete(hrOffboardingTable).where(eq(hrOffboardingTable.companyId, companyId));
  await db.delete(hrLeaveTable).where(eq(hrLeaveTable.companyId, companyId));
  await db.delete(hrCompensationTable).where(eq(hrCompensationTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok =
    passFinanceContains &&
    passFinanceComponents &&
    passExitContains &&
    passDeterministic &&
    passFrozen &&
    passLiveChanged;
  console.log(ok ? "=== Report render gate PASSED ===" : "=== Report render gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

// Local mirror of the money formatter for the EXPECTED value (independent of
// the renderer's import path), so the assertion proves the rendered output
// equals an independently-derived expectation.
function formatExpectedMoney(minor: number): string {
  const whole = Math.trunc(minor / 100);
  const frac = String(minor % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `AED ${grouped}.${frac}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
