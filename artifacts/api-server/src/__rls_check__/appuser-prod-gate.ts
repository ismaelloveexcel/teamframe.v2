import { randomUUID } from "node:crypto";
import { createPool } from "@workspace/db";

/**
 * Production-path gate: connects as the NOBYPASSRLS `app_user` (exactly how the
 * server runs in production) and proves the tenant-bootstrap + RLS story works
 * WITHOUT any superuser. Mirrors what auth /bootstrap does: generate companyId,
 * set app.company_id, insert company + membership (FORCED RLS WITH CHECK), then
 * prove cross-tenant reads are blocked.
 */
async function main() {
  const appUrl =
    process.env.APP_USER_DATABASE_URL ??
    "postgresql://app_user:app_user_pw@localhost:5433/teamframe?host=/tmp";
  const pool = createPool(appUrl);

  const compA = randomUUID();
  const compB = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();

  // ---- Bootstrap two tenants as app_user, each in its own tenant scope ----
  async function bootstrap(companyId: string, userId: string, name: string) {
    const c = await pool.connect();
    try {
      // users is global (no RLS)
      await c.query("INSERT INTO users (id, email, status) VALUES ($1,$2,'active')", [
        userId,
        `${userId}@bootstrap.test`,
      ]);
      await c.query("SELECT set_config('app.company_id', $1, false)", [companyId]);
      await c.query("INSERT INTO companies (id, name, jurisdiction, currency) VALUES ($1,$2,'UAE','AED')", [
        companyId,
        name,
      ]);
      await c.query("INSERT INTO memberships (user_id, company_id, role) VALUES ($1,$2,'admin')", [
        userId,
        companyId,
      ]);
    } finally {
      await c.query("RESET app.company_id").catch(() => {});
      c.release();
    }
  }

  let bootstrapOk = true;
  try {
    await bootstrap(compA, userA, "App-User Co A");
    await bootstrap(compB, userB, "App-User Co B");
  } catch (e) {
    bootstrapOk = false;
    console.error("bootstrap failed:", (e as Error).message);
  }

  // ---- Prove RLS isolation as app_user: scope=A sees only A ----
  const c = await pool.connect();
  let visibleInA = -1;
  let leakedB = true;
  let noContextRows = -1;
  let blockedWrongTenant = false;
  try {
    await c.query("SELECT set_config('app.company_id', $1, false)", [compA]);
    const a = await c.query<{ id: string }>("SELECT id FROM companies");
    visibleInA = a.rows.length;
    leakedB = a.rows.some((r) => r.id === compB);

    // WITH CHECK must block inserting a membership for a different company
    try {
      await c.query("INSERT INTO memberships (user_id, company_id, role) VALUES ($1,$2,'employee')", [
        userA,
        compB,
      ]);
    } catch {
      blockedWrongTenant = true;
    }

  } finally {
    await c.query("RESET app.company_id").catch(() => {});
    c.release();
  }

  // Fail-closed check on a FRESH connection that never set app.company_id —
  // mirrors how the server never queries an RLS table on the shared pool
  // without first entering a tenant scope. current_setting(...,true) is NULL
  // here (never set on this session), so the policy yields 0 rows.
  const fresh = await pool.connect();
  try {
    const none = await fresh.query("SELECT id FROM companies");
    noContextRows = none.rows.length;
  } finally {
    fresh.release();
  }

  const passBootstrap = bootstrapOk;
  const passIsolation = visibleInA === 1 && !leakedB;
  const passWithCheck = blockedWrongTenant;
  const passFailClosed = noContextRows === 0;

  console.log("=== App-User Production-Path Gate ===");
  console.log(`bootstrap tenant as app_user (no superuser) -> ${passBootstrap ? "PASS" : "FAIL"}`);
  console.log(`scope=A reads only company A (${visibleInA} row, B-leak=${leakedB}) -> ${passIsolation ? "PASS" : "FAIL"}`);
  console.log(`WITH CHECK blocks cross-tenant membership insert -> ${passWithCheck ? "PASS" : "FAIL"}`);
  console.log(`no tenant context => 0 rows (fail-closed) -> ${passFailClosed ? "PASS" : "FAIL"}`);

  // ---- cleanup (needs a tenant scope per company under RLS) ----
  const cc = await pool.connect();
  try {
    for (const id of [compA, compB]) {
      await cc.query("SELECT set_config('app.company_id', $1, false)", [id]);
      await cc.query("DELETE FROM memberships WHERE company_id = $1", [id]);
      await cc.query("DELETE FROM companies WHERE id = $1", [id]);
    }
    await cc.query("RESET app.company_id");
    await cc.query("DELETE FROM users WHERE id = ANY($1)", [[userA, userB]]);
  } finally {
    cc.release();
  }
  await pool.end();

  const ok = passBootstrap && passIsolation && passWithCheck && passFailClosed;
  console.log(ok ? "=== App-user production-path gate PASSED ===" : "=== App-user production-path gate FAILED ===");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
