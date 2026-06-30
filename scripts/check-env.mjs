// scripts/check-env.mjs
// TeamFrame pre-launch environment check. Standalone ESM, Node 18+.
//
// Run:
//   node scripts/check-env.mjs            # required must be set; observability is a warning
//   node scripts/check-env.mjs --strict   # also FAIL if launch-observability vars are missing
//
// Purpose: make missing environment configuration visible BEFORE a pilot goes
// live — especially the Sentry DSNs, which are otherwise silently absent because
// the app does not (yet) hard-require them. Prints a clear PASS/FAIL summary and
// exits non-zero on failure so it can gate a deploy.
//
// This script reads process.env only. It does NOT print secret values.

const strict = process.argv.includes("--strict");

/** @type {{name:string, why:string, tier:"required"|"observability"}[]} */
const VARS = [
  // Required — the server/db refuse to start without these.
  { name: "DATABASE_URL", tier: "required", why: "Postgres connection. In prod MUST be the NOBYPASSRLS app_user (see DEPLOYMENT.md §4a)." },
  { name: "PORT", tier: "required", why: "HTTP port; api-server throws on startup if missing/invalid." },

  // Launch observability — recommended before a paying pilot.
  { name: "SENTRY_DSN", tier: "observability", why: "Server-side error reporting (api-server). See docs/hr/SENTRY_READINESS.md." },
  { name: "VITE_SENTRY_DSN", tier: "observability", why: "Client-side error reporting, injected at hr-web build time (Vite convention)." },
];

const present = (n) => {
  const v = process.env[n];
  return typeof v === "string" && v.trim().length > 0;
};

let failures = 0;
let warnings = 0;

console.log("\n=== TeamFrame Environment Check ===");
console.log(strict ? "(strict: observability vars are required)\n" : "(observability vars are warnings; use --strict to require)\n");

for (const tier of ["required", "observability"]) {
  console.log(`-- ${tier} --`);
  for (const v of VARS.filter((x) => x.tier === tier)) {
    const ok = present(v.name);
    if (ok) {
      console.log(`  [ OK ]   ${v.name}`);
    } else if (tier === "required" || strict) {
      console.log(`  [FAIL]   ${v.name}  — ${v.why}`);
      failures++;
    } else {
      console.log(`  [WARN]   ${v.name}  — ${v.why}`);
      warnings++;
    }
  }
}

// Specific guidance for the #1 production footgun: superuser DATABASE_URL.
if (present("DATABASE_URL") && /(^|\/\/)postgres(:|@)/.test(process.env.DATABASE_URL ?? "")) {
  console.log(
    "\n  ⚠  DATABASE_URL appears to use the `postgres` superuser. In production this\n" +
      "     silently bypasses RLS. Use the app_user role and run\n" +
      "     `pnpm --filter @workspace/api-server run verify:rls:prod`.",
  );
}

console.log("\n--------------------------------------------------");
if (failures > 0) {
  console.log(`=== ENV CHECK: FAIL (${failures} missing${warnings ? `, ${warnings} warning(s)` : ""}) ===`);
  process.exit(1);
} else {
  console.log(`=== ENV CHECK: PASS${warnings ? ` (${warnings} observability warning(s))` : ""} ===`);
  process.exit(0);
}
