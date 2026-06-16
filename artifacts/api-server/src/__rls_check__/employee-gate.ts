import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrEmployeesTable,
  hrPositionAssignmentsTable,
  hrPositionsTable,
  membershipsTable,
  usersTable,
} from "@workspace/db";
import { assign, assignmentHistory, createEmployee, invite } from "../services/hr-employee-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Emp Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `empgate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const [pos1] = await db.insert(hrPositionsTable).values({ companyId, title: "Role 1" }).returning();
  const [pos2] = await db.insert(hrPositionsTable).values({ companyId, title: "Role 2" }).returning();

  const emp = await createEmployee(companyId, actorId, {
    employeeNo: "E001",
    firstName: "Test",
    lastName: "User",
    companyEmail: `e001-${companyId}@co.test`,
  });

  await assign(companyId, actorId, emp.id, pos1.id, "2026-01-01");
  await assign(companyId, actorId, emp.id, pos2.id, "2026-06-01"); // reassign

  const hist = await assignmentHistory(companyId, emp.id);
  const ended = hist.filter((a) => a.endDate !== null);
  const active = hist.filter((a) => a.endDate === null);

  const inviteRes = await invite(companyId, actorId, emp.id);
  const [empAfter] = await db.select().from(hrEmployeesTable).where(eq(hrEmployeesTable.id, emp.id));
  const invitedUser = inviteRes
    ? (await db.select().from(usersTable).where(eq(usersTable.id, inviteRes.userId)))[0]
    : null;
  const memb = inviteRes
    ? (await db.select().from(membershipsTable).where(eq(membershipsTable.userId, inviteRes.userId)))[0]
    : null;

  const passHistory =
    hist.length === 2 &&
    ended.length === 1 &&
    active.length === 1 &&
    active[0]?.positionId === pos2.id;
  const passInvite =
    !!invitedUser &&
    invitedUser.status === "invited" &&
    !!memb &&
    memb.role === "employee" &&
    empAfter?.userId === inviteRes?.userId;

  console.log("=== Employee Gate (Prompt 4) ===");
  console.log(
    `assignment history = ${hist.length} (expect 2), ended=${ended.length}(1), active=${active.length}(1) on pos2=${active[0]?.positionId === pos2.id} -> ${passHistory ? "PASS" : "FAIL"}`,
  );
  console.log(
    `invite: invited user + employee membership + linked user_id -> ${passInvite ? "PASS" : "FAIL"}`,
  );

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrPositionAssignmentsTable).where(eq(hrPositionAssignmentsTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(hrPositionsTable).where(eq(hrPositionsTable.companyId, companyId));
  if (inviteRes) {
    await db.delete(membershipsTable).where(eq(membershipsTable.userId, inviteRes.userId));
    await db.delete(usersTable).where(eq(usersTable.id, inviteRes.userId));
  }
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passHistory && passInvite;
  console.log(ok ? "=== Employee gate PASSED ===" : "=== Employee gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
