import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, organizationsTable } from "@workspace/db";
import { stableHash } from "./domain";
import { buildReplayService } from "./services/replay-service";
import { buildProjectionBuilderService } from "./services/projection-builder-service";

type CheckResult = {
  pass: boolean;
  details?: Record<string, unknown>;
};

async function listTypescriptFiles(target: string): Promise<string[]> {
  const entries = await readdir(target, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...(await listTypescriptFiles(full)));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      files.push(full);
    }
  }
  return files;
}

async function projectionMutationAudit() {
  const srcRoot = "/workspace/artifacts/api-server/src";
  const files = await listTypescriptFiles(srcRoot);
  const forbiddenRefs = [
    "positionsTable",
    "personPositionAssignmentsTable",
    "evidenceStatusByAssignmentTable",
    "compensationCurrentTable",
  ];
  const allowedMutators = new Set([
    "artifacts/api-server/src/services/projection-builder-service.ts",
  ]);
  const mutationRegex =
    /\b(?:db|tx)\.(insert|update|delete)\(\s*([A-Za-z0-9_]+Table)\s*\)|\b(?:db|tx)\.(insert|update|delete)\(([A-Za-z0-9_]+Table)\)/;

  const violations: Array<{
    path: string;
    line: number;
    operation: string;
    tableRef: string;
  }> = [];

  for (const file of files) {
    const rel = file.replace("/workspace/", "");
    const text = await readFile(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      const match = line.match(mutationRegex);
      if (!match) continue;
      const operation = match[1] || match[3] || "mutation";
      const tableRef = match[2] || match[4] || "unknown";
      if (!forbiddenRefs.includes(tableRef)) continue;
      if (allowedMutators.has(rel)) continue;
      violations.push({
        path: rel,
        line: i + 1,
        operation,
        tableRef,
      });
    }
  }

  return {
    pass: violations.length === 0,
    violations,
  };
}

async function repairFlowAnalysis() {
  const filePath = "/workspace/artifacts/api-server/src/services/projection-integrity-service.ts";
  const source = await readFile(filePath, "utf8");
  const hasDirectProjectionPatch =
    source.includes("delete(evidenceStatusByAssignmentTable)") ||
    source.includes("insert(evidenceStatusByAssignmentTable)") ||
    source.includes("delete(compensationCurrentTable)") ||
    source.includes("insert(compensationCurrentTable)");
  const emitsRepairEvent =
    source.includes("projection.repair.requested") && source.includes("appendDomainEvent(");
  const invokesProjector = source.includes("projector.rebuildFromEventsTx");
  return {
    pass: !hasDirectProjectionPatch && emitsRepairEvent && invokesProjector,
    classification: hasDirectProjectionPatch ? "STATE-MUTATION" : "EVENT-BASED",
    hasDirectProjectionPatch,
    emitsRepairEvent,
    invokesProjector,
  };
}

async function quarantineIsolationReport() {
  const filePath = "/workspace/artifacts/api-server/src/services/quarantine-service.ts";
  const source = await readFile(filePath, "utf8");
  const invokesReplay = source.includes("buildReplayService") || source.includes(".replay");
  const autoProjectionMutation =
    source.includes("evidenceStatusByAssignmentTable") ||
    source.includes("compensationCurrentTable") ||
    source.includes("positionsTable");
  const quarantineStateUpdates = source.includes("update(streamQuarantinesTable)");
  return {
    pass: !invokesReplay && !autoProjectionMutation,
    invokesReplay,
    autoProjectionMutation,
    quarantineStateUpdates,
  };
}

async function replayPurityReport() {
  const replay = buildReplayService();
  const projector = buildProjectionBuilderService();
  const organizations = await db.select({ id: organizationsTable.id }).from(organizationsTable);
  const perOrg: Array<{
    orgId: string;
    deterministic: boolean;
    firstHash: string;
    secondHash: string;
    replayMatchesLive: boolean;
    mismatches: string[];
  }> = [];

  for (const organization of organizations) {
    await projector.rebuildFromEvents({
      organizationId: organization.id,
      include: {
        assignments: true,
        evidence: true,
        compensationCurrent: true,
      },
    });

    const a = await replay.replayOrganization(organization.id);
    const b = await replay.replayOrganization(organization.id);
    const compare = await replay.compareReplayWithLive(organization.id);
    const firstHash = stableHash(a.replayed);
    const secondHash = stableHash(b.replayed);
    perOrg.push({
      orgId: organization.id,
      deterministic: firstHash === secondHash,
      firstHash,
      secondHash,
      replayMatchesLive: compare.matches,
      mismatches: compare.mismatches,
    });
  }

  return {
    pass: perOrg.every((row) => row.deterministic && row.replayMatchesLive),
    organizations: perOrg,
  };
}

async function legacyPathRemovalReport() {
  const files = await listTypescriptFiles("/workspace/artifacts/api-server/src");
  const findings: Array<{ path: string; line: number; snippet: string; classification: string }> = [];
  for (const file of files) {
    const rel = file.replace("/workspace/", "");
    const text = await readFile(file, "utf8");
    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (
        line.includes("peopleTable.positionId") ||
        line.includes("person.positionId") ||
        line.includes("people.positionId")
      ) {
        findings.push({
          path: rel,
          line: i + 1,
          snippet: line.trim(),
          classification: rel.includes("/services/") ? "ACTIVE" : "TRANSITIONAL",
        });
      }
    }
  }
  return {
    pass: findings.every((row) => row.classification !== "ACTIVE"),
    findings,
  };
}

async function determinismEnforcementReport(input: {
  projectionMutation: CheckResult;
  repair: CheckResult;
  quarantine: CheckResult;
  replayPurity: CheckResult;
  legacy: CheckResult;
}) {
  const occSource = await readFile("/workspace/artifacts/api-server/src/services/assignment-service.ts", "utf8");
  const occGuardPresent = occSource.includes("conflict(\"version_conflict\")");
  const pass =
    input.projectionMutation.pass &&
    input.repair.pass &&
    input.quarantine.pass &&
    input.replayPurity.pass &&
    input.legacy.pass &&
    occGuardPresent;
  return {
    pass,
    checks: {
      projectionImmutability: input.projectionMutation.pass,
      replayEquivalence: input.replayPurity.pass,
      repairSafety: input.repair.pass,
      quarantineIsolation: input.quarantine.pass,
      occGuardPresent,
      legacyPathRemoval: input.legacy.pass,
    },
  };
}

export async function runPhase4Stabilization() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for phase4 stabilization audit.");
  }

  const outputDir = "/workspace/artifacts/phase4-stabilization";
  await mkdir(outputDir, { recursive: true });

  const projectionMutation = await projectionMutationAudit();
  const repair = await repairFlowAnalysis();
  const quarantine = await quarantineIsolationReport();
  const replayPurity = await replayPurityReport();
  const legacy = await legacyPathRemovalReport();
  const determinism = await determinismEnforcementReport({
    projectionMutation,
    repair,
    quarantine,
    replayPurity,
    legacy,
  });

  await writeFile(
    path.join(outputDir, "projection-mutation-audit.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...projectionMutation,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "repair-flow-analysis.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...repair,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "quarantine-isolation-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...quarantine,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "replay-purity-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...replayPurity,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "legacy-path-removal-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...legacy,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "determinism-enforcement-test-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...determinism,
      },
      null,
      2,
    ),
  );

  const summary = [
    "# Phase 4 Stabilization Summary",
    "",
    `Result: **${determinism.pass ? "PASS" : "FAIL"}**`,
    "",
    "## Checks",
    `- Projection Mutation Safety: ${projectionMutation.pass ? "PASS" : "FAIL"}`,
    `- Replay Purity: ${replayPurity.pass ? "PASS" : "FAIL"}`,
    `- Repair System Safety: ${repair.pass ? "PASS" : "FAIL"}`,
    `- Quarantine Isolation: ${quarantine.pass ? "PASS" : "FAIL"}`,
    `- Legacy Path Removal: ${legacy.pass ? "PASS" : "FAIL"}`,
    `- Determinism Enforcement: ${determinism.pass ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
  await writeFile(path.join(outputDir, "final-stabilization-summary.md"), summary);

  return {
    pass: determinism.pass,
    projectionMutation,
    repair,
    quarantine,
    replayPurity,
    legacy,
    determinism,
  };
}

const isDirectExecution =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  void runPhase4Stabilization()
    .then((result) => {
      console.log(`Phase 4 stabilization result: ${result.pass ? "PASS" : "FAIL"}`);
      if (!result.pass) process.exitCode = 1;
    })
    .catch((error) => {
      console.error("Phase 4 stabilization failed");
      console.error(error instanceof Error ? error.stack ?? error.message : error);
      process.exitCode = 1;
    });
}
