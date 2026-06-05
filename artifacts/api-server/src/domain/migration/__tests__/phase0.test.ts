import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBackfillEvents,
  shouldRunDualWrite,
  verifyCutover,
  type LegacySnapshot,
} from "../phase0";

const snapshot: LegacySnapshot = {
  orgId: "00000000-0000-4000-8000-000000000111",
  positions: [{ id: "pos-1", title: "CEO", reportsToId: null }],
  assignments: [
    {
      id: "asg-1",
      positionId: "pos-1",
      employeeId: "emp-1",
      effectiveFrom: "2026-01-01",
    },
  ],
  documents: [
    {
      id: "doc-1",
      assignmentId: "asg-1",
      positionId: "pos-1",
      type: "contract",
      status: "signed",
    },
  ],
};

test("Phase 0: dual-write runs only when legacy mode is present and enabled", () => {
  assert.equal(
    shouldRunDualWrite({
      enableDualWrite: true,
      legacyModePresent: true,
    }),
    true,
  );
  assert.equal(
    shouldRunDualWrite({
      enableDualWrite: true,
      legacyModePresent: false,
    }),
    false,
  );
  assert.equal(
    shouldRunDualWrite({
      enableDualWrite: false,
      legacyModePresent: true,
    }),
    false,
  );
});

test("Phase 0: snapshot backfill creates deterministic bootstrapping events", () => {
  const events = buildBackfillEvents(snapshot, "11111111-1111-4111-8111-111111111111");
  assert.equal(events.length, 3);
  assert.equal(events[0]?.eventType, "position.created");
  assert.equal(events[1]?.eventType, "assignment.started");
  assert.equal(events[2]?.eventType, "document.uploaded");
});

test("Phase 0: cutover verification returns deterministic hash comparison", () => {
  const ok = verifyCutover({
    snapshotProjection: { positions: 1, assignments: 1 },
    replayProjection: { positions: 1, assignments: 1 },
  });
  assert.equal(ok.matched, true);

  const notOk = verifyCutover({
    snapshotProjection: { positions: 1, assignments: 1 },
    replayProjection: { positions: 2, assignments: 1 },
  });
  assert.equal(notOk.matched, false);
});

