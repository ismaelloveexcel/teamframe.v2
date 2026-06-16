import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { companiesTable, db, hrAuditLogTable } from "@workspace/db";
import { mutateWithAudit } from "../services/hr-audit";

async function auditCount(companyId: string): Promise<number> {
  const r = await db
    .select({ c: count() })
    .from(hrAuditLogTable)
    .where(eq(hrAuditLogTable.companyId, companyId));
  return Number(r[0]?.c ?? 0);
}

async function companyCount(id: string): Promise<number> {
  const r = await db.select({ c: count() }).from(companiesTable).where(eq(companiesTable.id, id));
  return Number(r[0]?.c ?? 0);
}

async function main() {
  // Case 1 — successful create through the helper => exactly 1 audit row
  const id1 = randomUUID();
  await mutateWithAudit(async (tx) => {
    await tx.insert(companiesTable).values({
      id: id1,
      name: "Audit Gate Co",
      jurisdiction: "UAE",
      currency: "AED",
    });
    return {
      result: id1,
      audit: {
        companyId: id1,
        entityType: "company",
        entityId: id1,
        action: "create" as const,
        after: { name: "Audit Gate Co" },
      },
    };
  });
  const c1 = await auditCount(id1);

  // Case 2 — mutation throws after insert => transaction rolls back, NO audit row
  const id2 = randomUUID();
  let threw = false;
  try {
    await mutateWithAudit(async (tx) => {
      await tx.insert(companiesTable).values({
        id: id2,
        name: "Rollback Co",
        jurisdiction: "UAE",
        currency: "AED",
      });
      throw new Error("forced rollback");
    });
  } catch {
    threw = true;
  }
  const c2 = await auditCount(id2);
  const orphanCompany = await companyCount(id2);

  const pass1 = c1 === 1;
  const pass2 = threw && c2 === 0 && orphanCompany === 0;
  console.log("=== Audit Gate (Prompt 2) ===");
  console.log(`Case 1 create: audit rows = ${c1} (expect 1) -> ${pass1 ? "PASS" : "FAIL"}`);
  console.log(
    `Case 2 rollback: threw=${threw}, audit rows = ${c2} (expect 0), orphan company = ${orphanCompany} (expect 0) -> ${pass2 ? "PASS" : "FAIL"}`,
  );

  // cleanup case 1
  await db.delete(hrAuditLogTable).where(eq(hrAuditLogTable.companyId, id1));
  await db.delete(companiesTable).where(eq(companiesTable.id, id1));

  const ok = pass1 && pass2;
  console.log(ok ? "=== Audit gate PASSED ===" : "=== Audit gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
