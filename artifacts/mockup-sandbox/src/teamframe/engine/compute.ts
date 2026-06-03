import { type ComplianceItem, type CompensationComponent, type Employee, type Position, type SeedData } from "../data/seed";

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
  type: "assign_employee" | "fix_compliance" | "complete_offboarding" | "review_capacity" | "update_descriptions";
  label: string;
  dueIn: string;
  relatedSignalId: string | null;
}

export interface RiskItem {
  positionId: string;
  positionTitle: string;
  category: "vacancy" | "offboarding" | "leave" | "compliance" | "overload";
  level: "critical" | "warning" | "info";
  score: number;
  message: string;
  detail: string;
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
  totalCompensation: number;
  currency: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  joinDate: string;
}

export interface EmployeeProfileView {
  employee: Employee;
  position: Position;
  managerName: string;
  directReports: { position: Position; employee: Employee | null }[];
  readinessScore: number;
  missingItems: string[];
  compensationComponents: CompensationComponent[];
  totalCompensation: number;
}

export interface UIState {
  selectedPosition: Position | null;
  selectedEmployee: Employee | null;
  selectedProfile: EmployeeProfileView | null;
  orgTree: OrgNode[];
  signals: Signal[];
  actions: Action[];
  complianceView: ComplianceItem[];
  employeeDirectory: EmployeeDirectoryRow[];
  financeRows: FinanceRow[];
  stats: {
    totalPositions: number;
    filledPositions: number;
    vacantPositions: number;
    onLeaveCount: number;
    offboardingCount: number;
    openRisks: number;
    openActions: number;
  };
  signalSummary: { critical: number; warning: number; info: number };
  risks: RiskItem[];
  riskScore: number;
}

export const SCENARIOS: Record<string, Partial<ControlState>> = {
  DEFAULT_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: "e-001", onboardingCompleted: [] },
  VACANT_POSITION_FOCUS: { selectedPositionId: "3-002", selectedEmployeeId: null, onboardingCompleted: [] },
  ON_LEAVE_EMPLOYEE_FOCUS: { selectedPositionId: "2-002", selectedEmployeeId: "e-006", onboardingCompleted: [] },
  OFFBOARDING_EMPLOYEE_FOCUS: { selectedPositionId: "2-003", selectedEmployeeId: null, onboardingCompleted: [] },
  MISSING_COMPLIANCE_FOCUS: { selectedPositionId: "2-001", selectedEmployeeId: "e-005", onboardingCompleted: [] },
  FULL_ORGANIZATION_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: null, onboardingCompleted: [] },
};

function employeeForPosition(seed: SeedData, positionId: string): Employee | null {
  return seed.employees.find((employee) => employee.positionId === positionId) ?? null;
}

function compensationTotal(components: CompensationComponent[]): number {
  return components.reduce((sum, component) => sum + component.amount, 0);
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

function managerName(seed: SeedData, position: Position): string {
  if (!position.reportsToId) return "—";
  const managerPosition = seed.positions.find((item) => item.id === position.reportsToId);
  if (!managerPosition) return "—";
  const managerEmployee = employeeForPosition(seed, managerPosition.id);
  return managerEmployee?.name ?? managerPosition.title;
}

function computeSignals(seed: SeedData): Signal[] {
  const signals: Signal[] = [];
  for (const position of seed.positions) {
    const employee = employeeForPosition(seed, position.id);
    if (!employee) {
      signals.push({ id: `sig-vacant-${position.id}`, positionId: position.id, level: "warning", message: "Vacant Position", detail: `${position.title} has no assigned employee` });
      continue;
    }
    if (employee.status === "on_leave") {
      signals.push({ id: `sig-leave-${position.id}`, positionId: position.id, level: "info", message: "Employee On Leave", detail: `${employee.name} is currently on leave` });
    }
    if (employee.status === "offboarding") {
      signals.push({ id: `sig-offboard-${position.id}`, positionId: position.id, level: "critical", message: "Offboarding in Progress", detail: `${employee.name} is offboarding and role continuity is pending` });
    }
  }
  for (const item of seed.compliance.filter((compliance) => compliance.status !== "complete")) {
    signals.push({ id: `sig-compliance-${item.id}`, positionId: item.positionId, level: item.status === "expired" ? "warning" : "critical", message: item.type, detail: item.description });
  }
  return signals;
}

function computeActions(signals: Signal[]): Action[] {
  return signals.map((signal) => ({
    id: `act-${signal.id}`,
    positionId: signal.positionId,
    type: signal.message === "Vacant Position" ? "assign_employee" : signal.message === "Offboarding in Progress" ? "complete_offboarding" : "fix_compliance",
    label: signal.message === "Vacant Position" ? "Assign employee" : signal.message === "Offboarding in Progress" ? "Complete handover" : "Resolve compliance issue",
    dueIn: signal.message === "Offboarding in Progress" ? "Due in 3 days" : "Due in 7 days",
    relatedSignalId: signal.id,
  }));
}

function computeRisks(seed: SeedData, signals: Signal[]): RiskItem[] {
  return signals
    .map((signal) => {
      const position = seed.positions.find((item) => item.id === signal.positionId);
      const category: RiskItem["category"] =
        signal.message === "Vacant Position" ? "vacancy" :
        signal.message === "Offboarding in Progress" ? "offboarding" :
        signal.message === "Employee On Leave" ? "leave" :
        signal.message.includes("capacity") ? "overload" : "compliance";
      return {
        positionId: signal.positionId,
        positionTitle: position?.title ?? "Unknown",
        category,
        level: signal.level,
        score: signal.level === "critical" ? 50 : signal.level === "warning" ? 30 : 15,
        message: signal.message,
        detail: signal.detail,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function buildOrgTree(seed: SeedData, signals: Signal[], parentId: string | null): OrgNode[] {
  const children = seed.positions.filter((position) => position.reportsToId === parentId).sort((a, b) => a.order - b.order);
  return children.map((position) => {
    const employee = employeeForPosition(seed, position.id);
    const levels = signals.filter((signal) => signal.positionId === position.id);
    const signalLevel = levels.some((signal) => signal.level === "critical")
      ? "critical"
      : levels.some((signal) => signal.level === "warning")
      ? "warning"
      : levels.some((signal) => signal.level === "info")
      ? "info"
      : null;
    return { position, employee, children: buildOrgTree(seed, signals, position.id), signalLevel };
  });
}

function buildEmployeeDirectory(seed: SeedData): EmployeeDirectoryRow[] {
  return seed.employees
    .map((employee) => {
      const position = seed.positions.find((item) => item.id === employee.positionId);
      if (!position) return null;
      return {
        employeeId: employee.id,
        employeeName: employee.name,
        positionTitle: position.title,
        department: position.department,
        email: employee.workContact.email,
        phone: employee.workContact.phone,
        managerName: managerName(seed, position),
        status: employee.status,
      };
    })
    .filter((row): row is EmployeeDirectoryRow => Boolean(row));
}

function buildFinanceRows(seed: SeedData): FinanceRow[] {
  return seed.employees
    .map((employee) => {
      const position = seed.positions.find((item) => item.id === employee.positionId);
      if (!position) return null;
      return {
        employeeId: employee.employeeCode,
        employeeName: employee.name,
        position: position.title,
        department: position.department,
        manager: managerName(seed, position),
        employmentStatus: seed.config.employmentStatuses.find((item) => item.id === employee.status)?.label ?? employee.status,
        totalCompensation: compensationTotal(employee.compensationComponents),
        currency: employee.compensationComponents[0]?.currency ?? "USD",
        bankName: employee.bankName,
        accountNumber: employee.bankAccount,
        iban: employee.iban,
        joinDate: employee.startDate,
      };
    })
    .filter((row): row is FinanceRow => Boolean(row));
}

function buildProfile(seed: SeedData, selectedPosition: Position | null, selectedEmployee: Employee | null, actions: Action[]): EmployeeProfileView | null {
  if (!selectedPosition || !selectedEmployee) return null;
  const directReports = seed.positions
    .filter((position) => position.reportsToId === selectedPosition.id)
    .sort((a, b) => a.order - b.order)
    .map((position) => ({ position, employee: employeeForPosition(seed, position.id) }));

  const checks = seed.compliance.filter((item) => item.positionId === selectedPosition.id);
  const missingItems = checks.filter((item) => item.status !== "complete").map((item) => item.type);
  if (selectedEmployee.onboardingStatus !== "complete") {
    missingItems.push("Onboarding checklist");
  }
  const completeChecks = checks.filter((item) => item.status === "complete").length + (selectedEmployee.onboardingStatus === "complete" ? 1 : 0);
  const totalChecks = checks.length + 1;
  const actionPenalty = actions.filter((action) => action.positionId === selectedPosition.id).length * 5;
  const readinessScore = Math.max(0, Math.round((completeChecks / Math.max(totalChecks, 1)) * 100) - actionPenalty);

  return {
    employee: selectedEmployee,
    position: selectedPosition,
    managerName: managerName(seed, selectedPosition),
    directReports,
    readinessScore,
    missingItems,
    compensationComponents: selectedEmployee.compensationComponents,
    totalCompensation: compensationTotal(selectedEmployee.compensationComponents),
  };
}

export function computeUIState(seed: SeedData, controlState: ControlState): UIState {
  const seedWithEdits = applyPositionEdits(seed, controlState.positionEdits);
  const selectedPosition = seedWithEdits.positions.find((position) => position.id === controlState.selectedPositionId) ?? null;
  const selectedEmployee = controlState.selectedEmployeeId
    ? seedWithEdits.employees.find((employee) => employee.id === controlState.selectedEmployeeId) ?? null
    : selectedPosition
    ? employeeForPosition(seedWithEdits, selectedPosition.id)
    : null;

  const signals = computeSignals(seedWithEdits).filter((signal) => !controlState.resolvedActions.includes(signal.id));
  const actions = computeActions(signals).filter((action) => !controlState.resolvedActions.includes(action.id));
  const risks = computeRisks(seedWithEdits, signals);
  const orgTree = buildOrgTree(seedWithEdits, signals, null);
  const employeeDirectory = buildEmployeeDirectory(seedWithEdits);
  const financeRows = buildFinanceRows(seedWithEdits);
  const selectedProfile = buildProfile(seedWithEdits, selectedPosition, selectedEmployee, actions);

  const totalPositions = seedWithEdits.positions.length;
  const filledPositions = seedWithEdits.positions.filter((position) => employeeForPosition(seedWithEdits, position.id)).length;
  const vacantPositions = totalPositions - filledPositions;

  return {
    selectedPosition,
    selectedEmployee,
    selectedProfile,
    orgTree,
    signals,
    actions,
    complianceView: seedWithEdits.compliance.filter((item) => !selectedPosition || item.positionId === selectedPosition.id),
    employeeDirectory,
    financeRows,
    stats: {
      totalPositions,
      filledPositions,
      vacantPositions,
      onLeaveCount: seedWithEdits.employees.filter((employee) => employee.status === "on_leave").length,
      offboardingCount: seedWithEdits.employees.filter((employee) => employee.status === "offboarding").length,
      openRisks: risks.length,
      openActions: actions.length,
    },
    signalSummary: {
      critical: signals.filter((signal) => signal.level === "critical").length,
      warning: signals.filter((signal) => signal.level === "warning").length,
      info: signals.filter((signal) => signal.level === "info").length,
    },
    risks,
    riskScore: risks.reduce((sum, item) => sum + item.score, 0),
  };
}
