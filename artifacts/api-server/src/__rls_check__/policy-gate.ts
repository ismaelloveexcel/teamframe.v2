import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrEmployeesTable,
  hrPolicyAcknowledgementTable,
  hrPolicyTable,
  usersTable,
} from "@workspace/db";
import {
  acknowledgePolicy,
  createPolicy,
  getPolicy,
  listAcknowledgements,
  updatePolicy,
} from "../services/hr-policy-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Policy Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `policygate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const mkEmp = async (no: string) =>
    (
      await db
        .insert(hrEmployeesTable)
        .values({ companyId, employeeNo: no, firstName: "P", lastName: no, createdBy: actorId, updatedBy: actorId })
        .returning()
    )[0];
  const emp1 = await mkEmp("E001");
  const emp2 = await mkEmp("E002");

  // CREATE policy v1
  const policy = await createPolicy(companyId, actorId, { title: "Code of Conduct", body: "Be excellent.", version: 1 });
  const readBack = await getPolicy(companyId, policy.id);
  const passCreate = !!readBack && readBack.title === "Code of Conduct" && readBack.version === 1;

  // UPDATE policy (bump to v2)
  await updatePolicy(companyId, actorId, policy.id, { version: 2, body: "Be excellent v2." });
  const updated = await getPolicy(companyId, policy.id);
  const passUpdate = updated?.version === 2;

  // ACK per employee against current version (v2)
  const ack1 = await acknowledgePolicy(companyId, actorId, policy.id, emp1.id);
  const ack2 = await acknowledgePolicy(companyId, actorId, policy.id, emp2.id);
  const acks = await listAcknowledgements(companyId, policy.id);
  const passAck =
    !!ack1 &&
    !!ack2 &&
    ack1.employeeId === emp1.id &&
    ack2.employeeId === emp2.id &&
    ack1.version === 2 &&
    acks.length === 2 &&
    new Set(acks.map((a) => a.employeeId)).size === 2;

  console.log("=== Policy Gate (Prompt 6) ===");
  console.log(`create + read back policy v1 -> ${passCreate ? "PASS" : "FAIL"}`);
  console.log(`update reflected (version -> 2) -> ${passUpdate ? "PASS" : "FAIL"}`);
  console.log(`ack recorded per employee at version 2 (2 acks) -> ${passAck ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrPolicyAcknowledgementTable).where(eq(hrPolicyAcknowledgementTable.companyId, companyId));
  await db.delete(hrPolicyTable).where(eq(hrPolicyTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passCreate && passUpdate && passAck;
  console.log(ok ? "=== Policy gate PASSED ===" : "=== Policy gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
