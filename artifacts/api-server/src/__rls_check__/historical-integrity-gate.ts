import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrCompensationTable,
  hrEmployeesTable,
  hrOffboardingTable,
  hrReportTable,
  usersTable,
} from "@workspace/db";
import { createOffboarding, getOffboarding } from "../services/hr-offboarding-service.js";
import { generateExitReport, generateFinanceReport, getReport } from "../services/hr-report-service.js";
import { renderReportHtml } from "../services/hr-report-render.js";

async function main() {
  // ── Phase A: a UAE company generates a frozen offboarding + reports ────────
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Integrity Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `integrity-${companyId}@test.internal`, status: "active" })
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

  const [comp] = await db
    .insert(hrCompensationTable)
    .values({
      companyId,
      employeeId: emp.id,
      amount: 1_200_000,
      currency: "AED",
      components: { basic: 800_000, housing: 300_000, transport: 100_000 },
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();

  // Frozen offboarding (UAE EOSG computed at write time).
  const off = await createOffboarding(companyId, actorId, {
    employeeId: emp.id,
    exitDate: "2024-06-30",
    reason: "resignation",
    eosg: { basicMonthlyPay: 800_000, joinDate: "2021-01-01", exitDate: "2024-06-30" },
  });

  // Generate frozen reports + render exit report HTML.
  const finance = await generateFinanceReport(companyId, actorId, "2024-03-31");
  const exit = await generateExitReport(companyId, actorId, emp.id);
  const financeHtmlBefore = renderReportHtml(finance);
  const exitHtmlBefore = renderReportHtml(exit);

  // Capture stored values + report bytes.
  const offBefore = await getOffboarding(companyId, off.id);
  const storedGratuityBefore = offBefore!.gratuityAmount;
  const storedMethodBefore = offBefore!.calculationMethod;
  const eosgInputsBefore = JSON.stringify(offBefore!.eosgInputs);
  const financeContentBefore = JSON.stringify((await getReport(companyId, finance.id))!.content);
  const exitContentBefore = JSON.stringify((await getReport(companyId, exit.id))!.content);

  const passUaeStored = storedGratuityBefore !== null && storedMethodBefore === "uae_eosg";

  // ── Phase B: flip jurisdiction to MU, re-run the provider path ─────────────
  await db.update(companiesTable).set({ jurisdiction: "MU" }).where(eq(companiesTable.id, companyId));

  // A NEW offboarding under MU must be manual/null — but the OLD record is frozen.
  const offMu = await createOffboarding(companyId, actorId, {
    employeeId: emp.id,
    exitDate: "2024-06-30",
    reason: "resignation",
    eosg: { basicMonthlyPay: 800_000, joinDate: "2021-01-01", exitDate: "2024-06-30" },
  });
  const passNewManual = offMu.gratuityAmount === null && offMu.calculationMethod === "manual";

  // Re-read EVERYTHING and assert byte/value identity of the pre-existing record.
  const offAfter = await getOffboarding(companyId, off.id);
  const passGratuityUnchanged =
    offAfter!.gratuityAmount === storedGratuityBefore &&
    offAfter!.calculationMethod === storedMethodBefore &&
    JSON.stringify(offAfter!.eosgInputs) === eosgInputsBefore;

  const financeAfter = await getReport(companyId, finance.id);
  const exitAfter = await getReport(companyId, exit.id);
  const passContentUnchanged =
    JSON.stringify(financeAfter!.content) === financeContentBefore &&
    JSON.stringify(exitAfter!.content) === exitContentBefore;

  const financeHtmlAfter = renderReportHtml(financeAfter!);
  const exitHtmlAfter = renderReportHtml(exitAfter!);
  const passHtmlByteIdentical =
    Buffer.from(financeHtmlBefore).equals(Buffer.from(financeHtmlAfter)) &&
    Buffer.from(exitHtmlBefore).equals(Buffer.from(exitHtmlAfter));

  console.log("=== Historical Integrity Gate (Phase 1) ===");
  console.log(`UAE company stored gratuity + method (uae_eosg) -> ${passUaeStored ? "PASS" : "FAIL"} (${storedGratuityBefore}/${storedMethodBefore})`);
  console.log(`after jurisdiction->MU, NEW offboarding is manual/null -> ${passNewManual ? "PASS" : "FAIL"} (${offMu.gratuityAmount}/${offMu.calculationMethod})`);
  console.log(`PRIOR offboarding gratuity + inputs UNCHANGED -> ${passGratuityUnchanged ? "PASS" : "FAIL"} (${offAfter!.gratuityAmount})`);
  console.log(`PRIOR report content UNCHANGED -> ${passContentUnchanged ? "PASS" : "FAIL"}`);
  console.log(`PRIOR rendered HTML byte-for-byte identical -> ${passHtmlByteIdentical ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrReportTable).where(eq(hrReportTable.companyId, companyId));
  await db.delete(hrOffboardingTable).where(eq(hrOffboardingTable.companyId, companyId));
  await db.delete(hrCompensationTable).where(eq(hrCompensationTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok =
    passUaeStored && passNewManual && passGratuityUnchanged && passContentUnchanged && passHtmlByteIdentical;
  console.log(ok ? "=== Historical integrity gate PASSED ===" : "=== Historical integrity gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
