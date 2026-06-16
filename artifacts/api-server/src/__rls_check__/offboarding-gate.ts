import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrEmployeesTable,
  hrOffboardingTable,
  usersTable,
} from "@workspace/db";
import {
  computeEosg,
  createOffboarding,
  getOffboarding,
} from "../services/hr-offboarding-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Exit Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `exitgate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const [emp] = await db
    .insert(hrEmployeesTable)
    .values({ companyId, employeeNo: "E001", firstName: "Exit", lastName: "Test", createdBy: actorId, updatedBy: actorId })
    .returning();

  // KNOWN CASE A: basic 10,000 AED/mo (1,000,000 fils), exactly 3 years service.
  //   dailyWage = 1,000,000 * 12 / 365 = 32876.712...
  //   days = 3 * 21 = 63 ; gratuity = 63 * dailyWage = 2,071,232.876... -> round 2,071,233
  //   3 years' 21-day accrual is well under the 24-month cap (24,000,000), no cap.
  const basic = 1_000_000;
  const dailyWage = (basic * 12) / 365;
  const expectedA = Math.round(3 * 21 * dailyWage); // 2,071,233
  const a = computeEosg({ basicMonthlyPay: basic, joinDate: "2021-01-01", exitDate: "2024-01-01" });
  // yearsOfService is ~3.003 (1095 days incl leap-year days), assert close to 3 and math holds.
  const passYears = Math.abs(a.yearsOfService - 3) < 0.02;
  const passMathA = a.gratuityAmount === Math.round(a.yearsOfService * 21 * dailyWage) && a.capApplied === false;
  // Sanity vs the hand-computed clean-3-year figure (within rounding of partial day).
  const passApproxA = Math.abs(a.gratuityAmount - expectedA) < dailyWage; // within 1 day's wage

  // KNOWN CASE B: beyond-5-years tier. 10 years service:
  //   first 5y -> 5*21=105 days ; beyond -> 5*30=150 days ; total 255 days.
  //   gratuity = 255 * dailyWage = 8,383,561.6... but cap = basic*24 = 24,000,000 -> no cap.
  const b = computeEosg({ basicMonthlyPay: basic, joinDate: "2014-01-01", exitDate: "2024-01-01" });
  const passTierB =
    Math.abs(b.yearsOfService - 10) < 0.05 &&
    b.gratuityAmount === Math.round((5 * 21 + (b.yearsOfService - 5) * 30) * dailyWage);

  // KNOWN CASE C: cap applied. Very long service forces the 24-month cap.
  //   40 years -> 105 + 35*30 = 1155 days * dailyWage = 37,972,602 > cap 24,000,000.
  const c = computeEosg({ basicMonthlyPay: basic, joinDate: "1984-01-01", exitDate: "2024-01-01" });
  const passCap = c.capApplied === true && c.gratuityAmount === basic * 24;

  // PERSIST a frozen exit record and read back.
  const created = await createOffboarding(companyId, actorId, {
    employeeId: emp.id,
    exitDate: "2024-01-01",
    reason: "resignation",
    eosg: { basicMonthlyPay: basic, joinDate: "2021-01-01", exitDate: "2024-01-01" },
  });
  const readBack = await getOffboarding(companyId, created.id);
  const passFrozen =
    !!readBack &&
    readBack.gratuityAmount === a.gratuityAmount &&
    readBack.exitDate === "2024-01-01" &&
    readBack.reason === "resignation" &&
    (readBack.eosgInputs as Record<string, unknown>)?.basicMonthlyPay === basic &&
    (readBack.eosgInputs as Record<string, unknown>)?.gratuityAmount === a.gratuityAmount;

  console.log("=== Offboarding Gate (Prompt 6) ===");
  console.log(`years-of-service ~3 from dates -> ${passYears ? "PASS" : "FAIL"} (${a.yearsOfService.toFixed(4)})`);
  console.log(`EOSG math (21 days/yr, first 5y), no cap -> ${passMathA ? "PASS" : "FAIL"} (gratuity=${a.gratuityAmount}, ~${expectedA} for clean 3y)`);
  console.log(`EOSG ~3y figure within 1 day's wage of hand calc -> ${passApproxA ? "PASS" : "FAIL"}`);
  console.log(`EOSG 30 days/yr beyond 5y tier (10y) -> ${passTierB ? "PASS" : "FAIL"} (gratuity=${b.gratuityAmount})`);
  console.log(`EOSG capped at 24 months total pay (40y) -> ${passCap ? "PASS" : "FAIL"} (gratuity=${c.gratuityAmount}, cap=${basic * 24})`);
  console.log(`frozen exit record persisted with inputs + computed gratuity -> ${passFrozen ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrOffboardingTable).where(eq(hrOffboardingTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passYears && passMathA && passApproxA && passTierB && passCap && passFrozen;
  console.log(ok ? "=== Offboarding gate PASSED ===" : "=== Offboarding gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
