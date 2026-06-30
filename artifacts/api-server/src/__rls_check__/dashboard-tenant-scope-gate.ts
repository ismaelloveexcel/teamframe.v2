/**
 * Dashboard tenant-scope regression gate.
 *
 * Audit assumption corrected: the launch audit warned that dashboard reads used
 * a "service-role client with manual `.eq(tenant_id)` filtering". This repo has
 * NO service-role/Supabase client. Every dashboard read (employees, positions,
 * policies, leave) is served by the session-authed HR routes, all of which sit
 * behind `requireSessionAuth`. That middleware is the single enforcement point
 * that wraps the rest of the request in `runWithTenant(companyId, …)`, setting
 * the `app.company_id` GUC so Postgres RLS scopes every query.
 *
 * The real regression risk is therefore: someone refactors `requireSessionAuth`
 * and drops the `runWithTenant` wrap. Then, under a misconfigured superuser
 * connection, dashboard queries would read across tenants. This gate fails if
 * the middleware ever stops establishing a tenant scope for downstream handlers.
 *
 * It exercises the actual middleware (not a string match):
 *   1. Builds a real session for company A and drives requireSessionAuth.
 *   2. Inside the downstream handler, asserts `app.company_id` === A (proving the
 *      request is tenant-scoped — the guarantee RLS depends on).
 *   3. As the NOBYPASSRLS app_user on that scoped connection, an UNFILTERED read
 *      returns only company A's rows (proving isolation end-to-end).
 */

import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  companiesTable,
  db,
  hrPositionsTable,
  membershipsTable,
  pool,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { requireSessionAuth } from "../middlewares/session-auth.js";

async function main() {
  console.log("\n=== Dashboard Tenant-Scope Regression Gate ===\n");

  const compA = randomUUID();
  const compB = randomUUID();
  const userA = randomUUID();
  const token = `dash-scope-gate-${randomUUID()}`;

  // ── Setup (privileged connection, like other gates) ──────────────────────
  await db.insert(companiesTable).values([
    { id: compA, name: "Dash Scope A", jurisdiction: "UAE", currency: "AED" },
    { id: compB, name: "Dash Scope B", jurisdiction: "UAE", currency: "AED" },
  ]);
  await db.insert(usersTable).values({ id: userA, email: `${userA}@dash-scope.test`, status: "active" });
  await db.insert(membershipsTable).values({ userId: userA, companyId: compA, role: "admin" });
  await db.insert(hrPositionsTable).values([
    { companyId: compA, title: "A Dashboard Role" },
    { companyId: compB, title: "B Dashboard Role" },
  ]);
  await db.insert(sessionsTable).values({
    userId: userA,
    token,
    companyId: compA,
    expiresAt: new Date(Date.now() + 60_000),
  });

  // app_user must exist (migration 0001) to feel RLS; grant to current user so
  // the handler can SET ROLE app_user on the scoped connection.
  const grant = await pool.query<{ has: boolean; cu: string }>(
    "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_user') AS has, current_user AS cu",
  );
  const appUserExists = grant.rows[0]?.has ?? false;
  if (appUserExists) {
    await pool.query(`GRANT app_user TO "${grant.rows[0].cu}"`).catch(() => {});
  }

  // ── Drive the real middleware ────────────────────────────────────────────
  let scopedGuc = "";
  let isolatedCount = -1;
  let sawBRow = true;
  let handlerError: unknown = null;

  const fakeReq = { headers: { authorization: `Bearer ${token}` } } as unknown as Parameters<
    typeof requireSessionAuth
  >[0];
  const fakeRes = new EventEmitter() as unknown as Parameters<typeof requireSessionAuth>[1];

  await new Promise<void>((resolve) => {
    const next = (err?: unknown) => {
      if (err) {
        handlerError = err;
        (fakeRes as unknown as EventEmitter).emit("finish");
        resolve();
        return;
      }
      // Downstream handler — runs inside runWithTenant if the middleware is intact.
      void (async () => {
        try {
          const r = await db
            .execute<{ cid: string }>(sql`select current_setting('app.company_id', true) as cid`)
            .then((x) => (x as unknown as { rows: { cid: string }[] }).rows);
          scopedGuc = r[0]?.cid ?? "";

          if (appUserExists) {
            await db.execute(sql`SET ROLE app_user`);
            const rows = await db.select().from(hrPositionsTable); // NO company filter
            isolatedCount = rows.length;
            sawBRow = rows.some((row) => row.companyId === compB);
            await db.execute(sql`RESET ROLE`);
          }
        } catch (e) {
          handlerError = e;
        } finally {
          (fakeRes as unknown as EventEmitter).emit("finish");
          resolve();
        }
      })();
    };
    requireSessionAuth(fakeReq, fakeRes, next as unknown as Parameters<typeof requireSessionAuth>[2]);
  });

  // ── Assertions ───────────────────────────────────────────────────────────
  const passScoped = scopedGuc === compA;
  const passIsolation = !appUserExists || (isolatedCount === 1 && !sawBRow);
  const passNoError = handlerError === null;

  console.log(`middleware scoped request to tenant A (app.company_id) -> ${passScoped ? "PASS" : "FAIL"}`);
  console.log(`  app.company_id inside handler = ${scopedGuc || "(unset)"}  expected ${compA}`);
  console.log(
    appUserExists
      ? `as app_user, unfiltered dashboard read returned only A (${isolatedCount} row, B-leak=${sawBRow}) -> ${passIsolation ? "PASS" : "FAIL"}`
      : "app_user role absent — isolation step SKIPPED (run migration 0001)",
  );
  console.log(`no handler error -> ${passNoError ? "PASS" : "FAIL"}`);

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  await db.delete(hrPositionsTable).where(eq(hrPositionsTable.companyId, compA));
  await db.delete(hrPositionsTable).where(eq(hrPositionsTable.companyId, compB));
  await db.delete(membershipsTable).where(eq(membershipsTable.userId, userA));
  await db.delete(usersTable).where(eq(usersTable.id, userA));
  await db.delete(companiesTable).where(eq(companiesTable.id, compA));
  await db.delete(companiesTable).where(eq(companiesTable.id, compB));
  if (appUserExists) {
    await pool.query(`REVOKE app_user FROM "${grant.rows[0].cu}"`).catch(() => {});
  }

  const ok = passScoped && passIsolation && passNoError;
  console.log(ok ? "\n=== Dashboard tenant-scope gate PASSED ===" : "\n=== Dashboard tenant-scope gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
