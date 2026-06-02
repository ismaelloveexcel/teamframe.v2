import { SeedData, Position, Employee, ComplianceItem } from "../data/seed";

export interface PositionEdit {
  id: string;
  title: string;
  department: string;
}

export interface ControlState {
  scenarioId: string;
  selectedPositionId: string;
  selectedEmployeeId: string | null;
  resolvedActions: string[];
  positionEdits: PositionEdit[];
  onboardingCompleted: string[];
}

export interface OrgNode {
  position: Position;
  employee: Employee | null;
  children: OrgNode[];
  signalLevel: "critical" | "warning" | "info" | null;
}

export interface Signal {
  id: string;
  positionId: string;
  level: "critical" | "warning" | "info";
  message: string;
  detail: string;
}

export interface Action {
  id: string;
  positionId: string;
  type: "assign_employee" | "fix_compliance" | "complete_offboarding" | "review_capacity" | "update_descriptions" | "update_job_desc" | "assign_document" | "complete_onboarding";
  label: string;
  dueIn: string;
  relatedSignalId: string | null;
}

export interface RiskItem {
  positionId: string;
  positionTitle: string;
  category: "vacancy" | "offboarding" | "leave" | "compliance" | "overload" | "single_point";
  level: "critical" | "warning" | "info";
  score: number;
  message: string;
  detail: string;
}

export interface UIState {
  selectedPosition: Position | null;
  selectedEmployee: Employee | null;
  orgTree: OrgNode[];
  signals: Signal[];
  actions: Action[];
  complianceView: ComplianceItem[];
  directReports: { position: Position; employee: Employee | null }[];
  stats: {
    totalPositions: number;
    filledPositions: number;
    vacantPositions: number;
    onLeaveCount: number;
    offboardingCount: number;
    filledPct: number;
    vacantPct: number;
    onLeavePct: number;
    offboardingPct: number;
  };
  signalSummary: { critical: number; high: number; medium: number; low: number };
  risks: RiskItem[];
  riskScore: number;
  riskBreakdown: { vacancy: number; offboarding: number; leave: number; compliance: number; overload: number; single_point: number };
}

export const SCENARIOS: Record<string, Partial<ControlState>> = {
  DEFAULT_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: "e-001", onboardingCompleted: [] },
  VACANT_POSITION_FOCUS: { selectedPositionId: "3-002", selectedEmployeeId: null, onboardingCompleted: [] },
  ON_LEAVE_EMPLOYEE_FOCUS: { selectedPositionId: "2-002", selectedEmployeeId: "e-006", onboardingCompleted: [] },
  OFFBOARDING_EMPLOYEE_FOCUS: { selectedPositionId: "2-004", selectedEmployeeId: "e-008", onboardingCompleted: [] },
  MISSING_COMPLIANCE_FOCUS: { selectedPositionId: "2-001", selectedEmployeeId: "e-005", onboardingCompleted: [] },
  FULL_ORGANIZATION_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: null, onboardingCompleted: [] },
};

function applyPositionEdits(seed: SeedData, edits: PositionEdit[]): SeedData {
  return {
    ...seed,
    positions: seed.positions.map((p) => {
      const edit = edits.find((e) => e.id === p.id);
      if (!edit) return p;
      return { ...p, title: edit.title, department: edit.department };
    }),
  };
}

function buildOrgTree(
  seed: SeedData,
  signals: Signal[],
  parentId: string | null
): OrgNode[] {
  const children = seed.positions
    .filter((p) => p.reportsToId === parentId)
    .sort((a, b) => a.order - b.order);

  return children.map((position) => {
    const employee = seed.employees.find((e) => e.positionId === position.id) ?? null;
    const posSignals = signals.filter((s) => s.positionId === position.id);
    let signalLevel: OrgNode["signalLevel"] = null;
    if (posSignals.some((s) => s.level === "critical")) signalLevel = "critical";
    else if (posSignals.some((s) => s.level === "warning")) signalLevel = "warning";
    else if (posSignals.some((s) => s.level === "info")) signalLevel = "info";

    return {
      position,
      employee,
      children: buildOrgTree(seed, signals, position.id),
      signalLevel,
    };
  });
}

function computeSignals(seed: SeedData, resolvedActions: string[]): Signal[] {
  const signals: Signal[] = [];

  for (const position of seed.positions) {
    const employee = seed.employees.find((e) => e.positionId === position.id);

    if (!employee) {
      const id = `sig-vacant-${position.id}`;
      if (!resolvedActions.includes(id)) {
        signals.push({
          id,
          positionId: position.id,
          level: "info",
          message: "Vacant Position",
          detail: `${position.title} has no assigned employee`,
        });
      }
    } else if (employee.status === "on_leave") {
      const id = `sig-leave-${position.id}`;
      if (!resolvedActions.includes(id)) {
        signals.push({
          id,
          positionId: position.id,
          level: "info",
          message: "Employee On Leave",
          detail: `${employee.name} is currently on leave`,
        });
      }
    } else if (employee.status === "offboarding") {
      const id = `sig-offboard-${position.id}`;
      if (!resolvedActions.includes(id)) {
        signals.push({
          id,
          positionId: position.id,
          level: "critical",
          message: "Offboarding in Progress",
          detail: `${employee.name} is offboarding — position will be vacant`,
        });
      }
    }

    const complianceIssues = seed.compliance.filter(
      (c) => c.positionId === position.id && c.status !== "complete"
    );
    for (const issue of complianceIssues) {
      const id = `sig-compliance-${issue.id}`;
      if (!resolvedActions.includes(id)) {
        signals.push({
          id,
          positionId: position.id,
          level: "warning",
          message: `Missing Compliance`,
          detail: issue.description,
        });
      }
    }
  }

  const highTurnoverId = "sig-high-turnover-engineering";
  if (!resolvedActions.includes(highTurnoverId)) {
    signals.push({
      id: highTurnoverId,
      positionId: "2-001",
      level: "critical",
      message: "High Turnover Risk",
      detail: "Engineering team workload at capacity",
    });
  }

  return signals;
}

function computeActions(signals: Signal[], resolvedActions: string[]): Action[] {
  const actions: Action[] = [];

  for (const signal of signals) {
    if (signal.level === "info" && signal.message === "Vacant Position") {
      const id = `act-assign-${signal.positionId}`;
      if (!resolvedActions.includes(id)) {
        actions.push({
          id,
          positionId: signal.positionId,
          type: "assign_employee",
          label: "Assign Employee",
          dueIn: "Due in 2 weeks",
          relatedSignalId: signal.id,
        });
      }
    }
    if (signal.message === "Missing Compliance") {
      const id = `act-compliance-${signal.positionId}`;
      if (!resolvedActions.includes(id)) {
        actions.push({
          id,
          positionId: signal.positionId,
          type: "fix_compliance",
          label: "Fix Compliance",
          dueIn: "Due in 1 week",
          relatedSignalId: signal.id,
        });
      }
    }
    if (signal.message === "Offboarding in Progress") {
      const id = `act-offboard-${signal.positionId}`;
      if (!resolvedActions.includes(id)) {
        actions.push({
          id,
          positionId: signal.positionId,
          type: "complete_offboarding",
          label: "Complete Offboarding",
          dueIn: "Due in 3 days",
          relatedSignalId: signal.id,
        });
      }
    }
    if (signal.message === "High Turnover Risk") {
      const id = `act-review-capacity`;
      if (!resolvedActions.includes(id) && !actions.find((a) => a.id === id)) {
        actions.push({
          id,
          positionId: signal.positionId,
          type: "review_capacity",
          label: "Review Team Capacity",
          dueIn: "Due in 3 days",
          relatedSignalId: signal.id,
        });
      }
    }
  }

  const descId = "act-update-descriptions";
  if (!resolvedActions.includes(descId)) {
    actions.push({
      id: descId,
      positionId: "1-001",
      type: "update_descriptions",
      label: "Update Job Descriptions",
      dueIn: "Due in 1 week",
      relatedSignalId: null,
    });
  }

  const jobDescId = "act-update-jobdesc";
  if (!resolvedActions.includes(jobDescId)) {
    actions.push({
      id: jobDescId,
      positionId: "1-001",
      type: "update_job_desc",
      label: "Update Job Description",
      dueIn: "Due in 3 days",
      relatedSignalId: null,
    });
  }

  const docId = "act-assign-doc";
  if (!resolvedActions.includes(docId)) {
    actions.push({
      id: docId,
      positionId: "2-001",
      type: "assign_document",
      label: "Assign Document",
      dueIn: "Due in 5 days",
      relatedSignalId: null,
    });
  }

  const onboardId = "act-complete-onboarding";
  if (!resolvedActions.includes(onboardId)) {
    actions.push({
      id: onboardId,
      positionId: "3-001",
      type: "complete_onboarding",
      label: "Complete Onboarding",
      dueIn: "Due in 1 week",
      relatedSignalId: null,
    });
  }

  return actions;
}

function computeRisks(seed: SeedData, signals: Signal[]): RiskItem[] {
  const risks: RiskItem[] = [];
  for (const signal of signals) {
    const pos = seed.positions.find((p) => p.id === signal.positionId);
    if (!pos) continue;
    let category: RiskItem["category"] = "compliance";
    let score = 0;
    if (signal.message === "Vacant Position") { category = "vacancy"; score = 30; }
    else if (signal.message === "Employee On Leave") { category = "leave"; score = 20; }
    else if (signal.message === "Offboarding in Progress") { category = "offboarding"; score = 50; }
    else if (signal.message === "Missing Compliance") { category = "compliance"; score = 35; }
    else if (signal.message === "High Turnover Risk") { category = "overload"; score = 40; }
    risks.push({
      positionId: pos.id,
      positionTitle: pos.title,
      category,
      level: signal.level,
      score,
      message: signal.message,
      detail: signal.detail,
    });
  }

  const reportCounts = new Map<string, number>();
  for (const pos of seed.positions) {
    if (!pos.reportsToId) continue;
    reportCounts.set(pos.reportsToId, (reportCounts.get(pos.reportsToId) ?? 0) + 1);
  }
  for (const [managerId, count] of reportCounts.entries()) {
    if (count >= 5) {
      const pos = seed.positions.find((p) => p.id === managerId);
      if (pos) {
        const emp = seed.employees.find((e) => e.positionId === pos.id);
        risks.push({
          positionId: pos.id,
          positionTitle: pos.title,
          category: "overload",
          level: "warning",
          score: 25,
          message: "Overloaded Manager",
          detail: `${emp?.name ?? pos.title} has ${count} direct reports (recommended max: 5)`,
        });
      }
    }
  }

  const deptEmployees = new Map<string, string[]>();
  for (const emp of seed.employees) {
    const pos = seed.positions.find((p) => p.id === emp.positionId);
    if (pos) {
      const list = deptEmployees.get(pos.department) ?? [];
      list.push(emp.id);
      deptEmployees.set(pos.department, list);
    }
  }
  for (const [, ids] of deptEmployees.entries()) {
    if (ids.length === 1) {
      const emp = seed.employees.find((e) => e.id === ids[0]);
      const pos = seed.positions.find((p) => p.id === emp?.positionId);
      if (pos && emp) {
        risks.push({
          positionId: pos.id,
          positionTitle: pos.title,
          category: "single_point",
          level: "warning",
          score: 20,
          message: "Single Point of Failure",
          detail: `${emp.name} is the only person in ${pos.department}`,
        });
      }
    }
  }

  return risks.sort((a, b) => b.score - a.score);
}

export function computeUIState(seed: SeedData, controlState: ControlState): UIState {
  const seedWithEdits = applyPositionEdits(seed, controlState.positionEdits ?? []);
  const scenario = SCENARIOS[controlState.scenarioId] ?? {};
  const mergedControl: ControlState = {
    ...controlState,
    ...scenario,
    resolvedActions: controlState.resolvedActions,
    positionEdits: controlState.positionEdits ?? [],
    onboardingCompleted: controlState.onboardingCompleted ?? [],
  };

  const selectedPosition = seedWithEdits.positions.find((p) => p.id === mergedControl.selectedPositionId) ?? null;
  const selectedEmployee = mergedControl.selectedEmployeeId
    ? (seed.employees.find((e) => e.id === mergedControl.selectedEmployeeId) ?? null)
    : selectedPosition
    ? (seed.employees.find((e) => e.positionId === selectedPosition.id) ?? null)
    : null;

  const signals = computeSignals(seedWithEdits, mergedControl.resolvedActions);
  const orgTree = buildOrgTree(seedWithEdits, signals, null);
  const actions = computeActions(signals, mergedControl.resolvedActions);

  const directReportPositions = selectedPosition
    ? seedWithEdits.positions
        .filter((p) => p.reportsToId === selectedPosition.id)
        .sort((a, b) => a.order - b.order)
        .map((p) => ({
          position: p,
          employee: seed.employees.find((e) => e.positionId === p.id) ?? null,
        }))
    : [];

  const complianceView = seedWithEdits.compliance.filter(
    (c) => !selectedPosition || c.positionId === selectedPosition.id
  );

  const totalPositions = seedWithEdits.positions.length;
  const filled = seed.employees.filter((e) => e.status !== "offboarding");
  const filledPositions = filled.length;
  const vacantPositions = totalPositions - seed.employees.length;
  const onLeaveCount = seed.employees.filter((e) => e.status === "on_leave").length;
  const offboardingCount = seed.employees.filter((e) => e.status === "offboarding").length;

  const signalSummary = {
    critical: signals.filter((s) => s.level === "critical").length,
    high: Math.floor(signals.length * 0.3),
    medium: Math.floor(signals.length * 0.4),
    low: Math.floor(signals.length * 0.2),
  };

  const risks = computeRisks(seedWithEdits, signals);
  const riskScore = risks.reduce((sum, r) => sum + r.score, 0);
  const riskBreakdown = {
    vacancy: risks.filter((r) => r.category === "vacancy").reduce((s, r) => s + r.score, 0),
    offboarding: risks.filter((r) => r.category === "offboarding").reduce((s, r) => s + r.score, 0),
    leave: risks.filter((r) => r.category === "leave").reduce((s, r) => s + r.score, 0),
    compliance: risks.filter((r) => r.category === "compliance").reduce((s, r) => s + r.score, 0),
    overload: risks.filter((r) => r.category === "overload").reduce((s, r) => s + r.score, 0),
    single_point: risks.filter((r) => r.category === "single_point").reduce((s, r) => s + r.score, 0),
  };

  return {
    selectedPosition,
    selectedEmployee,
    orgTree,
    signals,
    actions,
    complianceView,
    directReports: directReportPositions,
    stats: {
      totalPositions,
      filledPositions,
      vacantPositions,
      onLeaveCount,
      offboardingCount,
      filledPct: Math.round((filledPositions / totalPositions) * 1000) / 10,
      vacantPct: Math.round((vacantPositions / totalPositions) * 1000) / 10,
      onLeavePct: Math.round((onLeaveCount / totalPositions) * 1000) / 10,
      offboardingPct: Math.round((offboardingCount / totalPositions) * 1000) / 10,
    },
    signalSummary,
    risks,
    riskScore,
    riskBreakdown,
  };
}
