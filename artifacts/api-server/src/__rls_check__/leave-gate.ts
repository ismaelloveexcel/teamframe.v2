import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrEmployeesTable,
  hrLeaveBalanceTable,
  hrLeaveTable,
  usersTable,
} from "@workspace/db";
import {
  allowedLeaveTypes,
  createLeave,
  listLeave,
  listLeaveBalances,
  setLeaveBalance,
} from "../services/hr-leave-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Leave Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `leavegate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const [emp] = await db
    .insert(hrEmployeesTable)
    .values({ companyId, employeeNo: "E001", firstName: "Leave", lastName: "Test", createdBy: actorId, updatedBy: actorId })
    .returning();

  // Resolve the company's allowed leave types via the compliance provider.
  // jurisdiction=UAE -> the full UAE statutory set (same as before Phase 1).
  const providerTypes = (await allowedLeaveTypes(companyId)).map((t) => t.code);

  // Pre-load statutory balances for all types.
  for (const type of providerTypes) {
    await setLeaveBalance(companyId, actorId, { employeeId: emp.id, type, balanceDays: type === "annual" ? 30 : 10 });
  }
  const balances = await listLeaveBalances(companyId, emp.id);
  const passTypes =
    providerTypes.every((t) => balances.some((b) => b.leaveTypeCode === t)) &&
    ["annual", "sick", "maternity", "paternity", "hajj", "bereavement", "unpaid"].every((t) =>
      providerTypes.includes(t),
    );

  // Create an approved 5-day annual leave -> balance should decrement 30 -> 25.
  const leave = await createLeave(companyId, actorId, {
    employeeId: emp.id,
    type: "annual",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    days: 5,
    status: "approved",
  });
  const passCreate = !!leave && leave.days === 5 && leave.leaveTypeCode === "annual";

  const afterBalances = await listLeaveBalances(companyId, emp.id);
  const annual = afterBalances.find((b) => b.leaveTypeCode === "annual");
  const passDecrement = annual?.balanceDays === 25;

  // Read back leave records.
  const leaves = await listLeave(companyId, emp.id);
  const passRead = leaves.length === 1 && leaves[0]?.id === leave.id;

  console.log("=== Leave Gate (Prompt 6) ===");
  console.log(`statutory types present (annual/sick/maternity/paternity/hajj/bereavement/unpaid) -> ${passTypes ? "PASS" : "FAIL"}`);
  console.log(`create leave (5 days annual, approved) -> ${passCreate ? "PASS" : "FAIL"}`);
  console.log(`balance decremented 30 -> ${annual?.balanceDays} (expect 25) -> ${passDecrement ? "PASS" : "FAIL"}`);
  console.log(`leave read back -> ${passRead ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrLeaveTable).where(eq(hrLeaveTable.companyId, companyId));
  await db.delete(hrLeaveBalanceTable).where(eq(hrLeaveBalanceTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passTypes && passCreate && passDecrement && passRead;
  console.log(ok ? "=== Leave gate PASSED ===" : "=== Leave gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
