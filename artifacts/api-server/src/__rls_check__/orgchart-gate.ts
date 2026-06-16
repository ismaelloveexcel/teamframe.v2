import { randomUUID } from "node:crypto";
import { eq, isNull, and } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrEmployeesTable,
  hrPositionAssignmentsTable,
  hrPositionsTable,
  usersTable,
} from "@workspace/db";
import { getOrgChart } from "../services/hr-orgchart-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "OrgChart Gate Co", jurisdiction: "UAE", currency: "AED" });

  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `orgchart-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  // Build a 3-node hierarchy: root -> mid -> leaf
  const [root] = await db
    .insert(hrPositionsTable)
    .values({ companyId, title: "CEO", createdBy: actorId, updatedBy: actorId })
    .returning();
  const [mid] = await db
    .insert(hrPositionsTable)
    .values({ companyId, title: "VP Engineering", lineManagerId: root.id, createdBy: actorId, updatedBy: actorId })
    .returning();
  const [leaf] = await db
    .insert(hrPositionsTable)
    .values({ companyId, title: "Engineer", lineManagerId: mid.id, createdBy: actorId, updatedBy: actorId })
    .returning();

  // Assign an employee to root position
  const [emp] = await db
    .insert(hrEmployeesTable)
    .values({
      companyId,
      employeeNo: "E001",
      firstName: "Alice",
      lastName: "CEO",
      companyEmail: `alice-${companyId}@co.test`,
      createdBy: actorId,
      updatedBy: actorId,
    })
    .returning();
  await db
    .insert(hrPositionAssignmentsTable)
    .values({ companyId, employeeId: emp.id, positionId: root.id, startDate: "2026-01-01", createdBy: actorId, updatedBy: actorId });

  const chart = await getOrgChart(companyId);

  // Assertions
  const rootNode = chart.find((n) => n.position.id === root.id);
  const midNode = rootNode?.children.find((n) => n.position.id === mid.id);
  const leafNode = midNode?.children.find((n) => n.position.id === leaf.id);

  const passStructure =
    chart.length === 1 &&
    !!rootNode &&
    rootNode.children.length === 1 &&
    !!midNode &&
    midNode.children.length === 1 &&
    !!leafNode &&
    leafNode.children.length === 0;
  const passEmployee = rootNode?.employee?.id === emp.id && midNode?.employee === null;

  // Verify no actionsTable reference in service file (structural gate)
  const { readFileSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const serviceSource = readFileSync(
    resolve(import.meta.dirname ?? __dirname, "../services/hr-orgchart-service.ts"),
    "utf-8",
  );
  const passNoActions = !serviceSource.includes("actionsTable");

  console.log("=== OrgChart Gate (Prompt 5) ===");
  console.log(`structure: 1 root, 1 mid child, 1 leaf grandchild -> ${passStructure ? "PASS" : "FAIL"}`);
  console.log(`employee assigned to root, mid has none -> ${passEmployee ? "PASS" : "FAIL"}`);
  console.log(`no actionsTable reference in service -> ${passNoActions ? "PASS" : "FAIL"}`);

  // Cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrPositionAssignmentsTable).where(eq(hrPositionAssignmentsTable.companyId, companyId));
  await db.delete(hrEmployeesTable).where(eq(hrEmployeesTable.companyId, companyId));
  await db.delete(hrPositionsTable).where(eq(hrPositionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passStructure && passEmployee && passNoActions;
  console.log(ok ? "=== OrgChart gate PASSED ===" : "=== OrgChart gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
