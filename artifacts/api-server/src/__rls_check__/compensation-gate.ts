import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrCompensationTable,
  hrEmployeesTable,
  usersTable,
} from "@workspace/db";
import { gateFields } from "../middlewares/rbac.js";
import {
  createCompensation,
  getCompensation,
  updateCompensation,
} from "../services/hr-compensation-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Comp Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `compgate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const [emp] = await db
    .insert(hrEmployeesTable)
    .values({ companyId, employeeNo: "E001", firstName: "Pay", lastName: "Test", createdBy: actorId, updatedBy: actorId })
    .returning();

  // CREATE
  const comp = await createCompensation(companyId, actorId, {
    employeeId: emp.id,
    amount: 2500000, // 25,000 AED in fils
    currency: "AED",
    components: { basic: 1500000, housing: 600000, transport: 200000, airTicket: 100000, allowances: 100000 },
    effectiveDate: "2026-01-01",
    bankName: "Emirates NBD",
    iban: "AE070331234567890123456",
    swiftCode: "EBILAEAD",
  });

  // READ BACK
  const readBack = await getCompensation(companyId, comp.id);
  const passCreate =
    !!readBack &&
    readBack.amount === 2500000 &&
    readBack.currency === "AED" &&
    readBack.components?.basic === 1500000 &&
    readBack.bankName === "Emirates NBD";

  // UPDATE (employee edits bank details)
  await updateCompensation(companyId, actorId, comp.id, { bankName: "ADCB", iban: "AE990123456789012345678" });
  const updated = await getCompensation(companyId, comp.id);
  const passUpdate = updated?.bankName === "ADCB" && updated?.iban === "AE990123456789012345678";

  // FIELD GATE: salary hidden for employee, visible for admin.
  const gate = (role: string) => {
    const req = { sessionActor: { role } } as unknown as Request;
    return gateFields(req, readBack!, {
      amount: ["admin", "super_admin"],
      components: ["admin", "super_admin"],
    });
  };
  const empView = gate("employee");
  const adminView = gate("admin");
  const passGate =
    empView.amount === undefined &&
    empView.components === undefined &&
    empView.bankName === "Emirates NBD" && // bank details still visible to employee
    adminView.amount === 2500000 &&
    adminView.components?.basic === 1500000;

  console.log("=== Compensation Gate (Prompt 6) ===");
  console.log(`create + read back (amount/currency/components/bank) -> ${passCreate ? "PASS" : "FAIL"}`);
  console.log(`update reflected (bank details) -> ${passUpdate ? "PASS" : "FAIL"}`);
  console.log(`field gate: salary hidden for employee, visible for admin -> ${passGate ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrCompensationTable).where(eq(hrCompensationTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passCreate && passUpdate && passGate;
  console.log(ok ? "=== Compensation gate PASSED ===" : "=== Compensation gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
