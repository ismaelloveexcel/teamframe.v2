// scripts/seed-demo-org.mjs
// TeamFrame Demo Org Seed Script — "Meridian Advisory Group"
// Standalone ESM, Node 18+ (global fetch). No repo / pnpm imports.
//
// Run: node scripts/seed-demo-org.mjs
//
// Idempotent & resumable: every entity is matched against existing data by a
// natural key (org slug, team name, position title, person fullName, action
// title) and only created when missing. Ownership endpoints are PUT (already
// idempotent). Safe to re-run after a mid-way failure.

const API_BASE = process.env.TF_API_BASE ?? "https://api-server-phi-three.vercel.app";
const API = `${API_BASE}/api`;

// NOTE: actor UUID must satisfy the server's UUID_REGEX (version 1-5, variant
// 8/9/a/b). The originally-suggested "...-7890-abcd-..." has version nibble 7
// and is REJECTED with 400. This is a valid v4 UUID.
const ACTOR = {
  "x-user-id": "a1b2c3d4-e5f6-4a90-abcd-ef1234567890",
  "x-user-email": "demo@teamframe.app",
  "x-user-name": "Demo Operator",
};

// ── helpers ────────────────────────────────────────────────────────────────
function log(msg, data) {
  if (data !== undefined) console.log(`  ${msg}`, data);
  else console.log(`  ${msg}`);
}

async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...ACTOR },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} -> ${res.status} ${res.statusText}\n${
        typeof payload === "string" ? payload : JSON.stringify(payload, null, 2)
      }`,
    );
  }
  return payload;
}

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

let idemCounter = 0;
const idem = (label) => `seed-${label}-${idemCounter++}`.padEnd(8, "0");

// ── seed definitions ─────────────────────────────────────────────────────
const ORG = { name: "Meridian Advisory Group", slug: "meridian-advisory-group" };

const TEAMS = [
  "Leadership",
  "Client Services",
  "Operations",
  "Finance",
  "Business Development",
  "Technology",
];

// key, title, team, reportsTo (key | null)
const POSITIONS = [
  // Leadership
  { key: "MD",  title: "Managing Director",            team: "Leadership",           reportsTo: null },
  { key: "COO", title: "Chief Operating Officer",      team: "Leadership",           reportsTo: "MD" },
  // Client Services
  { key: "HCS", title: "Head of Client Services",      team: "Client Services",      reportsTo: "COO" },
  { key: "SRM", title: "Senior Relationship Manager",  team: "Client Services",      reportsTo: "HCS" },
  { key: "RM",  title: "Relationship Manager",         team: "Client Services",      reportsTo: "HCS" },
  { key: "COS", title: "Client Onboarding Specialist", team: "Client Services",      reportsTo: "HCS" },
  { key: "CSA", title: "Client Support Associate",     team: "Client Services",      reportsTo: "HCS" },
  { key: "JCA", title: "Junior Client Associate",      team: "Client Services",      reportsTo: "HCS" }, // VACANT
  // Operations
  { key: "OM",  title: "Operations Manager",           team: "Operations",           reportsTo: "COO" },
  { key: "OC",  title: "Operations Coordinator",       team: "Operations",           reportsTo: "OM" },
  { key: "CO",  title: "Compliance Officer",           team: "Operations",           reportsTo: "OM" },  // VACANT
  { key: "AA",  title: "Administrative Assistant",     team: "Operations",           reportsTo: null },  // ORPHAN
  // Finance
  { key: "HF",  title: "Head of Finance",              team: "Finance",              reportsTo: "MD" },
  { key: "FA",  title: "Finance Analyst",              team: "Finance",              reportsTo: "HF" },
  { key: "AE",  title: "Accounts Executive",           team: "Finance",              reportsTo: "HF" },  // VACANT
  // Business Development
  { key: "BDD", title: "Business Development Director", team: "Business Development", reportsTo: null },  // ORPHAN (apex)
  { key: "BDM", title: "Business Development Manager",  team: "Business Development", reportsTo: "BDD" }, // VACANT
  { key: "PC",  title: "Partnership Coordinator",      team: "Business Development", reportsTo: "BDD" },
  // Technology
  { key: "TL",  title: "Technology Lead",              team: "Technology",           reportsTo: "COO" }, // VACANT
  { key: "SA",  title: "Systems Administrator",        team: "Technology",           reportsTo: "TL" },
  { key: "DA",  title: "Data Analyst",                 team: "Technology",           reportsTo: "TL" },
  { key: "DMC", title: "Digital Marketing Coordinator",team: "Technology",           reportsTo: "BDD" },
];

// person fullName -> position key (12 people; remaining 10 positions stay vacant)
const PEOPLE = [
  { fullName: "Sarah Chen",       position: "MD" },
  { fullName: "James Okonkwo",    position: "COO" },
  { fullName: "Priya Nair",       position: "HCS" },
  { fullName: "Marcus Webb",      position: "SRM" },
  { fullName: "Anya Petrov",      position: "RM" },
  { fullName: "David Kimura",     position: "COS" },
  { fullName: "Fatima Al-Hassan", position: "CSA" },
  { fullName: "Robert Mensah",    position: "OM" },
  { fullName: "Lucia Fernandez",  position: "OC" },
  { fullName: "Thomas Bergmann",  position: "HF" },
  { fullName: "Nina Johansson",   position: "FA" },
  { fullName: "Alex Thornton",    position: "PC" },
];

// teams that get a lead (others deliberately left with no owner -> SPOF)
const TEAM_OWNERSHIPS = [
  { team: "Leadership",      ownerPosition: "MD" },
  { team: "Client Services", ownerPosition: "HCS" },
  { team: "Finance",         ownerPosition: "HF" },
];

// actions: owner = position key. NOTE: the API rejects ownerless actions
// (action-service requires assignmentId | ownerPersonId | ownerPositionId), so a
// truly "unowned" action cannot be created. The ones the demo wants "unowned"
// are instead owned by VACANT positions — a real, visible dependency ("owned by
// an empty seat"). The Founder Dependency Report treats a vacant-position owner
// as unrouted (isRouted), so these correctly drive Section 1's "actions without
// owner", Section 2's overdue-no-owner, and the Section 3 handoffs. linkTeam
// attaches the action to a no-lead team for the team-handoff signal.
const ACTIONS = [
  { title: "Q3 Client Review — Meridian Portfolio",        owner: "HCS", due: isoDate(30) },
  { title: "Onboard new corporate client — Apex Holdings", owner: "COS", due: isoDate(14) },
  { title: "Compliance audit — Q2 transaction review",     owner: "CO",  due: isoDate(-7),  linkTeam: "Operations" },
  { title: "Technology infrastructure upgrade proposal",   owner: "TL",  due: isoDate(-14), linkTeam: "Technology" },
  { title: "Business development pipeline review",          owner: "BDM", due: isoDate(-5),  linkTeam: "Business Development" },
  { title: "Annual policy review — client data handling",  owner: "CO",  due: isoDate(21) }, // owner is a VACANT position
  { title: "Staff performance reviews — Q2",               owner: "AE",  due: isoDate(10) },
  { title: "Partnership agreement renewal — TechBridge",   owner: "PC",  due: isoDate(45) },
  { title: "Finance system migration planning",            owner: "AE",  due: isoDate(-3) },
  { title: "Recruitment brief — Technology Lead",          owner: "HF",  due: isoDate(7) },
];

// ── seed ─────────────────────────────────────────────────────────────────
async function seed() {
  console.log(`\n=== Seeding "${ORG.name}" via ${API} ===\n`);

  // 1 + 2. Organisation (find or create by slug)
  console.log("[1/8] Organisation");
  const orgList = await api("GET", "/organizations");
  let org = (orgList.items ?? []).find(
    (o) => o.slug === ORG.slug || o.name === ORG.name,
  );
  if (org) log("exists, reusing:", org.id);
  else {
    org = await api("POST", "/organizations", ORG);
    log("created:", org.id);
  }
  const orgId = org.id;
  const base = `/organizations/${orgId}`;

  // 3. Teams
  console.log("[2/8] Teams");
  const existingTeams = (await api("GET", `${base}/teams`)).items ?? [];
  const teamByName = new Map(existingTeams.map((t) => [t.name, t]));
  for (const name of TEAMS) {
    if (teamByName.has(name)) {
      log(`exists: ${name}`);
      continue;
    }
    const t = await api("POST", `${base}/teams`, { name });
    teamByName.set(name, t);
    log(`created: ${name}`, t.id);
  }

  // 4. Positions — created in array order (parents precede children)
  console.log("[3/8] Positions");
  const existingPositions = (await api("GET", `${base}/positions`)).items ?? [];
  const posByTitle = new Map(existingPositions.map((p) => [p.title, p]));
  const posByKey = new Map();
  for (const def of POSITIONS) {
    let p = posByTitle.get(def.title);
    if (!p) {
      const body = { title: def.title, teamId: teamByName.get(def.team).id };
      if (def.reportsTo) body.reportsToPositionId = posByKey.get(def.reportsTo).id;
      p = await api("POST", `${base}/positions`, body);
      log(`created: ${def.title}`);
    } else {
      log(`exists: ${def.title}`);
    }
    posByKey.set(def.key, p);
  }

  // 5 + 6. People + assignments
  console.log("[4/8] People + assignments");
  const existingPeople = (await api("GET", `${base}/people`)).items ?? [];
  const personByName = new Map(existingPeople.map((p) => [p.fullName, p]));
  const existingAssignments = (await api("GET", `${base}/assignments`)).items ?? [];
  const activePositionIds = new Set(
    existingAssignments.filter((a) => a.status === "active").map((a) => a.positionId),
  );
  for (const def of PEOPLE) {
    let person = personByName.get(def.fullName);
    if (!person) {
      person = await api("POST", `${base}/people`, {
        fullName: def.fullName,
        email: `${def.fullName.toLowerCase().replace(/[^a-z]+/g, ".")}@meridian-advisory.example`,
        employmentStatus: "active",
      });
      personByName.set(def.fullName, person);
      log(`person created: ${def.fullName}`);
    } else {
      log(`person exists: ${def.fullName}`);
    }
    const positionId = posByKey.get(def.position).id;
    if (activePositionIds.has(positionId)) {
      log(`  assignment exists for ${def.position}`);
      continue;
    }
    await api("POST", `${base}/assignments`, {
      personId: person.id,
      positionId,
      startedAt: new Date().toISOString(),
      idempotencyKey: idem(`assign-${def.position}`),
    });
    activePositionIds.add(positionId);
    log(`  assigned ${def.fullName} -> ${def.position}`);
  }

  // 7a. Team ownerships (PUT, idempotent)
  console.log("[5/8] Team ownerships");
  for (const o of TEAM_OWNERSHIPS) {
    await api("PUT", `${base}/teams/${teamByName.get(o.team).id}/ownership`, {
      ownerPositionId: posByKey.get(o.ownerPosition).id,
      responsibilityContext: `${o.team} leadership`,
    });
    log(`lead set: ${o.team} -> ${o.ownerPosition}`);
  }

  // 7b. Position ownerships (PUT, idempotent) — REQUIRED for the report's
  // "ownership coverage %" metric, which is derived from position-ownership
  // records (not staffing). Owning the 12 filled positions => ~54% coverage.
  console.log("[6/8] Position ownerships (drives coverage %)");
  for (const def of PEOPLE) {
    const positionId = posByKey.get(def.position).id;
    const personId = personByName.get(def.fullName).id;
    await api("PUT", `${base}/positions/${positionId}/ownership`, {
      ownerPersonId: personId,
      responsibilityContext: `${def.position} decision ownership`,
    });
    log(`owner set: ${def.position}`);
  }

  // 8. Actions
  console.log("[7/8] Actions");
  const existingActions = (await api("GET", `${base}/actions`)).items ?? [];
  const actionByTitle = new Set(existingActions.map((a) => a.title));
  for (const def of ACTIONS) {
    if (actionByTitle.has(def.title)) {
      log(`exists: ${def.title}`);
      continue;
    }
    const body = { title: def.title, dueDate: def.due };
    if (def.owner) body.owner = { ownerPositionId: posByKey.get(def.owner).id };
    if (def.linkTeam) body.link = { teamId: teamByName.get(def.linkTeam).id };
    await api("POST", `${base}/actions`, body);
    log(`created: ${def.title}${def.owner ? "" : "  (unowned)"}`);
  }

  // 9. Summary
  const positions = (await api("GET", `${base}/positions`)).items ?? [];
  const people = (await api("GET", `${base}/people`)).items ?? [];
  const assignments = ((await api("GET", `${base}/assignments`)).items ?? []).filter(
    (a) => a.status === "active",
  );
  const actions = (await api("GET", `${base}/actions`)).items ?? [];

  console.log(`
=== MERIDIAN ADVISORY GROUP SEEDED ===
Organisation ID: ${orgId}
Positions created: ${positions.length}
People created: ${people.length}
Assignments created: ${assignments.length}
Actions created: ${actions.length}

Open TeamFrame to generate the Founder Dependency Report:
https://mockup-sandbox-nine.vercel.app

Expected report output:
- Ownership coverage: ~45-55%
- Single points of failure: 6-8+ items
- Recommended handoffs: 3 items
=======================================
`);
}

seed().catch((err) => {
  console.error("\nSeed failed:", err.message ?? err);
  process.exit(1);
});
