import { ComplianceItem, Employee, Position, SeedData } from "../data/seed";

export interface PositionEdit {
  id: string;
  title: string;
  department: string;
}

export type ActionStatus = "open" | "in_progress" | "completed";
export type ActionPriority = "critical" | "high" | "normal" | "low";
export type PositionStatus = "filled" | "vacant" | "frozen";
export type RiskCategory = "missing_document" | "expired_document" | "policy_ack_overdue" | "onboarding_overdue";

export interface ActionOverride {
  status?: ActionStatus;
  ownerId?: string;
  ownerRole?: string;
  dueDate?: string;
  comments?: string[];
}

export interface ControlState {
  scenarioId: string;
  selectedPositionId: string;
  selectedEmployeeId: string | null;
  resolvedActions: string[];
  positionEdits: PositionEdit[];
  onboardingCompleted: string[];
  actionOverrides: Record<string, ActionOverride>;
}

export interface Signal {
  id: string;
  requirementKey: string;
  category: RiskCategory;
  positionId: string;
  employeeId: string | null;
  level: "critical" | "warning" | "info";
  cause: string;
  impact: string;
  recommendedAction: string;
}

export interface ActionItem {
  id: string;
  linkedRiskId: string;
  requirementKey: string;
  title: string;
  priority: ActionPriority;
  ownerId: string;
  ownerRole: string;
  assignedBy: string;
  dueDate: string;
  status: ActionStatus;
  relatedEmployeeId: string | null;
  relatedEmployeeName: string;
  relatedPositionId: string;
  relatedPositionTitle: string;
  relatedRequirement: string;
  comments: string[];
}

export interface RiskItem {
  id: string;
  positionId: string;
  positionTitle: string;
  category: RiskCategory;
  cause: string;
  impact: string;
  recommendedAction: string;
  linkedActionId: string;
}

export interface EmployeeDirectoryRow {
  employeeId: string;
  employeeName: string;
  positionTitle: string;
  department: string;
  email: string;
  phone: string;
  managerName: string;
  status: Employee["status"];
}

export interface FinanceRow {
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  manager: string;
  employmentStatus: string;
  salary: number;
  bankName: string;
  accountNumber: string;
  joinDate: string;
}

export interface OrgNode {
  position: Position;
  employee: Employee | null;
  children: OrgNode[];
  signalLevel: "critical" | "warning" | "info" | null;
}

export interface UIState {
  selectedPosition: Position | null;
  selectedEmployee: Employee | null;
  selectedPositionStatus: PositionStatus | null;
  selectedPositionMissingItems: string[];
  orgTree: OrgNode[];
  actions: ActionItem[];
  risks: RiskItem[];
  complianceView: ComplianceItem[];
  employeeDirectory: EmployeeDirectoryRow[];
  financeRows: FinanceRow[];
  stats: {
    totalPositions: number;
    filledPositions: number;
    vacantPositions: number;
    criticalVacancies: number;
    needsAttention: number;
    dueSoon: number;
  };
}

function applyPositionEdits(seed: SeedData, edits: PositionEdit[]): SeedData {
  return {
    ...seed,
    positions: seed.positions.map((position) => {
      const edit = edits.find((item) => item.id === position.id);
      if (!edit) return position;
      return { ...position, title: edit.title, department: edit.department };
    }),
  };
}

function employeeForPosition(seed: SeedData, positionId: string): Employee | null {
  return seed.employees.find((employee) => employee.positionId === positionId) ?? null;
}

function managerName(seed: SeedData, position: Position): string {
  if (!position.reportsToId) return "—";
  const managerPosition = seed.positions.find((item) => item.id === position.reportsToId);
  if (!managerPosition) return "—";
  return employeeForPosition(seed, managerPosition.id)?.name ?? managerPosition.title;
}

function inferPositionStatus(position: Position, employee: Employee | null): PositionStatus {
  if (position.lifecycleStatus === "frozen") return "frozen";
  return employee ? "filled" : "vacant";
}

function daysSince(dateString: string): number {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return 0;
  const diff = Date.now() - parsed.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function addDaysIso(days: number): string {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function actionPriorityFor(category: RiskCategory): ActionPriority {
  if (category === "expired_document") return "critical";
  if (category === "missing_document") return "high";
  return "normal";
}

function actionDueDateFor(category: RiskCategory): string {
  if (category === "expired_document") return addDaysIso(2);
  if (category === "missing_document") return addDaysIso(5);
  if (category === "policy_ack_overdue") return addDaysIso(7);
  return addDaysIso(7);
}

function riskFromCompliance(issue: ComplianceItem, position: Position, employee: Employee | null): Signal {
  const category: RiskCategory = issue.status === "expired" ? "expired_document" : "missing_document";
  const signalId = `risk-${issue.id}`;
  return {
    id: signalId,
    requirementKey: `${issue.positionId}:${issue.type.toLowerCase().replace(/\s+/g, "-")}`,
    category,
    positionId: issue.positionId,
    employeeId: employee?.id ?? null,
    level: issue.status === "expired" ? "critical" : "warning",
    cause: issue.description,
    impact: `${position.title} cannot be considered fully compliant.`,
    recommendedAction: issue.status === "expired" ? "Upload updated document" : "Upload required document",
  };
}

function onboardingSignal(seed: SeedData, employee: Employee): Signal | null {
  const staleDays = daysSince(employee.startDate);
  if (employee.onboardingStatus === "complete" || staleDays <= 30) {
    return null;
  }

  return {
    id: `risk-onboarding-${employee.id}`,
    requirementKey: `${employee.id}:onboarding`,
    category: "onboarding_overdue",
    positionId: employee.positionId,
    employeeId: employee.id,
    level: "warning",
    cause: `Onboarding is still ${employee.onboardingStatus.replace("_", " ")} after ${staleDays} days.`,
    impact: "Operational readiness remains incomplete.",
    recommendedAction: "Complete onboarding task",
  };
}

function buildSignals(seed: SeedData): Signal[] {
  const signals: Signal[] = [];

  for (const complianceIssue of seed.compliance.filter((item) => item.status !== "complete")) {
    const position = seed.positions.find((item) => item.id === complianceIssue.positionId);
    if (!position) continue;
    const employee = employeeForPosition(seed, position.id);
    signals.push(riskFromCompliance(complianceIssue, position, employee));
  }

  for (const employee of seed.employees) {
    const signal = onboardingSignal(seed, employee);
    if (signal) {
      signals.push(signal);
    }
  }

  return signals;
}

function buildActions(seed: SeedData, signals: Signal[], controlState: ControlState): ActionItem[] {
  return signals.map((signal) => {
    const position = seed.positions.find((item) => item.id === signal.positionId);
    const employee = signal.employeeId ? seed.employees.find((item) => item.id === signal.employeeId) ?? null : null;
    const manager = position ? managerName(seed, position) : "People Operations";
    const actionId = `action-${signal.id}`;
    const overrides = controlState.actionOverrides[actionId] ?? {};
    const completed = controlState.resolvedActions.includes(actionId) || controlState.resolvedActions.includes(signal.id);

    return {
      id: actionId,
      linkedRiskId: signal.id,
      requirementKey: signal.requirementKey,
      title: signal.recommendedAction,
      priority: actionPriorityFor(signal.category),
      ownerId: overrides.ownerId ?? (employee?.id ?? `manager:${position?.id ?? "unknown"}`),
      ownerRole: overrides.ownerRole ?? (employee ? "employee" : "manager"),
      assignedBy: "system",
      dueDate: overrides.dueDate ?? actionDueDateFor(signal.category),
      status: completed ? "completed" : overrides.status ?? "open",
      relatedEmployeeId: employee?.id ?? null,
      relatedEmployeeName: employee?.name ?? "Vacant / Unassigned",
      relatedPositionId: signal.positionId,
      relatedPositionTitle: position?.title ?? "Unknown Position",
      relatedRequirement: signal.cause,
      comments: overrides.comments ?? [],
    };
  });
}

function openRisksFromSignals(seed: SeedData, signals: Signal[], actions: ActionItem[]): RiskItem[] {
  const actionByRiskId = new Map(actions.map((action) => [action.linkedRiskId, action]));
  return signals
    .filter((signal) => (actionByRiskId.get(signal.id)?.status ?? "open") !== "completed")
    .map((signal) => {
      const position = seed.positions.find((item) => item.id === signal.positionId);
      const action = actionByRiskId.get(signal.id);
      return {
        id: signal.id,
        positionId: signal.positionId,
        positionTitle: position?.title ?? "Unknown Position",
        category: signal.category,
        cause: signal.cause,
        impact: signal.impact,
        recommendedAction: signal.recommendedAction,
        linkedActionId: action?.id ?? "",
      };
    });
}

function buildOrgTree(seed: SeedData, risks: RiskItem[], parentId: string | null): OrgNode[] {
  const children = seed.positions
    .filter((position) => position.reportsToId === parentId)
    .sort((a, b) => a.order - b.order);

  return children.map((position) => {
    const employee = employeeForPosition(seed, position.id);
    const positionRisks = risks.filter((risk) => risk.positionId === position.id);
    const signalLevel: OrgNode["signalLevel"] =
      positionRisks.some((risk) => risk.category === "expired_document")
        ? "critical"
        : positionRisks.length > 0
        ? "warning"
        : employee?.status === "on_leave"
        ? "info"
        : null;

    return {
      position,
      employee,
      signalLevel,
      children: buildOrgTree(seed, risks, position.id),
    };
  });
}

function buildEmployeeDirectory(seed: SeedData): EmployeeDirectoryRow[] {
  return seed.employees.map((employee) => {
    const position = seed.positions.find((item) => item.id === employee.positionId);
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      positionTitle: position?.title ?? "Unknown Position",
      department: position?.department ?? "Unknown",
      email: employee.email,
      phone: employee.phone,
      managerName: position ? managerName(seed, position) : "—",
      status: employee.status,
    };
  });
}

function buildFinanceRows(seed: SeedData): FinanceRow[] {
  return seed.employees.map((employee) => {
    const position = seed.positions.find((item) => item.id === employee.positionId);
    return {
      employeeId: employee.id,
      employeeName: employee.name,
      position: position?.title ?? "Unknown Position",
      department: position?.department ?? "Unknown",
      manager: position ? managerName(seed, position) : "—",
      employmentStatus:
        employee.status === "active"
          ? "Active"
          : employee.status === "on_leave"
          ? "On Leave"
          : "Offboarding",
      salary: employee.salary,
      bankName: employee.bankName,
      accountNumber: employee.bankAccount,
      joinDate: employee.startDate,
    };
  });
}

export function computeUIState(seed: SeedData, controlState: ControlState): UIState {
  const seedWithEdits = applyPositionEdits(seed, controlState.positionEdits ?? []);
  const selectedPosition =
    seedWithEdits.positions.find((position) => position.id === controlState.selectedPositionId) ?? null;
  const selectedEmployee = controlState.selectedEmployeeId
    ? seedWithEdits.employees.find((employee) => employee.id === controlState.selectedEmployeeId) ?? null
    : selectedPosition
    ? employeeForPosition(seedWithEdits, selectedPosition.id)
    : null;

  const signals = buildSignals(seedWithEdits);
  const actions = buildActions(seedWithEdits, signals, controlState);
  const risks = openRisksFromSignals(seedWithEdits, signals, actions);

  const statusMap = seedWithEdits.positions.map((position) => ({
    position,
    status: inferPositionStatus(position, employeeForPosition(seedWithEdits, position.id)),
  }));

  const now = new Date();
  const soonThreshold = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const activeActions = actions.filter((action) => action.status !== "completed");
  const overdueActions = activeActions.filter((action) => new Date(action.dueDate).getTime() < now.getTime());
  const dueSoonActions = activeActions.filter((action) => {
    const due = new Date(action.dueDate).getTime();
    return due >= now.getTime() && due <= soonThreshold.getTime();
  });

  const selectedPositionMissingItems = risks
    .filter((risk) => risk.positionId === selectedPosition?.id)
    .map((risk) => risk.cause);

  return {
    selectedPosition,
    selectedEmployee,
    selectedPositionStatus: selectedPosition
      ? inferPositionStatus(selectedPosition, employeeForPosition(seedWithEdits, selectedPosition.id))
      : null,
    selectedPositionMissingItems,
    orgTree: buildOrgTree(seedWithEdits, risks, null),
    actions,
    risks,
    complianceView: seedWithEdits.compliance.filter(
      (item) => !selectedPosition || item.positionId === selectedPosition.id
    ),
    employeeDirectory: buildEmployeeDirectory(seedWithEdits),
    financeRows: buildFinanceRows(seedWithEdits),
    stats: {
      totalPositions: seedWithEdits.positions.length,
      filledPositions: statusMap.filter((item) => item.status === "filled").length,
      vacantPositions: statusMap.filter((item) => item.status === "vacant").length,
      criticalVacancies: statusMap.filter(
        (item) => item.status === "vacant" && item.position.isCriticalPosition
      ).length,
      needsAttention: overdueActions.length,
      dueSoon: dueSoonActions.length,
    },
  };
}
