import {
  Employee,
  EmployeeDocument,
  Position,
  REQUIRED_DOCUMENT_CATEGORIES,
  SeedData,
  DocumentCategory,
  OnboardingStatus,
} from "../data/seed";

export interface PositionEdit {
  id: string;
  title: string;
  department: string;
}

export interface CompletedActionRecord {
  actionId: string;
  employeeId: string;
  positionId: string;
  actionLabel: string;
  actionDetail: string;
  requiredCategory: DocumentCategory | null;
  completedAt: string;
  completedBy: string;
  evidence: string;
  uploadedFileName: string;
}

export interface OnboardingOverride {
  employeeId: string;
  status: OnboardingStatus;
  progress: number;
  updatedAt: string;
}

export type FinanceSortBy =
  | "employeeCode"
  | "name"
  | "position"
  | "department"
  | "manager"
  | "status"
  | "salary"
  | "currency"
  | "bankName"
  | "bankAccount"
  | "iban"
  | "startDate";

export interface ControlState {
  scenarioId: string;
  selectedPositionId: string;
  selectedEmployeeId: string | null;
  positionEdits: PositionEdit[];
  employeeSearch: string;
  financeSearch: string;
  financeSortBy: FinanceSortBy;
  financeSortDirection: "asc" | "desc";
  completedActions: CompletedActionRecord[];
  uploadedDocuments: EmployeeDocument[];
  onboardingOverrides: OnboardingOverride[];
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
  employeeId: string | null;
  level: "critical" | "warning" | "info";
  message: string;
  detail: string;
}

export interface RiskItem {
  id: string;
  employeeId: string | null;
  positionId: string;
  positionTitle: string;
  category: "documentation" | "offboarding" | "leave" | "vacancy";
  level: "critical" | "warning" | "info";
  score: number;
  message: string;
  detail: string;
}

export interface ComplianceItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  positionId: string;
  positionTitle: string;
  category: DocumentCategory;
  status: "compliant" | "missing" | "expired";
  detail: string;
  required: boolean;
}

export interface ActionWorkflow {
  id: string;
  employeeId: string;
  employeeName: string;
  positionId: string;
  positionTitle: string;
  severity: "critical" | "warning" | "info";
  label: string;
  detail: string;
  dueIn: string;
  requiredCategory: DocumentCategory | null;
  requiresUpload: boolean;
}

export interface CompletedActionView extends CompletedActionRecord {
  employeeName: string;
  positionTitle: string;
}

export interface EmployeeDirectoryRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  positionId: string;
  positionTitle: string;
  department: string;
  location: string;
  status: Employee["status"];
  managerName: string;
}

export interface FinanceReportRow {
  employeeId: string;
  employeeName: string;
  position: string;
  department: string;
  manager: string;
  employmentStatus: string;
  salary: number;
  currency: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  joinDate: string;
}

export interface EmployeeDocumentStatus {
  category: DocumentCategory;
  status: "compliant" | "missing" | "expired";
  detail: string;
  document: EmployeeDocument | null;
}

export interface EmployeeProfileView {
  employee: Employee;
  position: Position;
  manager: { employee: Employee; position: Position } | null;
  directReports: { employee: Employee; position: Position }[];
  documents: EmployeeDocument[];
  documentStatus: EmployeeDocumentStatus[];
  complianceSummary: {
    compliant: number;
    missing: number;
    expired: number;
  };
  pendingActions: ActionWorkflow[];
  completedActions: CompletedActionView[];
  onboarding: {
    status: OnboardingStatus;
    progress: number;
    updatedAt: string;
  };
}

export interface DocumentsRepositoryEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  positionTitle: string;
  department: string;
  requiredCategories: DocumentCategory[];
  documents: EmployeeDocument[];
  missingCount: number;
  expiredCount: number;
}

export interface UIState {
  selectedPosition: Position | null;
  selectedEmployee: Employee | null;
  selectedProfile: EmployeeProfileView | null;
  orgTree: OrgNode[];
  signals: Signal[];
  risks: RiskItem[];
  riskScore: number;
  riskBreakdown: { documentation: number; offboarding: number; leave: number; vacancy: number };
  complianceView: ComplianceItem[];
  pendingActions: ActionWorkflow[];
  completedActionHistory: CompletedActionView[];
  employeeDirectory: EmployeeDirectoryRow[];
  financeRows: FinanceReportRow[];
  documentsRepository: DocumentsRepositoryEmployee[];
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
}

export const SCENARIOS: Record<string, Partial<ControlState>> = {
  DEFAULT_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: "e-001" },
  VACANT_POSITION_FOCUS: { selectedPositionId: "3-002", selectedEmployeeId: null },
  ON_LEAVE_EMPLOYEE_FOCUS: { selectedPositionId: "2-002", selectedEmployeeId: "e-006" },
  OFFBOARDING_EMPLOYEE_FOCUS: { selectedPositionId: "2-004", selectedEmployeeId: "e-008" },
  MISSING_COMPLIANCE_FOCUS: { selectedPositionId: "2-001", selectedEmployeeId: "e-005" },
  FULL_ORGANIZATION_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: null },
};

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

function getRequiredCategories(employee: Employee): DocumentCategory[] {
  if (employee.requiresVisa) {
    return [...REQUIRED_DOCUMENT_CATEGORIES, "Visa"];
  }
  return REQUIRED_DOCUMENT_CATEGORIES;
}

function compareByUploadedAt(a: EmployeeDocument, b: EmployeeDocument): number {
  const first = Date.parse(a.uploadedAt);
  const second = Date.parse(b.uploadedAt);
  return first - second;
}

function buildLatestDocumentMap(documents: EmployeeDocument[]): Map<string, EmployeeDocument> {
  const map = new Map<string, EmployeeDocument>();
  for (const doc of documents) {
    const key = `${doc.employeeId}::${doc.category}`;
    const existing = map.get(key);
    if (!existing || compareByUploadedAt(existing, doc) <= 0) {
      map.set(key, doc);
    }
  }
  return map;
}

function computeCompliance(seed: SeedData, documents: EmployeeDocument[]): ComplianceItem[] {
  const latestDocuments = buildLatestDocumentMap(documents);
  const complianceItems: ComplianceItem[] = [];

  for (const employee of seed.employees) {
    const position = seed.positions.find((item) => item.id === employee.positionId);
    if (!position) continue;
    for (const category of getRequiredCategories(employee)) {
      const key = `${employee.id}::${category}`;
      const doc = latestDocuments.get(key) ?? null;
      let status: ComplianceItem["status"] = "compliant";
      let detail = "Document verified";
      if (!doc) {
        status = "missing";
        detail = `${category} not uploaded`;
      } else if (doc.status === "expired") {
        status = "expired";
        detail = `${doc.fileName} is expired`;
      }

      complianceItems.push({
        id: `cmp-${employee.id}-${slugify(category)}`,
        employeeId: employee.id,
        employeeName: employee.name,
        employeeCode: employee.employeeCode,
        positionId: position.id,
        positionTitle: position.title,
        category,
        status,
        detail,
        required: true,
      });
    }
  }

  return complianceItems;
}

function buildRiskItems(seed: SeedData, complianceItems: ComplianceItem[]): RiskItem[] {
  const risks: RiskItem[] = [];
  for (const item of complianceItems) {
    if (item.status === "compliant") continue;
    const score = item.status === "missing" ? 45 : 25;
    const level: RiskItem["level"] = item.status === "missing" ? "critical" : "warning";
    risks.push({
      id: `risk-doc-${item.employeeId}-${slugify(item.category)}`,
      employeeId: item.employeeId,
      positionId: item.positionId,
      positionTitle: item.positionTitle,
      category: "documentation",
      level,
      score,
      message: item.status === "missing" ? "Missing required document" : "Expired required document",
      detail: `${item.employeeName}: ${item.detail}`,
    });
  }

  for (const position of seed.positions) {
    const employee = seed.employees.find((item) => item.positionId === position.id) ?? null;
    if (!employee) {
      risks.push({
        id: `risk-vacant-${position.id}`,
        employeeId: null,
        positionId: position.id,
        positionTitle: position.title,
        category: "vacancy",
        level: "warning",
        score: 18,
        message: "Vacant position",
        detail: `${position.title} has no assigned employee`,
      });
      continue;
    }
    if (employee.status === "offboarding") {
      risks.push({
        id: `risk-offboarding-${employee.id}`,
        employeeId: employee.id,
        positionId: position.id,
        positionTitle: position.title,
        category: "offboarding",
        level: "critical",
        score: 30,
        message: "Employee offboarding",
        detail: `${employee.name} is offboarding`,
      });
    }
    if (employee.status === "on_leave") {
      risks.push({
        id: `risk-leave-${employee.id}`,
        employeeId: employee.id,
        positionId: position.id,
        positionTitle: position.title,
        category: "leave",
        level: "info",
        score: 12,
        message: "Employee on leave",
        detail: `${employee.name} is currently on leave`,
      });
    }
  }

  return risks.sort((a, b) => b.score - a.score);
}

function deriveSignalsFromRisks(risks: RiskItem[]): Signal[] {
  return risks.map((risk) => ({
    id: `sig-${risk.id}`,
    positionId: risk.positionId,
    employeeId: risk.employeeId,
    level: risk.level,
    message: risk.message,
    detail: risk.detail,
  }));
}

function buildOrgTree(seed: SeedData, signals: Signal[], parentId: string | null): OrgNode[] {
  const children = seed.positions
    .filter((position) => position.reportsToId === parentId)
    .sort((a, b) => a.order - b.order);

  return children.map((position) => {
    const employee = seed.employees.find((item) => item.positionId === position.id) ?? null;
    const signalLevel = inferSignalLevel(signals.filter((signal) => signal.positionId === position.id));
    return {
      position,
      employee,
      children: buildOrgTree(seed, signals, position.id),
      signalLevel,
    };
  });
}

function inferSignalLevel(signals: Signal[]): OrgNode["signalLevel"] {
  if (signals.some((item) => item.level === "critical")) return "critical";
  if (signals.some((item) => item.level === "warning")) return "warning";
  if (signals.some((item) => item.level === "info")) return "info";
  return null;
}

function buildDocumentActions(
  complianceItems: ComplianceItem[],
  completedActions: CompletedActionRecord[],
): ActionWorkflow[] {
  const completedActionIds = new Set(completedActions.map((action) => action.actionId));
  const pending: ActionWorkflow[] = [];

  for (const item of complianceItems) {
    if (item.status === "compliant") continue;
    const actionId = `act-doc-${item.employeeId}-${slugify(item.category)}`;
    if (completedActionIds.has(actionId)) continue;
    pending.push({
      id: actionId,
      employeeId: item.employeeId,
      employeeName: item.employeeName,
      positionId: item.positionId,
      positionTitle: item.positionTitle,
      severity: item.status === "missing" ? "critical" : "warning",
      label: item.status === "missing" ? `Upload ${item.category}` : `Refresh ${item.category}`,
      detail: item.detail,
      dueIn: item.status === "missing" ? "Due immediately" : "Due in 3 days",
      requiredCategory: item.category,
      requiresUpload: true,
    });
  }

  return pending;
}

function buildOnboardingActions(
  seed: SeedData,
  overrides: OnboardingOverride[],
  completedActions: CompletedActionRecord[],
): ActionWorkflow[] {
  const completedIds = new Set(completedActions.map((action) => action.actionId));
  const overrideByEmployee = new Map(overrides.map((item) => [item.employeeId, item]));
  const actions: ActionWorkflow[] = [];

  for (const employee of seed.employees) {
    const override = overrideByEmployee.get(employee.id);
    const currentStatus = override?.status ?? employee.onboardingStatus;
    if (currentStatus === "complete") continue;
    const position = seed.positions.find((item) => item.id === employee.positionId);
    if (!position) continue;
    const actionId = `act-onboarding-${employee.id}`;
    if (completedIds.has(actionId)) continue;
    actions.push({
      id: actionId,
      employeeId: employee.id,
      employeeName: employee.name,
      positionId: employee.positionId,
      positionTitle: position.title,
      severity: "info",
      label: "Complete Onboarding",
      detail: `Current progress ${(override?.progress ?? employee.onboardingProgress)}%`,
      dueIn: "Due in 1 week",
      requiredCategory: null,
      requiresUpload: false,
    });
  }

  return actions;
}

function buildCompletedHistory(seed: SeedData, completedActions: CompletedActionRecord[]): CompletedActionView[] {
  return completedActions
    .map((action) => {
      const employee = seed.employees.find((item) => item.id === action.employeeId);
      const position = seed.positions.find((item) => item.id === action.positionId);
      if (!employee || !position) return null;
      return {
        ...action,
        employeeName: employee.name,
        positionTitle: position.title,
      };
    })
    .filter((item): item is CompletedActionView => Boolean(item))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}

function buildEmployeeDirectory(seed: SeedData, search: string): EmployeeDirectoryRow[] {
  const query = search.trim().toLowerCase();
  const rows = seed.employees.map((employee) => {
    const position = seed.positions.find((item) => item.id === employee.positionId);
    if (!position) return null;
    const managerPosition = seed.positions.find((item) => item.id === position.reportsToId);
    const manager = managerPosition
      ? seed.employees.find((item) => item.positionId === managerPosition.id) ?? null
      : null;
    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      positionId: position.id,
      positionTitle: position.title,
      department: position.department,
      location: employee.location,
      status: employee.status,
      managerName: manager?.name ?? "None",
    };
  }).filter((item): item is EmployeeDirectoryRow => Boolean(item));

  if (!query) return rows;
  return rows.filter((row) =>
    row.name.toLowerCase().includes(query)
      || row.employeeCode.toLowerCase().includes(query)
      || row.positionTitle.toLowerCase().includes(query)
      || row.department.toLowerCase().includes(query)
      || row.managerName.toLowerCase().includes(query),
  );
}

function buildFinanceRows(
  seed: SeedData,
  search: string,
  sortBy: FinanceSortBy,
  direction: "asc" | "desc",
): FinanceReportRow[] {
  const rows: FinanceReportRow[] = seed.employees.map((employee) => {
    const position = seed.positions.find((item) => item.id === employee.positionId);
    const managerPosition = position
      ? seed.positions.find((item) => item.id === position.reportsToId)
      : null;
    const managerEmployee = managerPosition
      ? seed.employees.find((item) => item.positionId === managerPosition.id)
      : null;
    return {
      employeeId: employee.employeeCode,
      employeeName: employee.name,
      position: position?.title ?? "Unknown",
      department: position?.department ?? "Unknown",
      manager: managerEmployee?.name ?? "None",
      employmentStatus: employee.status === "active"
        ? "Active"
        : employee.status === "on_leave"
        ? "On Leave"
        : "Offboarding",
      salary: employee.salary,
      currency: employee.currency,
      bankName: employee.bankName,
      accountNumber: employee.bankAccount,
      iban: employee.iban,
      joinDate: employee.startDate,
    };
  });

  const query = search.trim().toLowerCase();
  const filteredRows = query
    ? rows.filter((row) =>
        row.employeeId.toLowerCase().includes(query)
        || row.employeeName.toLowerCase().includes(query)
        || row.position.toLowerCase().includes(query)
        || row.department.toLowerCase().includes(query)
        || row.manager.toLowerCase().includes(query),
      )
    : rows;

  const sortedRows = [...filteredRows].sort((a, b) => {
    const first = getSortableFinanceValue(a, sortBy);
    const second = getSortableFinanceValue(b, sortBy);
    if (first < second) return direction === "asc" ? -1 : 1;
    if (first > second) return direction === "asc" ? 1 : -1;
    return 0;
  });
  return sortedRows;
}

function getSortableFinanceValue(row: FinanceReportRow, sortBy: FinanceSortBy): number | string {
  if (sortBy === "salary") return row.salary;
  if (sortBy === "employeeCode") return row.employeeId;
  if (sortBy === "name") return row.employeeName;
  if (sortBy === "position") return row.position;
  if (sortBy === "department") return row.department;
  if (sortBy === "manager") return row.manager;
  if (sortBy === "status") return row.employmentStatus;
  if (sortBy === "currency") return row.currency;
  if (sortBy === "bankName") return row.bankName;
  if (sortBy === "bankAccount") return row.accountNumber;
  if (sortBy === "iban") return row.iban;
  return row.joinDate;
}

function buildDocumentsRepository(
  seed: SeedData,
  complianceItems: ComplianceItem[],
  effectiveDocuments: EmployeeDocument[],
): DocumentsRepositoryEmployee[] {
  return seed.employees.map((employee) => {
    const position = seed.positions.find((item) => item.id === employee.positionId);
    const employeeDocuments = effectiveDocuments
      .filter((doc) => doc.employeeId === employee.id)
      .sort((a, b) => compareByUploadedAt(b, a));
    const statusItems = complianceItems.filter((item) => item.employeeId === employee.id);
    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.name,
      positionTitle: position?.title ?? "Unknown",
      department: position?.department ?? "Unknown",
      requiredCategories: getRequiredCategories(employee),
      documents: employeeDocuments,
      missingCount: statusItems.filter((item) => item.status === "missing").length,
      expiredCount: statusItems.filter((item) => item.status === "expired").length,
    };
  });
}

function buildProfile(
  seed: SeedData,
  selectedEmployee: Employee | null,
  complianceItems: ComplianceItem[],
  effectiveDocuments: EmployeeDocument[],
  pendingActions: ActionWorkflow[],
  completedActionHistory: CompletedActionView[],
  onboardingOverrides: OnboardingOverride[],
): EmployeeProfileView | null {
  if (!selectedEmployee) return null;
  const position = seed.positions.find((item) => item.id === selectedEmployee.positionId);
  if (!position) return null;
  const managerPosition = seed.positions.find((item) => item.id === position.reportsToId);
  const managerEmployee = managerPosition
    ? seed.employees.find((item) => item.positionId === managerPosition.id) ?? null
    : null;
  const directReports = seed.positions
    .filter((item) => item.reportsToId === position.id)
    .sort((a, b) => a.order - b.order)
    .map((reportPosition) => {
      const reportEmployee = seed.employees.find((item) => item.positionId === reportPosition.id);
      if (!reportEmployee) return null;
      return { employee: reportEmployee, position: reportPosition };
    })
    .filter((item): item is { employee: Employee; position: Position } => Boolean(item));

  const documents = effectiveDocuments
    .filter((doc) => doc.employeeId === selectedEmployee.id)
    .sort((a, b) => compareByUploadedAt(b, a));

  const complianceByCategory = new Map(
    complianceItems
      .filter((item) => item.employeeId === selectedEmployee.id)
      .map((item) => [item.category, item]),
  );

  const documentStatus = getRequiredCategories(selectedEmployee).map((category) => {
    const compliance = complianceByCategory.get(category);
    const document = documents.find((item) => item.category === category) ?? null;
    return {
      category,
      status: compliance?.status ?? "missing",
      detail: compliance?.detail ?? `${category} not uploaded`,
      document,
    };
  });

  const override = onboardingOverrides.find((item) => item.employeeId === selectedEmployee.id);
  const onboarding = {
    status: override?.status ?? selectedEmployee.onboardingStatus,
    progress: override?.progress ?? selectedEmployee.onboardingProgress,
    updatedAt: override?.updatedAt ?? selectedEmployee.startDate,
  };

  return {
    employee: selectedEmployee,
    position,
    manager: managerPosition && managerEmployee ? { employee: managerEmployee, position: managerPosition } : null,
    directReports,
    documents,
    documentStatus,
    complianceSummary: {
      compliant: documentStatus.filter((item) => item.status === "compliant").length,
      missing: documentStatus.filter((item) => item.status === "missing").length,
      expired: documentStatus.filter((item) => item.status === "expired").length,
    },
    pendingActions: pendingActions.filter((action) => action.employeeId === selectedEmployee.id),
    completedActions: completedActionHistory.filter((action) => action.employeeId === selectedEmployee.id),
    onboarding,
  };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function computeUIState(seed: SeedData, controlState: ControlState): UIState {
  const seedWithEdits = applyPositionEdits(seed, controlState.positionEdits ?? []);
  const scenario = SCENARIOS[controlState.scenarioId] ?? {};
  const mergedControl: ControlState = {
    ...controlState,
    ...scenario,
    positionEdits: controlState.positionEdits ?? [],
    employeeSearch: controlState.employeeSearch ?? "",
    financeSearch: controlState.financeSearch ?? "",
    financeSortBy: controlState.financeSortBy ?? "name",
    financeSortDirection: controlState.financeSortDirection ?? "asc",
    completedActions: controlState.completedActions ?? [],
    uploadedDocuments: controlState.uploadedDocuments ?? [],
    onboardingOverrides: controlState.onboardingOverrides ?? [],
  };

  const selectedPosition = seedWithEdits.positions.find((position) => position.id === mergedControl.selectedPositionId) ?? null;
  const selectedEmployee = mergedControl.selectedEmployeeId
    ? seedWithEdits.employees.find((employee) => employee.id === mergedControl.selectedEmployeeId) ?? null
    : selectedPosition
    ? seedWithEdits.employees.find((employee) => employee.positionId === selectedPosition.id) ?? null
    : null;

  const effectiveDocuments = [...seedWithEdits.documents, ...mergedControl.uploadedDocuments];
  const complianceView = computeCompliance(seedWithEdits, effectiveDocuments);
  const risks = buildRiskItems(seedWithEdits, complianceView);
  const signals = deriveSignalsFromRisks(risks);
  const orgTree = buildOrgTree(seedWithEdits, signals, null);
  const pendingActions = [
    ...buildDocumentActions(complianceView, mergedControl.completedActions),
    ...buildOnboardingActions(seedWithEdits, mergedControl.onboardingOverrides, mergedControl.completedActions),
  ].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  const completedActionHistory = buildCompletedHistory(seedWithEdits, mergedControl.completedActions);
  const employeeDirectory = buildEmployeeDirectory(seedWithEdits, mergedControl.employeeSearch);
  const financeRows = buildFinanceRows(
    seedWithEdits,
    mergedControl.financeSearch,
    mergedControl.financeSortBy,
    mergedControl.financeSortDirection,
  );
  const documentsRepository = buildDocumentsRepository(seedWithEdits, complianceView, effectiveDocuments);

  const directReports = selectedPosition
    ? seedWithEdits.positions
        .filter((position) => position.reportsToId === selectedPosition.id)
        .sort((a, b) => a.order - b.order)
        .map((position) => ({
          position,
          employee: seedWithEdits.employees.find((employee) => employee.positionId === position.id) ?? null,
        }))
    : [];

  const totalPositions = seedWithEdits.positions.length;
  const filledPositions = seedWithEdits.employees.length;
  const vacantPositions = totalPositions - filledPositions;
  const onLeaveCount = seedWithEdits.employees.filter((employee) => employee.status === "on_leave").length;
  const offboardingCount = seedWithEdits.employees.filter((employee) => employee.status === "offboarding").length;

  const selectedProfile = buildProfile(
    seedWithEdits,
    selectedEmployee,
    complianceView,
    effectiveDocuments,
    pendingActions,
    completedActionHistory,
    mergedControl.onboardingOverrides,
  );

  return {
    selectedPosition,
    selectedEmployee,
    selectedProfile,
    orgTree,
    signals,
    risks,
    riskScore: risks.reduce((sum, item) => sum + item.score, 0),
    riskBreakdown: {
      documentation: risks.filter((risk) => risk.category === "documentation").reduce((sum, item) => sum + item.score, 0),
      offboarding: risks.filter((risk) => risk.category === "offboarding").reduce((sum, item) => sum + item.score, 0),
      leave: risks.filter((risk) => risk.category === "leave").reduce((sum, item) => sum + item.score, 0),
      vacancy: risks.filter((risk) => risk.category === "vacancy").reduce((sum, item) => sum + item.score, 0),
    },
    complianceView,
    pendingActions,
    completedActionHistory,
    employeeDirectory,
    financeRows,
    documentsRepository,
    directReports,
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
  };
}
