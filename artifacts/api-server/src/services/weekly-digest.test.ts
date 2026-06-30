import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyDigest, type DigestSignal } from "./weekly-digest.js";

const signals: DigestSignal[] = [
  { title: "Compliance audit overdue", severity: "red", dueDate: "2026-06-01" },
  { title: "Tech upgrade overdue", severity: "red", dueDate: "2026-05-20" },
  { title: "Onboarding in progress", severity: "yellow", dueDate: "2026-07-10" },
  { title: "Policy review", severity: "yellow", dueDate: null },
  { title: "BD pipeline overdue", severity: "red", dueDate: "2026-06-15" },
  { title: "Recruitment brief", severity: "yellow", dueDate: "2026-07-05" },
  { title: "Renewal", severity: "yellow", dueDate: "2026-08-01" },
];

test("counts red and yellow signals", () => {
  const d = buildWeeklyDigest({ tenantName: "Acme", dashboardUrl: "https://x/dash", signals });
  assert.equal(d.redCount, 3);
  assert.equal(d.yellowCount, 4);
});

test("top is capped at 5, red first, then most-overdue first", () => {
  const d = buildWeeklyDigest({ tenantName: "Acme", dashboardUrl: "https://x/dash", signals });
  assert.equal(d.top.length, 5);
  // All three reds first, ordered by earliest dueDate.
  assert.deepEqual(
    d.top.slice(0, 3).map((s) => s.title),
    ["Tech upgrade overdue", "Compliance audit overdue", "BD pipeline overdue"],
  );
  // Then yellows by dueDate.
  assert.equal(d.top[3].severity, "yellow");
  assert.equal(d.top[4].severity, "yellow");
});

test("excludes non-red/yellow severities defensively", () => {
  const withNoise = [
    ...signals,
    { title: "resolved thing", severity: "green" as unknown as "red" },
  ];
  const d = buildWeeklyDigest({ tenantName: "Acme", dashboardUrl: "https://x/dash", signals: withNoise });
  assert.equal(d.redCount + d.yellowCount, 7);
  assert.ok(!d.text.includes("resolved thing"));
});

test("text contains tenant, dashboard link, and the not-legal-advice footer", () => {
  const d = buildWeeklyDigest({ tenantName: "Acme Ltd", dashboardUrl: "https://app/dash", signals });
  assert.ok(d.text.includes("Acme Ltd"));
  assert.ok(d.text.includes("https://app/dash"));
  assert.ok(d.text.trimEnd().endsWith("TeamFrame is not legal advice."));
  assert.ok(d.subject.includes("Acme Ltd"));
});

test("handles an empty signal list", () => {
  const d = buildWeeklyDigest({ tenantName: "Quiet Co", dashboardUrl: "https://x/dash", signals: [] });
  assert.equal(d.redCount, 0);
  assert.equal(d.yellowCount, 0);
  assert.equal(d.top.length, 0);
  assert.ok(d.text.includes("No open red or yellow signals"));
});
