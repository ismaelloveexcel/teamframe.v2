import { randomUUID } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrAuditLogTable,
  hrPositionsTable,
  usersTable,
} from "@workspace/db";
import { createPosition, getHierarchy, listPositions } from "../services/hr-position-service.js";

async function main() {
  const companyId = randomUUID();
  await db
    .insert(companiesTable)
    .values({ id: companyId, name: "Pos Gate Co", jurisdiction: "UAE", currency: "AED" });

  // actor (created_by FK -> users). Use an existing user or make a throwaway one.
  let [user] = await db.select().from(usersTable).limit(1);
  if (!user) {
    [user] = await db
      .insert(usersTable)
      .values({ email: `posgate-${companyId}@test.internal`, status: "active" })
      .returning();
  }
  const actorId = user.id;

  const a = await createPosition(companyId, actorId, { title: "CEO" });
  const b = await createPosition(companyId, actorId, { title: "CTO", lineManagerId: a.id });

  const list = await listPositions(companyId);
  const tree = await getHierarchy(companyId);
  const [{ c: auditRows }] = await db
    .select({ c: count() })
    .from(hrAuditLogTable)
    .where(
      and(eq(hrAuditLogTable.companyId, companyId), eq(hrAuditLogTable.entityType, "position")),
    );

  const root = tree.find((n) => n.id === a.id);
  const passList = list.length === 2;
  const passTree = !!root && root.reports.some((r) => r.id === b.id);
  const passAudit = Number(auditRows) === 2;

  console.log("=== Position Gate (Prompt 3) ===");
  console.log(`list count = ${list.length} (expect 2) -> ${passList ? "PASS" : "FAIL"}`);
  console.log(`hierarchy CEO -> CTO via line_manager_id -> ${passTree ? "PASS" : "FAIL"}`);
  console.log(`audit rows = ${auditRows} (expect 2) -> ${passAudit ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, companyId));
  await db.delete(hrPositionsTable).where(eq(hrPositionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));

  const ok = passList && passTree && passAudit;
  console.log(ok ? "=== Position gate PASSED ===" : "=== Position gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
