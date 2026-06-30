/**
 * Production RLS verification (operator-run, read-only).
 *
 * THE paid-pilot blocker: before a SECOND paying client shares this Postgres
 * instance, an operator must prove — against PRODUCTION — that tenant isolation
 * is enforced by the database, not merely by application-level `companyId`
 * filters.
 *
 * Unlike the CI gates (which provision a throwaway Postgres and SET ROLE
 * app_user), this script connects with the *real* runtime connection string
 * (`DATABASE_URL`, the same one the server uses) and asserts the live state.
 * It is READ-ONLY: it performs no INSERT/UPDATE/DELETE. The only session state
 * it touches is `app.company_id` (a request-scoped GUC) inside a transaction
 * that is always rolled back.
 *
 * Architecture note (audit assumption corrected): TeamFrame does NOT use
 * Supabase, JWTs, or a `current_actor_tenant_id()` function. Tenant identity is
 * the `app.company_id` GUC set by `runWithTenant()` on a NOBYPASSRLS `app_user`
 * connection. There is therefore no email/JWT fallback to defeat — the checks
 * below verify the equivalent guarantees for the model this repo actually ships.
 *
 * HARD checks (failure => exit 1, do not onboard a second client):
 *   1. Runtime role is NOT a superuser and is NOBYPASSRLS. A superuser or a
 *      BYPASSRLS role silently ignores every policy — the #1 footgun.
 *   2. Every table that carries an `app.company_id` isolation policy also has
 *      RLS FORCED and is NULLIF-hardened (migration 0007) so a reset/empty GUC
 *      fails closed. A half-configured policy is a real isolation bug.
 *   3. Fail-closed: with NO tenant context, `companies` returns 0 rows.
 *   4. No cross-tenant resolution: a random/unknown `app.company_id` returns 0
 *      rows from `companies`.
 *
 * INFORMATIONAL (printed, does NOT fail the run on its own):
 *   - Inventory of every tenant-keyed table and whether it is DB-isolated.
 *     Some tenant-keyed tables (`sessions`, event/projection and legacy
 *     `organizations/people/actions` tables) are NOT protected by RLS and rely
 *     on application-level filtering or SECURITY DEFINER access. The operator
 *     MUST review this list (see runbook) and confirm those surfaces are either
 *     not exposed to paying clients or acceptable, before onboarding client #2.
 *
 * Run (see docs/hr/PROD_RLS_VERIFICATION.md for the full runbook):
 *   DATABASE_URL="postgresql://app_user:****@<prod-host>/teamframe?sslmode=require" \
 *     pnpm --filter @workspace/api-server run verify:rls:prod
 *
 * Capture the full stdout (it ends in PASS or FAIL) as the verification record.
 */

import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";

type Check = { name: string; pass: boolean; detail: string };

const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}\n         ${detail}`);
}

async function main() {
  console.log("\n=== TeamFrame Production RLS Verification ===\n");
  console.log("Read-only. Connects with the runtime DATABASE_URL.\n");

  const c = await pool.connect();
  try {
    // ── 1. Runtime role must be NOBYPASSRLS and not superuser ──────────────
    const who = await c.query<{
      current_user: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT current_user,
              r.rolsuper,
              r.rolbypassrls
         FROM pg_roles r
        WHERE r.rolname = current_user`,
    );
    const role = who.rows[0];
    const roleSafe = !!role && role.rolsuper === false && role.rolbypassrls === false;
    record(
      "runtime role enforces RLS (not superuser, NOBYPASSRLS)",
      roleSafe,
      role
        ? `current_user=${role.current_user} rolsuper=${role.rolsuper} rolbypassrls=${role.rolbypassrls}`
        : "could not read current role attributes",
    );
    if (role && (role.rolsuper || role.rolbypassrls)) {
      console.log(
        "\n  ⚠  The runtime connection BYPASSES RLS. Every check below is\n" +
          "     meaningless until DATABASE_URL points at the NOBYPASSRLS\n" +
          "     `app_user` role (see docs/hr/DEPLOYMENT.md §4a).\n",
      );
    }

    // ── Enumerate tenant-keyed tables (own a company_id/organization_id) ────
    const tenantTables = await c.query<{ table_name: string }>(
      `SELECT t.table_name
         FROM information_schema.tables t
        WHERE t.table_schema='public' AND t.table_type='BASE TABLE'
          AND (t.table_name='companies'
               OR EXISTS (SELECT 1 FROM information_schema.columns col
                           WHERE col.table_schema='public' AND col.table_name=t.table_name
                             AND col.column_name IN ('company_id','organization_id')))
        ORDER BY t.table_name`,
    );
    const tables = tenantTables.rows.map((r) => r.table_name);

    // RLS flags per table.
    const rls = await c.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = ANY($1) AND relkind='r'`,
      [tables],
    );
    const rlsByName = new Map(rls.rows.map((r) => [r.relname, r]));

    // app.company_id policies per table (and whether NULLIF-hardened).
    const policies = await c.query<{ tablename: string; qual: string | null }>(
      `SELECT tablename, qual FROM pg_policies WHERE schemaname='public'`,
    );
    const companyPolByTable = new Map<string, { count: number; hardened: boolean }>();
    for (const p of policies.rows) {
      if (!p.qual || !p.qual.includes("app.company_id")) continue;
      const cur = companyPolByTable.get(p.tablename) ?? { count: 0, hardened: false };
      cur.count += 1;
      if (p.qual.toLowerCase().includes("nullif")) cur.hardened = true;
      companyPolByTable.set(p.tablename, cur);
    }

    // ── 2. Tables WITH a company-id policy must be forced + hardened ────────
    const misconfigured: string[] = [];
    const protectedTables: string[] = [];
    for (const t of tables) {
      const pol = companyPolByTable.get(t);
      if (!pol) continue; // unprotected -> handled in the informational section
      const r = rlsByName.get(t);
      const ok = !!r && r.relrowsecurity && r.relforcerowsecurity && pol.hardened;
      if (ok) protectedTables.push(t);
      else {
        const reasons: string[] = [];
        if (!r?.relrowsecurity) reasons.push("rls-not-enabled");
        if (!r?.relforcerowsecurity) reasons.push("not-forced");
        if (!pol.hardened) reasons.push("not-NULLIF-hardened");
        misconfigured.push(`${t} (${reasons.join(",")})`);
      }
    }
    record(
      "policied tables are FORCED and NULLIF-hardened (no half-configured isolation)",
      misconfigured.length === 0,
      misconfigured.length === 0
        ? `${protectedTables.length} DB-isolated tenant table(s) all correctly forced+hardened`
        : `misconfigured: ${misconfigured.join("; ")}`,
    );

    // ── 3 & 4. Fail-closed + unknown-tenant, inside a rolled-back txn ───────
    await c.query("BEGIN");
    await c.query("RESET app.company_id");
    const noCtx = await c.query<{ n: string }>("SELECT count(*)::text AS n FROM companies");
    record(
      "no tenant context => 0 rows from companies (fail-closed)",
      noCtx.rows[0]?.n === "0",
      `companies visible with unset app.company_id: ${noCtx.rows[0]?.n ?? "?"}`,
    );

    const stranger = randomUUID();
    await c.query("SELECT set_config('app.company_id', $1, true)", [stranger]);
    const foreign = await c.query<{ n: string }>("SELECT count(*)::text AS n FROM companies");
    record(
      "unknown app.company_id => 0 rows from companies (no cross-tenant leak)",
      foreign.rows[0]?.n === "0",
      `companies visible for a random tenant id: ${foreign.rows[0]?.n ?? "?"}`,
    );
    await c.query("ROLLBACK");

    // ── Informational inventory: tenant-keyed tables WITHOUT RLS isolation ──
    const unprotected = tables.filter((t) => !companyPolByTable.has(t));
    console.log("\n  ── Tenant-keyed table inventory ──");
    console.log(`     DB-isolated (RLS policy):    ${protectedTables.length}`);
    console.log(`     NOT DB-isolated (review):    ${unprotected.length}`);
    if (unprotected.length > 0) {
      console.log(
        "\n  ⚠  OPERATOR REVIEW REQUIRED — the following tenant-keyed tables have NO\n" +
          "     RLS policy. They rely on application-level filtering or SECURITY\n" +
          "     DEFINER access. Confirm each is either identity/infra (e.g. sessions),\n" +
          "     or a legacy/projection surface NOT exposed to paying clients, before\n" +
          "     onboarding client #2. See docs/hr/PROD_RLS_VERIFICATION.md.",
      );
      for (const t of unprotected) console.log(`        - ${t}`);
    }
  } finally {
    c.release();
    await pool.end();
  }

  const failed = checks.filter((c) => !c.pass);
  console.log("\n--------------------------------------------------");
  if (failed.length === 0) {
    console.log("=== PRODUCTION RLS VERIFICATION: PASS ===");
    console.log("Core tenant isolation is enforced by the database on this connection.");
    console.log("NOTE: also complete the manual review of any non-isolated tables listed above.");
    process.exit(0);
  } else {
    console.log(`=== PRODUCTION RLS VERIFICATION: FAIL (${failed.length} check(s)) ===`);
    console.log("Do NOT onboard a second paying client until every check passes.");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("\nVerification crashed:", e);
  console.log("=== PRODUCTION RLS VERIFICATION: FAIL (error) ===");
  process.exit(1);
});
