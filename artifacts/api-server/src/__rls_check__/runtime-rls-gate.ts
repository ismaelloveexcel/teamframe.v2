import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { companiesTable, db, hrPositionsTable, pool, runWithTenant } from "@workspace/db";

/**
 * Runtime RLS gate (Prompt 1 follow-up).
 *
 * Proves the production request path works: runWithTenant() routes every query
 * issued through the exported proxy `db` onto a dedicated connection carrying
 * app.company_id, and — once that connection runs as the NOBYPASSRLS app_user —
 * Postgres RLS scopes reads to the tenant even with NO companyId filter in SQL.
 */
async function main() {
  const compA = randomUUID();
  const compB = randomUUID();
  await db.insert(companiesTable).values([
    { id: compA, name: "Runtime A", jurisdiction: "UAE", currency: "AED" },
    { id: compB, name: "Runtime B", jurisdiction: "UAE", currency: "AED" },
  ]);
  await db.insert(hrPositionsTable).values([
    { companyId: compA, title: "A-Only Role" },
    { companyId: compB, title: "B-Only Role" },
  ]);

  // app_user must exist (migration 0001). Grant it to the current (super)user so
  // the gate can SET ROLE app_user on the scoped connection and feel RLS.
  const grant = await pool.query<{ has: boolean; cu: string }>(
    "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_user') AS has, current_user AS cu",
  );
  const appUserExists = grant.rows[0]?.has ?? false;
  if (appUserExists) {
    await pool.query(`GRANT app_user TO "${grant.rows[0].cu}"`).catch(() => {});
  }

  // (1) Routing + GUC: inside the scope, the GUC read THROUGH the proxy db must
  // return company A — only possible if the proxy used the scoped connection.
  let gucInside = "";
  let isolatedCount = -1;
  let sawBRow = true;
  await runWithTenant(compA, async () => {
    const [{ cid }] = await db.execute<{ cid: string }>(
      sql`select current_setting('app.company_id', true) as cid`,
    ).then((r) => (r as unknown as { rows: { cid: string }[] }).rows);
    gucInside = cid;

    if (appUserExists) {
      // Become the NOBYPASSRLS role on this same scoped connection, then read
      // positions with NO companyId filter — RLS must restrict to company A.
      await db.execute(sql`SET ROLE app_user`);
      const rows = await db.select().from(hrPositionsTable);
      isolatedCount = rows.length;
      sawBRow = rows.some((r) => r.companyId === compB);
      await db.execute(sql`RESET ROLE`);
    }
  });

  // (2) Outside any scope, the GUC is unset (fresh pooled connection).
  const outside = await db.execute<{ cid: string }>(
    sql`select current_setting('app.company_id', true) as cid`,
  ).then((r) => (r as unknown as { rows: { cid: string }[] }).rows[0]?.cid ?? "");

  const passRouting = gucInside === compA;
  const passIsolation = !appUserExists || (isolatedCount === 1 && !sawBRow);
  const passOutside = !outside; // empty string / null

  console.log("=== Runtime RLS Gate (request path) ===");
  console.log(`proxy db routed to scoped connection (GUC=A) -> ${passRouting ? "PASS" : "FAIL"}`);
  console.log(
    appUserExists
      ? `as app_user, unfiltered read returned only company A (${isolatedCount} row, B-leak=${sawBRow}) -> ${passIsolation ? "PASS" : "FAIL"}`
      : "app_user role absent — RLS isolation step SKIPPED (run migration 0001)",
  );
  console.log(`outside scope, GUC unset -> ${passOutside ? "PASS" : "FAIL"}`);

  // cleanup
  await db.delete(hrPositionsTable).where(eq(hrPositionsTable.companyId, compA));
  await db.delete(hrPositionsTable).where(eq(hrPositionsTable.companyId, compB));
  await db.delete(companiesTable).where(eq(companiesTable.id, compA));
  await db.delete(companiesTable).where(eq(companiesTable.id, compB));
  if (appUserExists) {
    await pool.query(`REVOKE app_user FROM "${grant.rows[0].cu}"`).catch(() => {});
  }

  const ok = passRouting && passIsolation && passOutside;
  console.log(ok ? "=== Runtime RLS gate PASSED ===" : "=== Runtime RLS gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
