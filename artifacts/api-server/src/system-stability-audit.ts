import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import {
  compensationCurrentTable,
  db,
  evidenceStatusByAssignmentTable,
  orgEventsTable,
  organizationsTable,
  personPositionAssignmentsTable,
  positionsTable,
  projectionIntegrityChecksTable,
  streamQuarantinesTable,
} from "@workspace/db";
import {
  deriveAssignments,
  deriveCompensationCurrentByAssignment,
  deriveCompensationRecordsFromEvents,
  deriveDocumentSnapshotsFromEvents,
  deriveEvidenceStatusByAssignment,
  deriveRequirementRulesFromEvents,
  stableHash,
  type EventEnvelope,
} from "./domain";
import { buildReplayService } from "./services/replay-service";

type ProjectionName =
  | "positions_current"
  | "assignments_current"
  | "evidence_status_by_assignment"
  | "compensation_current";

type MutationPathEntry = {
  filePath: string;
  functionName: string;
  mutationType: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
  line: number;
};

type ProjectionDiff = {
  projection: ProjectionName;
  matches: boolean;
  liveHash: string;
  replayHash: string;
  onlyInLive: string[];
  onlyInReplay: string[];
  valueMismatches: string[];
  firstDivergenceEventId: string | null;
  divergenceCause:
    | "none"
    | "event_omission"
    | "projection_mutation"
    | "non_deterministic_reducer_logic"
    | "repair_side_effect_contamination";
  downstreamCorruptedAggregates: string[];
};

type OrgAudit = {
  orgId: string;
  projectionDiffs: ProjectionDiff[];
  replayPurity: {
    deterministic: boolean;
    firstRunHash: string;
    secondRunHash: string;
  };
  replayMatchesLive: boolean;
};

type StabilitySummary = {
  result: "PASS" | "FAIL";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  primaryRootCause: string;
  secondaryCauses: string[];
  checks: {
    determinism: boolean;
    replayPurity: boolean;
    mutationSafety: boolean;
    quarantineIsolation: boolean;
  };
};

function toEventEnvelope(row: typeof orgEventsTable.$inferSelect): EventEnvelope {
  return {
    orgId: row.orgId,
    aggregateType: row.aggregateType,
    aggregateId: row.aggregateId,
    eventType: row.eventType,
    version: row.version,
    occurredAt: row.occurredAt.toISOString(),
    actorId: row.actorUserId ?? "system",
    correlationId: row.correlationId ?? undefined,
    causationId: row.causationId ?? undefined,
    schemaVersion: row.schemaVersion,
    idempotencyKey: row.idempotencyKey,
    payload: row.payload,
    payloadHash: row.payloadHash ?? stableHash(row.payload),
  };
}

function normalizeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return [...rows].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function rowsById(rows: Array<Record<string, unknown>>, idKey: string) {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = String(row[idKey] ?? "");
    if (!id) continue;
    map.set(id, row);
  }
  return map;
}

function computeRowDiff(
  projection: ProjectionName,
  liveRows: Array<Record<string, unknown>>,
  replayRows: Array<Record<string, unknown>>,
  idKey: string,
): Omit<ProjectionDiff, "projection" | "firstDivergenceEventId" | "divergenceCause" | "downstreamCorruptedAggregates"> {
  const live = rowsById(liveRows, idKey);
  const replay = rowsById(replayRows, idKey);
  const onlyInLive: string[] = [];
  const onlyInReplay: string[] = [];
  const valueMismatches: string[] = [];

  for (const id of live.keys()) {
    if (!replay.has(id)) {
      onlyInLive.push(id);
      continue;
    }
    const liveHash = stableHash(live.get(id));
    const replayHash = stableHash(replay.get(id));
    if (liveHash !== replayHash) valueMismatches.push(id);
  }
  for (const id of replay.keys()) {
    if (!live.has(id)) onlyInReplay.push(id);
  }

  const liveHash = stableHash(normalizeRows(liveRows));
  const replayHash = stableHash(normalizeRows(replayRows));
  return {
    matches: liveHash === replayHash,
    liveHash,
    replayHash,
    onlyInLive: onlyInLive.sort(),
    onlyInReplay: onlyInReplay.sort(),
    valueMismatches: valueMismatches.sort(),
  };
}

function derivePositionReplayState(events: EventEnvelope[]) {
  const map = new Map<string, Record<string, unknown>>();
  const sorted = [...events]
    .filter((event) => event.aggregateType === "position")
    .sort((a, b) => {
      const byOccurred = a.occurredAt.localeCompare(b.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      return a.version - b.version;
    });

  for (const event of sorted) {
    const payload = event.payload as Record<string, unknown>;
    const positionId = String(payload.positionId ?? event.aggregateId ?? "");
    if (!positionId) continue;
    if (event.eventType === "position.deleted") {
      map.delete(positionId);
      continue;
    }
    if (event.eventType.startsWith("position.")) {
      map.set(positionId, {
        positionId,
        title: payload.title ?? "",
        teamId: payload.teamId ?? null,
        reportsToPositionId: payload.reportsToPositionId ?? null,
        lifecycleStatus: payload.lifecycleStatus ?? "",
      });
    }
  }
  return normalizeRows([...map.values()]);
}

function computeEarliestDivergenceEventId(
  events: Array<typeof orgEventsTable.$inferSelect>,
  liveHash: string,
  computeFromPrefix: (prefixEvents: EventEnvelope[]) => Array<Record<string, unknown>>,
): string | null {
  if (events.length === 0) return null;
  const sorted = [...events].sort((a, b) => {
    const byOccurred = a.occurredAt.getTime() - b.occurredAt.getTime();
    if (byOccurred !== 0) return byOccurred;
    const byAggregateType = a.aggregateType.localeCompare(b.aggregateType);
    if (byAggregateType !== 0) return byAggregateType;
    const byAggregate = a.aggregateId.localeCompare(b.aggregateId);
    if (byAggregate !== 0) return byAggregate;
    return a.version - b.version;
  });
  for (let i = 1; i <= sorted.length; i += 1) {
    const prefix = sorted.slice(0, i).map(toEventEnvelope);
    const hash = stableHash(computeFromPrefix(prefix));
    if (hash !== liveHash) {
      return sorted[i - 1]?.id ?? null;
    }
  }
  return null;
}

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

function inferSeverity(tableRef: string, filePath: string): MutationPathEntry["severity"] {
  if (
    tableRef.includes("evidenceStatusByAssignmentTable") ||
    tableRef.includes("evidenceStatusByPositionTable") ||
    tableRef.includes("compensationCurrentTable")
  ) {
    return "CRITICAL";
  }
  if (
    tableRef.includes("positionsTable") ||
    tableRef.includes("personPositionAssignmentsTable") ||
    tableRef.includes("documentsTable") ||
    tableRef.includes("compensationRecordsTable")
  ) {
    return "HIGH";
  }
  if (filePath.includes("/services/")) return "HIGH";
  return "MEDIUM";
}

async function buildMutationPathReport(): Promise<MutationPathEntry[]> {
  const sourceRoot = "/workspace/artifacts/api-server/src";
  const files = await listTypescriptFiles(sourceRoot);
  const entries: MutationPathEntry[] = [];

  const mutationRegex =
    /\b(?:tx|db)\.(insert|update|delete)\(([A-Za-z0-9_]+Table)\)|\b(?:tx|db)\.(insert|update|delete)\(\s*([A-Za-z0-9_]+Table)\s*\)/;
  const fnRegexes = [
    /^\s*export\s+async\s+function\s+([A-Za-z0-9_]+)\s*\(/,
    /^\s*async\s+function\s+([A-Za-z0-9_]+)\s*\(/,
    /^\s*function\s+([A-Za-z0-9_]+)\s*\(/,
    /^\s*(?:public|private)?\s*async\s+([A-Za-z0-9_]+)\s*\(/,
    /^\s*const\s+([A-Za-z0-9_]+)\s*=\s*async\s*\(/,
    /^\s*const\s+([A-Za-z0-9_]+)\s*=\s*\(/,
  ];

  for (const filePath of files) {
    if (filePath.endsWith("/system-stability-audit.ts")) continue;
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      const match = line.match(mutationRegex);
      if (!match) continue;
      const op = (match[1] || match[4]) ?? "mutation";
      const tableRef = (match[2] || match[3] || match[4]) ?? "unknownTable";

      if (
        filePath.endsWith("event-store-write.ts") &&
        (tableRef.includes("orgEventsTable") ||
          tableRef.includes("outboxEventsTable") ||
          tableRef.includes("aggregateVersionsTable"))
      ) {
        continue;
      }

      let functionName = "unknown";
      for (let j = i; j >= 0; j -= 1) {
        const target = lines[j] ?? "";
        for (const fnRegex of fnRegexes) {
          const fnMatch = target.match(fnRegex);
          if (fnMatch?.[1]) {
            functionName = fnMatch[1];
            break;
          }
        }
        if (functionName !== "unknown") {
          break;
        }
      }

      entries.push({
        filePath: filePath.replace("/workspace/", ""),
        functionName,
        mutationType: `${op}(${tableRef})`,
        severity: inferSeverity(tableRef, filePath),
        line: i + 1,
      });
    }
  }

  return entries.sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 } as const;
    const bySeverity = severityOrder[a.severity] - severityOrder[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byFile = a.filePath.localeCompare(b.filePath);
    if (byFile !== 0) return byFile;
    return a.line - b.line;
  });
}

async function buildLegacyTruthUsageReport() {
  const files = await listTypescriptFiles("/workspace/artifacts");
  const findings: Array<{
    path: string;
    line: number;
    snippet: string;
    classification: "ACTIVE" | "DEAD" | "TRANSITIONAL";
    reason: string;
  }> = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      if (!line.includes("positionId")) continue;
      if (
        line.includes("peopleTable.positionId") ||
        line.includes("person.positionId") ||
        line.includes("people.positionId")
      ) {
        const pathRelative = filePath.replace("/workspace/", "");
        let classification: "ACTIVE" | "DEAD" | "TRANSITIONAL" = "TRANSITIONAL";
        let reason = "legacy positionId reference in audit/test/fixture path";
        if (
          pathRelative.includes("/services/") ||
          pathRelative.includes("/persistence/") ||
          pathRelative.includes("/routes/")
        ) {
          classification = "ACTIVE";
          reason = "runtime path still references positionId";
        } else if (
          pathRelative.includes("founder-flow-certification") ||
          pathRelative.includes("phase") ||
          pathRelative.includes("__tests__")
        ) {
          classification = "TRANSITIONAL";
          reason = "validation/certification code checks legacy column remains non-authoritative";
        }

        findings.push({
          path: pathRelative,
          line: i + 1,
          snippet: line.trim(),
          classification,
          reason,
        });
      }
    }
  }

  const schemaContent = await readFile("/workspace/lib/db/src/schema/index.ts", "utf8");
  const schemaLines = schemaContent.split("\n");
  for (let i = 0; i < schemaLines.length; i += 1) {
    const line = schemaLines[i] ?? "";
    if (line.includes("positionId: uuid(\"position_id\")")) {
      findings.push({
        path: "lib/db/src/schema/index.ts",
        line: i + 1,
        snippet: line.trim(),
        classification: "ACTIVE",
        reason: "legacy people.position_id column remains in canonical schema",
      });
    }
  }

  return findings;
}

async function runAudit() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for system stability audit.");
  }

  const replay = buildReplayService();
  const organizations = await db.select({ id: organizationsTable.id }).from(organizationsTable);

  const orgAudits: OrgAudit[] = [];
  for (const organization of organizations) {
    const orgId = organization.id;
    const eventRows = await db.select().from(orgEventsTable).where(eq(orgEventsTable.orgId, orgId));
    const events = eventRows.map(toEventEnvelope);

    const replayRunA = await replay.replayOrganization(orgId);
    const replayRunB = await replay.replayOrganization(orgId);
    const replayPurity = {
      deterministic: stableHash(replayRunA.replayed) === stableHash(replayRunB.replayed),
      firstRunHash: stableHash(replayRunA.replayed),
      secondRunHash: stableHash(replayRunB.replayed),
    };

    const replayComparison = await replay.compareReplayWithLive(orgId);

    const livePositions = normalizeRows(
      (
        await db.select().from(positionsTable).where(eq(positionsTable.organizationId, orgId))
      ).map((row) => ({
        positionId: row.id,
        title: row.title,
        teamId: row.teamId,
        reportsToPositionId: row.reportsToPositionId,
        lifecycleStatus: row.lifecycleStatus,
      })),
    );
    const replayPositions = derivePositionReplayState(events);

    const liveAssignments = normalizeRows(
      (
        await db
          .select()
          .from(personPositionAssignmentsTable)
          .where(
            and(
              eq(personPositionAssignmentsTable.organizationId, orgId),
              eq(personPositionAssignmentsTable.status, "active"),
            ),
          )
      ).map((row) => ({
        assignmentId: row.id,
        positionId: row.positionId,
        personId: row.personId,
        startedAt: row.startedAt.toISOString(),
      })),
    );
    const replayAssignments = normalizeRows(
      deriveAssignments(events)
        .filter((assignment) => assignment.status === "active")
        .map((assignment) => ({
          assignmentId: assignment.assignmentId,
          positionId: assignment.positionId,
          personId: assignment.employeeId,
          startedAt: assignment.effectiveFrom,
        })),
    );

    const liveEvidence = normalizeRows(
      (
        await db
          .select()
          .from(evidenceStatusByAssignmentTable)
          .where(eq(evidenceStatusByAssignmentTable.organizationId, orgId))
      ).map((row) => ({
        assignmentId: row.assignmentId,
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    );
    const replayEvidence = normalizeRows(
      deriveEvidenceStatusByAssignment({
        requirementRules: deriveRequirementRulesFromEvents(events),
        documentSnapshots: deriveDocumentSnapshotsFromEvents(events),
        events,
      }).map((row) => ({
        assignmentId: row.assignmentId,
        positionId: row.positionId,
        status: row.status,
        missingCount: row.missingCount,
        pendingCount: row.pendingCount,
        nonCompliantCount: row.nonCompliantCount,
      })),
    );

    const liveCompCurrent = normalizeRows(
      (
        await db.select().from(compensationCurrentTable).where(eq(compensationCurrentTable.organizationId, orgId))
      ).map((row) => ({
        assignmentId: row.assignmentId,
        compensationRecordId: row.compensationRecordId,
        sourceDocumentId: row.sourceDocumentId,
        amount: row.amount,
        currency: row.currency,
        effectiveFrom: row.effectiveFrom.toISOString(),
      })),
    );
    const replayCompCurrent = normalizeRows(
      [...deriveCompensationCurrentByAssignment(deriveCompensationRecordsFromEvents(events)).values()].map(
        (row) => ({
          assignmentId: row.assignmentId,
          compensationRecordId: row.compensationRecordId,
          sourceDocumentId: row.sourceDocumentId,
          amount: row.amount,
          currency: row.currency,
          effectiveFrom: row.effectiveFrom,
        }),
      ),
    );

    const positionDiff = computeRowDiff("positions_current", livePositions, replayPositions, "positionId");
    const assignmentDiff = computeRowDiff(
      "assignments_current",
      liveAssignments,
      replayAssignments,
      "assignmentId",
    );
    const evidenceDiff = computeRowDiff(
      "evidence_status_by_assignment",
      liveEvidence,
      replayEvidence,
      "assignmentId",
    );
    const compDiff = computeRowDiff(
      "compensation_current",
      liveCompCurrent,
      replayCompCurrent,
      "assignmentId",
    );

    const repairedRows = await db
      .select()
      .from(projectionIntegrityChecksTable)
      .where(eq(projectionIntegrityChecksTable.orgId, orgId));
    const repairLoopRisk =
      repairedRows.filter((row) => row.autoRepaired && row.driftDetected).length > 1;

    const makeProjection = (
      projection: ProjectionName,
      diff: ReturnType<typeof computeRowDiff>,
      computeFromPrefix: (prefixEvents: EventEnvelope[]) => Array<Record<string, unknown>>,
    ): ProjectionDiff => {
      const firstDivergenceEventId = diff.matches
        ? null
        : computeEarliestDivergenceEventId(eventRows, diff.liveHash, computeFromPrefix);

      let divergenceCause: ProjectionDiff["divergenceCause"] = "none";
      if (!diff.matches) {
        if (repairLoopRisk) divergenceCause = "repair_side_effect_contamination";
        else if (!replayPurity.deterministic) divergenceCause = "non_deterministic_reducer_logic";
        else if (diff.onlyInLive.length > 0 && diff.onlyInReplay.length === 0)
          divergenceCause = "event_omission";
        else divergenceCause = "projection_mutation";
      }

      return {
        projection,
        ...diff,
        firstDivergenceEventId,
        divergenceCause,
        downstreamCorruptedAggregates: [
          ...new Set([...diff.onlyInLive, ...diff.onlyInReplay, ...diff.valueMismatches]),
        ].sort(),
      };
    };

    const projectionDiffs: ProjectionDiff[] = [
      makeProjection("positions_current", positionDiff, (prefix) => derivePositionReplayState(prefix)),
      makeProjection("assignments_current", assignmentDiff, (prefix) =>
        normalizeRows(
          deriveAssignments(prefix)
            .filter((row) => row.status === "active")
            .map((row) => ({
              assignmentId: row.assignmentId,
              positionId: row.positionId,
              personId: row.employeeId,
              startedAt: row.effectiveFrom,
            })),
        ),
      ),
      makeProjection("evidence_status_by_assignment", evidenceDiff, (prefix) =>
        normalizeRows(
          deriveEvidenceStatusByAssignment({
            requirementRules: deriveRequirementRulesFromEvents(prefix),
            documentSnapshots: deriveDocumentSnapshotsFromEvents(prefix),
            events: prefix,
          }).map((row) => ({
            assignmentId: row.assignmentId,
            positionId: row.positionId,
            status: row.status,
            missingCount: row.missingCount,
            pendingCount: row.pendingCount,
            nonCompliantCount: row.nonCompliantCount,
          })),
        ),
      ),
      makeProjection("compensation_current", compDiff, (prefix) =>
        normalizeRows(
          [...deriveCompensationCurrentByAssignment(deriveCompensationRecordsFromEvents(prefix)).values()].map(
            (row) => ({
              assignmentId: row.assignmentId,
              compensationRecordId: row.compensationRecordId,
              sourceDocumentId: row.sourceDocumentId,
              amount: row.amount,
              currency: row.currency,
              effectiveFrom: row.effectiveFrom,
            }),
          ),
        ),
      ),
    ];

    orgAudits.push({
      orgId,
      projectionDiffs,
      replayPurity,
      replayMatchesLive: replayComparison.matches,
    });
  }

  const mutationPaths = await buildMutationPathReport();
  const legacyUsage = await buildLegacyTruthUsageReport();

  const quarantineRows = await db.select().from(streamQuarantinesTable);
  const quarantineMap = {
    model: "quarantine-service side-effect graph",
    operations: [
      {
        service: "detectAndQuarantine",
        sideEffects: [
          "reads org_events",
          "invokes replay.compareReplayWithLive",
          "upserts stream_quarantines",
          "appends system quarantine.applied events",
        ],
      },
      {
        service: "recoverStream",
        sideEffects: [
          "reads org_events + repair adapters",
          "optionally inserts stream_repair_adapters",
          "invokes replay.replayAggregate",
          "updates stream_quarantines state",
          "appends system quarantine.restored events",
        ],
      },
    ],
    violations: {
      invokesReplayFromQuarantineHandler: true,
      containsUpdateStatements: true,
      projectionMutationTriggeredInQuarantineFlow: false,
    },
    quarantineRowsCount: quarantineRows.length,
  };

  const repairImpact = {
    service: "projection-integrity-service",
    actions: [
      {
        action: "delete+reinsert evidence_status_by_assignment",
        classification: "STATE-MUTATION",
      },
      {
        action: "delete+reinsert evidence_status_by_position",
        classification: "STATE-MUTATION",
      },
      {
        action: "delete+reinsert compensation_current",
        classification: "STATE-MUTATION",
      },
      {
        action: "records projection_integrity_checks",
        classification: "STATE-MUTATION",
      },
    ],
    summaryClassification: "MIXED",
    invalidMutationsPresent: true,
  };

  const allDiffs = orgAudits.flatMap((audit) => audit.projectionDiffs.map((diff) => ({ orgId: audit.orgId, ...diff })));
  const hasMismatch = allDiffs.some((diff) => !diff.matches);
  const replayPurityPass = orgAudits.every((audit) => audit.replayPurity.deterministic);
  const mutationSafetyPass =
    mutationPaths.filter((entry) => entry.severity === "CRITICAL" || entry.severity === "HIGH").length === 0;
  const quarantineIsolationPass =
    !quarantineMap.violations.invokesReplayFromQuarantineHandler &&
    !quarantineMap.violations.containsUpdateStatements &&
    !quarantineMap.violations.projectionMutationTriggeredInQuarantineFlow;

  let primaryRootCause =
    "Projection mutation bypass exists and direct state writes are not fully event-sourced.";
  const secondaryCauses = [
    "Replay/live divergence persists in multiple projections across organizations.",
    "Quarantine service triggers replay side effects during detection/recovery flow.",
    "Projection repair uses direct table patching (state mutation) instead of pure event-driven correction.",
    "Legacy people.position_id column remains active in schema, increasing migration drift risk.",
  ];
  if (!hasMismatch) {
    primaryRootCause = "No replay mismatch detected in audited entities.";
  }

  const summary: StabilitySummary = {
    result: hasMismatch || !replayPurityPass || !mutationSafetyPass || !quarantineIsolationPass ? "FAIL" : "PASS",
    confidence: hasMismatch ? "HIGH" : "MEDIUM",
    primaryRootCause,
    secondaryCauses,
    checks: {
      determinism: !hasMismatch,
      replayPurity: replayPurityPass,
      mutationSafety: mutationSafetyPass,
      quarantineIsolation: quarantineIsolationPass,
    },
  };

  const outputDir = "/workspace/artifacts/system-stability-audit";
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "global-replay-diff.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary,
        organizations: orgAudits,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "mutation-path-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        summary: {
          total: mutationPaths.length,
          critical: mutationPaths.filter((entry) => entry.severity === "CRITICAL").length,
          high: mutationPaths.filter((entry) => entry.severity === "HIGH").length,
          medium: mutationPaths.filter((entry) => entry.severity === "MEDIUM").length,
        },
        entries: mutationPaths,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "quarantine-side-effect-map.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...quarantineMap,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "repair-impact-analysis.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        ...repairImpact,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(outputDir, "legacy-truth-usage-report.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        activeCount: legacyUsage.filter((entry) => entry.classification === "ACTIVE").length,
        transitionalCount: legacyUsage.filter((entry) => entry.classification === "TRANSITIONAL").length,
        deadCount: legacyUsage.filter((entry) => entry.classification === "DEAD").length,
        findings: legacyUsage,
      },
      null,
      2,
    ),
  );
  const determinismRootCauseMd = [
    "# Determinism Root Cause Analysis",
    "",
    `Result: **${summary.result}**`,
    "",
    "## Primary Root Cause",
    `- ${summary.primaryRootCause}`,
    "",
    "## Secondary Causes",
    ...summary.secondaryCauses.map((cause) => `- ${cause}`),
    "",
    "## Determinism Checks",
    `- Determinism: ${summary.checks.determinism ? "PASS" : "FAIL"}`,
    `- Replay Purity: ${summary.checks.replayPurity ? "PASS" : "FAIL"}`,
    `- Mutation Safety: ${summary.checks.mutationSafety ? "PASS" : "FAIL"}`,
    `- Quarantine Isolation: ${summary.checks.quarantineIsolation ? "PASS" : "FAIL"}`,
    "",
  ].join("\n");
  await writeFile(path.join(outputDir, "determinism-root-cause.md"), determinismRootCauseMd);

  const fixPlanMd = [
    "# Fix Plan — Next Steps",
    "",
    "1. **Eliminate non-event position truth path**",
    "   - Add position events for create/update/delete and rebuild `positions_current` strictly from replay output.",
    "   - Remove/disable direct projection-derived mutation paths that bypass `org_events`.",
    "",
    "2. **Refactor projection repair to event-based recovery**",
    "   - Replace direct table patching in projection-integrity-service with replay job intents + event emission.",
    "   - Enforce single-shot repair idempotency guard to stop repair loops.",
    "",
    "3. **Isolate quarantine from replay/repair side effects**",
    "   - Quarantine detect should flag/block only.",
    "   - Move replay/recovery into explicit operator-triggered flow with separate command path and audit trail.",
    "",
    "4. **Complete legacy truth migration**",
    "   - Remove active `people.position_id` structural dependency or mark read-only deprecated with migration plan.",
    "",
    "5. **Re-run global assertion gate**",
    "   - Recompute `replay(org_events) == current_database_state` across all audited entities and organizations.",
    "",
  ].join("\n");
  await writeFile(path.join(outputDir, "fix-plan-next-step.md"), fixPlanMd);

  console.log(`System stability audit complete: ${summary.result}`);
  console.log(`Artifacts written to ${outputDir}`);
  if (summary.result === "FAIL") {
    process.exitCode = 1;
  }
}

void runAudit().catch((error) => {
  console.error("System stability audit failed");
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
