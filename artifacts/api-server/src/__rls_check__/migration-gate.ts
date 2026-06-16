/**
 * Migration Gate (Phase 1) — provisions a FRESH throwaway database, applies the
 * SQL migrations 0000..latest in order, then proves the enum->leave_type_code
 * conversion PRESERVES existing leave rows + balances and that the jurisdiction
 * leave-type catalogue resolves correctly.
 *
 * Strategy (matches the task's "seed BEFORE the conversion" option):
 *   1. apply 0000..0009 (schema + leave_types, hr_leave still uses the enum);
 *   2. seed leave + balance rows via the enum column;
 *   3. apply 0010 (enum -> leave_type_code) + 0011;
 *   4. assert every seeded row + balance value survived the conversion;
 *   5. assert leave_types defaults per jurisdiction (UAE has hajj, GENERIC not).
 *
 * Reproduce:
 *   DATABASE_URL="postgresql://postgres@localhost:5433/teamframe?host=/tmp" \
 *     tsx src/__rls_check__/migration-gate.ts
 */

import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPool } from "@workspace/db";

function poolFor(p: ReturnType<typeof parseUrl>, database: string) {
  const auth = p.password ? `${p.user}:${p.password}` : p.user;
  return createPool(
    `postgresql://${auth}@localhost:${p.port}/${database}?host=${encodeURIComponent(p.host)}`,
  );
}

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../lib/db/migrations",
);

// Parse the admin DATABASE_URL to derive a sibling throwaway DB on the same server.
function parseUrl(url: string) {
  const u = new URL(url);
  const host = u.searchParams.get("host") ?? u.hostname;
  const port = u.port || "5432";
  const user = u.username || "postgres";
  const adminDb = u.pathname.replace(/^\//, "") || "postgres";
  return { host, port, user, adminDb, password: u.password };
}

function psqlEnv(p: ReturnType<typeof parseUrl>) {
  return {
    ...process.env,
    PGHOST: p.host,
    PGPORT: p.port,
    PGUSER: p.user,
    ...(p.password ? { PGPASSWORD: p.password } : {}),
  };
}

function applyMigration(env: NodeJS.ProcessEnv, dbName: string, file: string) {
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-d", dbName, "-f", join(MIGRATIONS_DIR, file)], {
    env,
    stdio: "pipe",
  });
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL must be set");
  const p = parseUrl(dbUrl);
  const env = psqlEnv(p);
  const throwaway = `mig_gate_${Date.now()}`;

  // The app roles are server-global; migrations GRANT to them, so they must exist.
  const adminPool = poolFor(p, p.adminDb);
  await adminPool.query("CREATE ROLE app_user NOLOGIN").catch(() => {});
  await adminPool.query("CREATE ROLE app_privileged NOLOGIN").catch(() => {});
  await adminPool.query(`CREATE DATABASE ${throwaway}`);
  await adminPool.end();

  const pool = poolFor(p, throwaway);

  let ok = false;
  try {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
    const preConversion = files.filter((f) => f < "0010");
    const conversion = files.filter((f) => f >= "0010");

    // 0. base core tables that `drizzle push` provides and 0000 ALTERs/refs
    //    (users, organizations). DEPLOYMENT.md applies the SQL migrations on top
    //    of the drizzle-pushed base; we bootstrap the minimal subset here.
    await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await pool.query(
      `CREATE TABLE IF NOT EXISTS organizations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        slug text NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        full_name text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
    );

    // 1. base schema + leave_types (hr_leave still uses the enum).
    for (const f of preConversion) applyMigration(env, throwaway, f);

    // 2. seed company + employee + leave rows + balances USING THE ENUM column.
    const { rows: [co] } = await pool.query<{ id: string }>(
      "INSERT INTO companies (name, jurisdiction, currency) VALUES ('Mig Co', 'UAE', 'AED') RETURNING id",
    );
    const { rows: [genCo] } = await pool.query<{ id: string }>(
      "INSERT INTO companies (name, jurisdiction, currency) VALUES ('Mig Gen Co', 'MU', 'MUR') RETURNING id",
    );
    const { rows: [emp] } = await pool.query<{ id: string }>(
      "INSERT INTO hr_employees (company_id, employee_no, first_name, last_name) VALUES ($1,'E001','Mig','Test') RETURNING id",
      [co.id],
    );
    await pool.query(
      "INSERT INTO hr_leave (company_id, employee_id, type, start_date, end_date, days, status) VALUES " +
        "($1,$2,'annual','2024-01-01','2024-01-05',5,'approved')," +
        "($1,$2,'hajj','2024-02-01','2024-02-10',10,'approved')," +
        "($1,$2,'unpaid','2024-03-01','2024-03-02',2,'approved')",
      [co.id, emp.id],
    );
    await pool.query(
      "INSERT INTO hr_leave_balance (company_id, employee_id, type, balance_days) VALUES " +
        "($1,$2,'annual',25),($1,$2,'sick',10),($1,$2,'hajj',30)",
      [co.id, emp.id],
    );

    const leaveBefore = (await pool.query("SELECT type, days FROM hr_leave WHERE company_id=$1 ORDER BY type", [co.id])).rows;
    const balBefore = (await pool.query("SELECT type, balance_days FROM hr_leave_balance WHERE company_id=$1 ORDER BY type", [co.id])).rows;

    // 3. apply the enum->code conversion + additive offboarding column.
    for (const f of conversion) applyMigration(env, throwaway, f);

    // 4. assert PRESERVATION: same codes + same values, now under leave_type_code.
    const leaveAfter = (await pool.query("SELECT leave_type_code, days FROM hr_leave WHERE company_id=$1 ORDER BY leave_type_code", [co.id])).rows;
    const balAfter = (await pool.query("SELECT leave_type_code, balance_days FROM hr_leave_balance WHERE company_id=$1 ORDER BY leave_type_code", [co.id])).rows;

    const passLeavePreserved =
      leaveAfter.length === 3 &&
      leaveBefore.every((b) =>
        leaveAfter.some((a) => a.leave_type_code === b.type && a.days === b.days),
      );
    const passBalPreserved =
      balAfter.length === 3 &&
      balBefore.every((b) =>
        balAfter.some((a) => a.leave_type_code === b.type && a.balance_days === b.balance_days),
      );

    // 5. assert leave_types catalogue per jurisdiction (global defaults seeded by 0009).
    const uaeDefaults = (await pool.query("SELECT code FROM leave_types WHERE company_id IS NULL AND jurisdiction='UAE' ORDER BY code")).rows.map((r) => r.code);
    const genDefaults = (await pool.query("SELECT code FROM leave_types WHERE company_id IS NULL AND jurisdiction='GENERIC' ORDER BY code")).rows.map((r) => r.code);
    const passUaeSet =
      ["annual", "sick", "maternity", "paternity", "hajj", "bereavement", "unpaid"].every((c) => uaeDefaults.includes(c));
    const passGenSet =
      ["annual", "sick", "unpaid"].every((c) => genDefaults.includes(c)) && !genDefaults.includes("hajj");

    // 6. enum type fully removed from the core.
    const enumGone = (await pool.query("SELECT to_regtype('hr_leave_type') AS t")).rows[0].t === null;

    // sanity: the generic company exists (used for the jurisdiction split above).
    const passGenCo = !!genCo.id;

    console.log("=== Migration Gate (Phase 1) ===");
    console.log(`fresh DB provisioned + 0000..latest applied -> PASS (${throwaway})`);
    console.log(`leave rows preserved through enum->code -> ${passLeavePreserved ? "PASS" : "FAIL"}`);
    console.log(`leave balances preserved through enum->code -> ${passBalPreserved ? "PASS" : "FAIL"}`);
    console.log(`UAE leave-type defaults complete (incl hajj) -> ${passUaeSet ? "PASS" : "FAIL"} (${uaeDefaults.join(",")})`);
    console.log(`GENERIC leave-type defaults = {annual,sick,unpaid}, no hajj -> ${passGenSet ? "PASS" : "FAIL"} (${genDefaults.join(",")})`);
    console.log(`hr_leave_type enum dropped -> ${enumGone ? "PASS" : "FAIL"}`);

    ok = passLeavePreserved && passBalPreserved && passUaeSet && passGenSet && enumGone && passGenCo;
    console.log(ok ? "=== Migration gate PASSED ===" : "=== Migration gate FAILED ===");
  } finally {
    await pool.end();
    // drop throwaway DB
    const dropPool = poolFor(p, p.adminDb);
    await dropPool.query(`DROP DATABASE IF EXISTS ${throwaway} WITH (FORCE)`).catch(() => {});
    await dropPool.end();
  }

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
