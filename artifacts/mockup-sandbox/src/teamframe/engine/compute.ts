import {
  DocumentCategory,
  Employee,
  EmployeeDocument,
  EmployeeOnboardingState,
  OnboardingTaskDefinition,
  PolicyAcknowledgement,
  PolicyDefinition,
  Position,
  REQUIRED_COMPANY_DOCUMENTS,
  REQUIRED_EMPLOYEE_DOCUMENTS,
  SeedData,
} from "../data/seed";

export interface PositionEdit {
  id: string;
  title: string;
  department: string;
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

export type KpiFilterId = "all" | "filled" | "vacant" | "open_risks" | "open_actions";
export type StatusDot = "green" | "yellow" | "grey";
export type ActionLifecycleStatus = "open" | "in_progress" | "completed" | "archived";

export interface TemporaryOooOverride {
  employeeId: string;
  endsAt: string | null;
  note?: string;
}

export interface ActionState {
  actionId: string;
  status: ActionLifecycleStatus;
  updatedAt: string;
  completedAt?: string;
  completedBy?: string;
  evidence?: string;
  uploadedFileName?: string;
  archivedAt?: string;
}

export interface PolicyVersionOverride {
  policyId: string;
  version: number;
  effectiveDate: string;
  uploadedBy: string;
  updatedAt: string;
}

export interface PolicyAckOverride {
  policyId: string;
  employeeId: string;
  version: number;
  status: "acknowledged" | "pending";
  acknowledgedAt?: string;
  pendingSince: string;
}

export interface OnboardingOverride {
  employeeId: string;
  taskId: string;
  status: "complete" | "pending" | "not_applicable";
  completedAt?: string;
}

export interface SetupState {
  currentStep: number;
  completedSteps: number[];
  dismissed: boolean;
  lastSavedAt: string;
}

export type AuditEventType = "policy_update" | "document_change" | "risk_state_change" | "action_state_change";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  message: string;
  timestamp: string;
  positionId?: string;
  employeeId?: string;
  actionId?: string;
  riskId?: string;
}

export interface ControlState {
  scenarioId: string;
  selectedPositionId: string;
  selectedEmployeeId: string | null;
  selectedActionId: string | null;
  positionEdits: PositionEdit[];
  activeKpiFilter: KpiFilterId;
  orgSearchQuery: string;
  collapseLevel: number;
  focusPathOnly: boolean;
  detailPanelOpen: boolean;
  readinessExpanded: boolean;
  employeeSearch: string;
  financeSearch: string;
  financeSortBy: FinanceSortBy;
  financeSortDirection: "asc" | "desc";
  temporaryOoo: TemporaryOooOverride[];
  actionStates: ActionState[];
  uploadedDocuments: EmployeeDocument[];
  policyVersionOverrides: PolicyVersionOverride[];
  policyAckOverrides: PolicyAckOverride[];
  onboardingOverrides: OnboardingOverride[];
  addedPositions: Position[];
  addedEmployees: Employee[];
  setupState: SetupState;
  auditEvents: AuditEvent[];
}

export interface OrgNode {
  position: Position;
  employee: Employee | null;
  children: OrgNode[];
  directReportCount: number;
  statusDot: StatusDot;
  hasSearchMatch: boolean;
  openRiskCount: number;
  openActionCount: number;
}

export interface ComplianceItem {
  id: string;
  employeeId: string;
  employeeName: string;
  positionId: string;
  positionTitle: string;
  category: string;
  status: "compliant" | "missing" | "expired";
  detail: string;
}

export interface MissingItem {
  id: string;
  type: "document" | "compliance" | "policy" | "onboarding";
  label: string;
  status: "missing" | "expired" | "pending";
  reason: string;
  owner: string;
  dueDate: string;
  actionId: string;
}

export interface ReadinessComponent {
  key: "documents" | "compliance" | "policies" | "onboarding";
  label: string;
  weight: number;
  completed: number;
  total: number;
  percentage: number;
  included: boolean;
}

export interface ReadinessScore {
  score: number;
  components: ReadinessComponent[];
  includedWeight: number;
  summaryText: string;
}

export interface PolicyAckView {
  policyId: string;
  policyName: string;
  version: number;
  status: "acknowledged" | "pending";
  pendingSince: string;
  acknowledgedAt?: string;
}

export interface EmployeeDocumentStatus {
  category: DocumentCategory;
  status: "compliant" | "missing" | "expired" | "not_applicable";
  detail: string;
  isRequired: boolean;
  document: EmployeeDocument | null;
}

export interface PositionDetailPanel {
  position: Position;
  employee: Employee | null;
  manager: { position: Position; employee: Employee | null } | null;
  directReports: { position: Position; employee: Employee | null }[];
  statusDot: StatusDot;
  readiness: ReadinessScore;
  missingItems: MissingItem[];
  documentStatus: EmployeeDocumentStatus[];
  policyStatus: PolicyAckView[];
  compliance: ComplianceItem[];
}

export interface EmployeeDirectoryRow {
  employeeId: string;
  employeeCode: string;
  name: string;
  positionId: string;
  positionTitle: string;
  department: string;
  location: string;
  statusDot: StatusDot;
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

export interface RiskItem {
  id: string;
  positionId: string;
  employeeId: string | null;
  positionTitle: string;
  employeeName: string;
  severity: "warning" | "critical";
  trigger: "missing_document" | "expired_document" | "policy_pending" | "vacant_critical_position" | "onboarding_incomplete";
  cause: string;
  impact: string;
  action: string;
  daysOpen: number;
}

export interface ActionItem {
  id: string;
  positionId: string;
  employeeId: string | null;
  positionTitle: string;
  employeeName: string;
  label: string;
  detail: string;
  requiresUpload: boolean;
  suggestedFileCategory: DocumentCategory | null;
  dueDate: string;
  status: ActionLifecycleStatus;
  completedAt?: string;
  completedBy?: string;
  evidence?: string;
  uploadedFileName?: string;
}

export interface PolicyLibraryItem {
  policy: PolicyDefinition;
  acknowledgedCount: number;
  pendingCount: number;
}

export interface DocumentsRepositoryRow {
  employeeId: string;
  employeeName: string;
  positionTitle: string;
  missingCount: number;
  expiredCount: number;
  documents: EmployeeDocument[];
}

export interface EmployeeProfileView {
  employee: Employee;
  position: Position;
  manager: { employee: Employee; position: Position } | null;
  directReports: { employee: Employee; position: Position }[];
  documentStatus: EmployeeDocumentStatus[];
  policyStatus: PolicyAckView[];
  compliance: ComplianceItem[];
  readiness: ReadinessScore;
  pendingActions: ActionItem[];
  completedActions: ActionItem[];
  onboardingTasks: { title: string; status: "complete" | "pending" | "not_applicable" }[];
}

export interface UIState {
  selectedPosition: Position | null;
  selectedEmployee: Employee | null;
  selectedProfile: EmployeeProfileView | null;
  positionDetail: PositionDetailPanel | null;
  orgTree: OrgNode[];
  filteredOrgTree: OrgNode[];
  matchedPositionIds: string[];
  focusPathIds: string[];
  complianceView: ComplianceItem[];
  risks: RiskItem[];
  pendingActions: ActionItem[];
  actionHistory: ActionItem[];
  employeeDirectory: EmployeeDirectoryRow[];
  financeRows: FinanceReportRow[];
  documentsRepository: DocumentsRepositoryRow[];
  policies: PolicyLibraryItem[];
  auditTimeline: AuditEvent[];
  stats: {
    totalPositions: number;
    filledPositions: number;
    vacantPositions: number;
    employeesOnline: number;
    openRisks: number;
    openActions: number;
  };
  signalSummary: { critical: number; warning: number };
  riskBreakdown: {
    missingDocuments: number;
    expiredDocuments: number;
    policyPending: number;
    vacantCriticalPositions: number;
    onboardingIncomplete: number;
  };
  emptyStates: {
    firstOrgSetup: boolean;
    noEmployees: boolean;
    noPolicies: boolean;
    noDocuments: boolean;
  };
}

const READINESS_WEIGHTS: Record<ReadinessComponent["key"], number> = {
  documents: 35,
  compliance: 30,
  policies: 20,
  onboarding: 15,
};

const RISK_THRESHOLDS = {
  warningDays: 7,
  criticalDays: 14,
};

const SLA_DAYS: Record<MissingItem["type"], number> = {
  document: 7,
  compliance: 5,
  policy: 7,
  onboarding: 14,
};

export const SCENARIOS: Record<string, Partial<ControlState>> = {
  DEFAULT_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: "e-001" },
  VACANT_POSITION_FOCUS: { selectedPositionId: "2-003", selectedEmployeeId: null },
  ON_LEAVE_EMPLOYEE_FOCUS: { selectedPositionId: "2-002", selectedEmployeeId: "e-006" },
  OFFBOARDING_EMPLOYEE_FOCUS: { selectedPositionId: "2-006", selectedEmployeeId: "e-008" },
  MISSING_COMPLIANCE_FOCUS: { selectedPositionId: "1-002", selectedEmployeeId: "e-002" },
  FULL_ORGANIZATION_VIEW: { selectedPositionId: "1-001", selectedEmployeeId: null },
};

interface EffectiveSeed {
  positions: Position[];
  employees: Employee[];
  documents: EmployeeDocument[];
  policies: PolicyDefinition[];
  policyAcknowledgements: PolicyAcknowledgement[];
  onboardingTasks: OnboardingTaskDefinition[];
  employeeOnboarding: EmployeeOnboardingState[];
}

interface PositionComputedContext {
  position: Position;
  employee: Employee | null;
  statusDot: StatusDot;
  manager: { position: Position; employee: Employee | null } | null;
  directReports: { position: Position; employee: Employee | null }[];
  readiness: ReadinessScore;
  missingItems: MissingItem[];
  compliance: ComplianceItem[];
  documentStatus: EmployeeDocumentStatus[];
  policyStatus: PolicyAckView[];
  onboardingTasks: { title: string; status: "complete" | "pending" | "not_applicable" }[];
}

interface CsvImportResult<T> {
  imported: T[];
  errors: string[];
}

function isoNow(): string {
  return new Date().toISOString();
}

function parseIso(input: string): number {
  const value = new Date(input).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function daysSince(input: string, now: string): number {
  const diff = parseIso(now) - parseIso(input);
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function plusDays(now: string, days: number): string {
  const value = new Date(parseIso(now) + days * 24 * 60 * 60 * 1000);
  return value.toISOString().slice(0, 10);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function mergeUniqueById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return [...map.values()];
}

function mergeSeed(seed: SeedData, control: ControlState): EffectiveSeed {
  const editedPositions = seed.positions.map((position) => {
    const edit = control.positionEdits.find((item) => item.id === position.id);
    return edit ? { ...position, title: edit.title, department: edit.department } : position;
  });

  const positions = mergeUniqueById([...editedPositions, ...control.addedPositions]).sort((a, b) => a.order - b.order);
  const employees = mergeUniqueById([...seed.employees, ...control.addedEmployees]);
  const documents = [...seed.documents, ...control.uploadedDocuments];

  const overridePolicies = new Map(control.policyVersionOverrides.map((item) => [item.policyId, item]));
  const policies = seed.policies.map((policy) => {
    const override = overridePolicies.get(policy.id);
    if (!override) return policy;
    return {
      ...policy,
      version: override.version,
      effectiveDate: override.effectiveDate,
      uploadedBy: override.uploadedBy,
    };
  });

  const policyAcknowledgements = [...seed.policyAcknowledgements];
  for (const override of control.policyAckOverrides) {
    const index = policyAcknowledgements.findIndex(
      (item) =>
        item.policyId === override.policyId &&
        item.employeeId === override.employeeId &&
        item.version === override.version,
    );
    const next: PolicyAcknowledgement = {
      policyId: override.policyId,
      employeeId: override.employeeId,
      version: override.version,
      status: override.status,
      acknowledgedAt: override.acknowledgedAt,
      pendingSince: override.pendingSince,
    };
    if (index >= 0) policyAcknowledgements[index] = next;
    else policyAcknowledgements.push(next);
  }

  const employeeOnboarding = [...seed.employeeOnboarding];
  for (const override of control.onboardingOverrides) {
    const index = employeeOnboarding.findIndex(
      (item) => item.employeeId === override.employeeId && item.taskId === override.taskId,
    );
    const next: EmployeeOnboardingState = {
      employeeId: override.employeeId,
      taskId: override.taskId,
      status: override.status,
      completedAt: override.completedAt,
    };
    if (index >= 0) employeeOnboarding[index] = next;
    else employeeOnboarding.push(next);
  }

  return {
    positions,
    employees,
    documents,
    policies,
    policyAcknowledgements,
    onboardingTasks: seed.onboardingTasks,
    employeeOnboarding,
  };
}

function employeeForPosition(employees: Employee[], positionId: string): Employee | null {
  return employees.find((employee) => employee.positionId === positionId) ?? null;
}

function isOnApprovedLeave(employee: Employee, now: string): boolean {
  if (!employee.leaveStartDate || !employee.leaveEndDate) return false;
  const nowDate = parseIso(now);
  return parseIso(employee.leaveStartDate) <= nowDate && parseIso(employee.leaveEndDate) >= nowDate;
}

function computeStatusDot(employee: Employee | null, temporaryOoo: TemporaryOooOverride[], now: string): StatusDot {
  if (!employee) return "grey";
  if (isOnApprovedLeave(employee, now)) return "grey";
  const override = temporaryOoo.find((item) => item.employeeId === employee.id);
  if (override) {
    const active = !override.endsAt || parseIso(override.endsAt) >= parseIso(now);
    if (active) return "yellow";
  }
  return "green";
}

function findPositionById(positions: Position[], id: string | null): Position | null {
  if (!id) return null;
  return positions.find((position) => position.id === id) ?? null;
}

function buildDirectReports(
  positions: Position[],
  employees: Employee[],
  positionId: string,
): { position: Position; employee: Employee | null }[] {
  return positions
    .filter((position) => position.reportsToId === positionId)
    .sort((a, b) => a.order - b.order)
    .map((position) => ({
      position,
      employee: employeeForPosition(employees, position.id),
    }));
}

function applicablePolicies(
  policies: PolicyDefinition[],
  employee: Employee,
  position: Position,
): PolicyDefinition[] {
  return policies.filter((policy) => {
    const departmentAllowed =
      policy.applicableDepartments.includes("all") || policy.applicableDepartments.includes(position.department);
    const regionAllowed = policy.applicableRegions.includes("all") || policy.applicableRegions.includes(employee.region);
    return departmentAllowed && regionAllowed;
  });
}

function latestDocument(
  documents: EmployeeDocument[],
  employeeId: string,
  category: DocumentCategory,
): EmployeeDocument | null {
  const matches = documents
    .filter((doc) => doc.employeeId === employeeId && doc.category === category)
    .sort((a, b) => parseIso(b.uploadedAt) - parseIso(a.uploadedAt));
  return matches[0] ?? null;
}

function buildDocumentStatus(employee: Employee, documents: EmployeeDocument[]): EmployeeDocumentStatus[] {
  const requiredCategories: DocumentCategory[] = [...REQUIRED_EMPLOYEE_DOCUMENTS];
  if (employee.requiresResidenceAuthorization) requiredCategories.push("Residence Authorization");

  return requiredCategories.map((category) => {
    const doc = latestDocument(documents, employee.id, category);
    if (category === "Residence Authorization" && !employee.requiresResidenceAuthorization) {
      return {
        category,
        status: "not_applicable",
        detail: "Not required for employee region",
        isRequired: false,
        document: null,
      };
    }

    if (!doc) {
      return {
        category,
        status: "missing",
        detail: `${category} is missing`,
        isRequired: true,
        document: null,
      };
    }

    if (doc.status === "expired") {
      return {
        category,
        status: "expired",
        detail: `${category} expired${doc.expiresAt ? ` on ${doc.expiresAt}` : ""}`,
        isRequired: true,
        document: doc,
      };
    }

    return {
      category,
      status: "compliant",
      detail: `${category} uploaded`,
      isRequired: true,
      document: doc,
    };
  });
}

function buildPolicyStatus(
  policies: PolicyDefinition[],
  acknowledgements: PolicyAcknowledgement[],
  employee: Employee,
  position: Position,
): PolicyAckView[] {
  return applicablePolicies(policies, employee, position).map((policy) => {
    const match = acknowledgements
      .filter((ack) => ack.policyId === policy.id && ack.employeeId === employee.id)
      .sort((a, b) => b.version - a.version)[0];

    if (!match || match.version !== policy.version) {
      return {
        policyId: policy.id,
        policyName: policy.name,
        version: policy.version,
        status: "pending",
        pendingSince: policy.effectiveDate,
      };
    }

    return {
      policyId: policy.id,
      policyName: policy.name,
      version: policy.version,
      status: match.status,
      pendingSince: match.pendingSince,
      acknowledgedAt: match.acknowledgedAt,
    };
  });
}

function buildOnboardingStatus(
  tasks: OnboardingTaskDefinition[],
  states: EmployeeOnboardingState[],
  employeeId: string,
): { title: string; status: "complete" | "pending" | "not_applicable"; required: boolean }[] {
  return tasks.map((task) => {
    const state = states.find((item) => item.employeeId === employeeId && item.taskId === task.id);
    if (task.requirementLevel === "not_applicable") {
      return { title: task.title, status: "not_applicable", required: false };
    }
    if (state?.status === "complete") return { title: task.title, status: "complete", required: task.requirementLevel === "required" };
    if (state?.status === "not_applicable") return { title: task.title, status: "not_applicable", required: false };
    return { title: task.title, status: "pending", required: task.requirementLevel === "required" };
  });
}

function buildComplianceItems(
  employee: Employee,
  position: Position,
  documentStatus: EmployeeDocumentStatus[],
  policyStatus: PolicyAckView[],
  onboardingStatus: { title: string; status: "complete" | "pending" | "not_applicable"; required: boolean }[],
): ComplianceItem[] {
  const requiredDocs = documentStatus.filter((item) => item.isRequired && item.status !== "not_applicable");
  const requiredOnboarding = onboardingStatus.filter((item) => item.required);

  const missingDocs = requiredDocs.filter((item) => item.status === "missing");
  const expiredDocs = requiredDocs.filter((item) => item.status === "expired");
  const pendingPolicies = policyStatus.filter((item) => item.status === "pending");
  const pendingOnboarding = requiredOnboarding.filter((item) => item.status !== "complete");

  const employmentEligibilityStatus: ComplianceItem["status"] =
    missingDocs.some((item) => item.category === "Identity Document" || item.category === "Employment Authorization")
      ? "missing"
      : expiredDocs.some((item) => item.category === "Identity Document" || item.category === "Employment Authorization")
      ? "expired"
      : "compliant";

  return [
    {
      id: `cmp-eligibility-${employee.id}`,
      employeeId: employee.id,
      employeeName: employee.name,
      positionId: position.id,
      positionTitle: position.title,
      category: "Employment Eligibility",
      status: employmentEligibilityStatus,
      detail:
        employmentEligibilityStatus === "compliant"
          ? "Eligibility documentation complete"
          : "Eligibility documentation incomplete",
    },
    {
      id: `cmp-docs-${employee.id}`,
      employeeId: employee.id,
      employeeName: employee.name,
      positionId: position.id,
      positionTitle: position.title,
      category: "Document Compliance",
      status: missingDocs.length > 0 ? "missing" : expiredDocs.length > 0 ? "expired" : "compliant",
      detail:
        missingDocs.length > 0
          ? `${missingDocs.length} required documents missing`
          : expiredDocs.length > 0
          ? `${expiredDocs.length} required documents expired`
          : "All required documents are valid",
    },
    {
      id: `cmp-policy-${employee.id}`,
      employeeId: employee.id,
      employeeName: employee.name,
      positionId: position.id,
      positionTitle: position.title,
      category: "Policy Compliance",
      status: pendingPolicies.length > 0 ? "missing" : "compliant",
      detail:
        pendingPolicies.length > 0
          ? `${pendingPolicies.length} policies pending acknowledgement`
          : "All applicable policies acknowledged",
    },
    {
      id: `cmp-onboarding-${employee.id}`,
      employeeId: employee.id,
      employeeName: employee.name,
      positionId: position.id,
      positionTitle: position.title,
      category: "Onboarding Compliance",
      status: pendingOnboarding.length > 0 ? "missing" : "compliant",
      detail:
        pendingOnboarding.length > 0
          ? `${pendingOnboarding.length} onboarding tasks pending`
          : "All required onboarding tasks complete",
    },
  ];
}

function resolveOwner(
  position: Position,
  positions: Position[],
  employees: Employee[],
): string {
  const managerPosition = findPositionById(positions, position.reportsToId);
  const managerEmployee = managerPosition ? employeeForPosition(employees, managerPosition.id) : null;
  if (managerEmployee) return managerEmployee.name;

  const departmentHead = positions
    .filter((item) => item.department === position.department)
    .sort((a, b) => a.level - b.level)[0];
  const departmentEmployee = departmentHead ? employeeForPosition(employees, departmentHead.id) : null;
  if (departmentEmployee) return departmentEmployee.name;

  const cooPosition = positions.find((item) => item.title === "COO");
  const cooEmployee = cooPosition ? employeeForPosition(employees, cooPosition.id) : null;
  if (cooEmployee) return cooEmployee.name;

  return "COO";
}

function readinessFromCounts(components: ReadinessComponent[]): ReadinessScore {
  const included = components.filter((component) => component.included);
  const includedWeight = included.reduce((sum, component) => sum + component.weight, 0);
  if (includedWeight === 0) {
    return { score: 0, components, includedWeight: 0, summaryText: "No applicable readiness inputs" };
  }
  const weighted = included.reduce((sum, component) => sum + component.percentage * component.weight, 0);
  const score = Math.round(weighted / includedWeight);
  const summaryText = included
    .map((component) => `${component.label}: ${component.completed}/${component.total}`)
    .join(" · ");
  return { score, components, includedWeight, summaryText };
}

function buildPositionContext(
  position: Position,
  employee: Employee | null,
  seed: EffectiveSeed,
  temporaryOoo: TemporaryOooOverride[],
  now: string,
): PositionComputedContext {
  const managerPosition = findPositionById(seed.positions, position.reportsToId);
  const manager = managerPosition
    ? { position: managerPosition, employee: employeeForPosition(seed.employees, managerPosition.id) }
    : null;
  const directReports = buildDirectReports(seed.positions, seed.employees, position.id);
  const statusDot = computeStatusDot(employee, temporaryOoo, now);

  if (!employee) {
    const emptyReadiness = readinessFromCounts([
      { key: "documents", label: "Documents", weight: READINESS_WEIGHTS.documents, completed: 0, total: 0, percentage: 0, included: false },
      { key: "compliance", label: "Compliance", weight: READINESS_WEIGHTS.compliance, completed: 0, total: 0, percentage: 0, included: false },
      { key: "policies", label: "Policies", weight: READINESS_WEIGHTS.policies, completed: 0, total: 0, percentage: 0, included: false },
      { key: "onboarding", label: "Onboarding", weight: READINESS_WEIGHTS.onboarding, completed: 0, total: 0, percentage: 0, included: false },
    ]);
    return {
      position,
      employee: null,
      statusDot,
      manager,
      directReports,
      readiness: emptyReadiness,
      missingItems: [],
      compliance: [],
      documentStatus: [],
      policyStatus: [],
      onboardingTasks: [],
    };
  }

  const documentStatus = buildDocumentStatus(employee, seed.documents);
  const policyStatus = buildPolicyStatus(seed.policies, seed.policyAcknowledgements, employee, position);
  const onboardingStatus = buildOnboardingStatus(seed.onboardingTasks, seed.employeeOnboarding, employee.id);
  const compliance = buildComplianceItems(employee, position, documentStatus, policyStatus, onboardingStatus);

  const docApplicable = documentStatus.filter((item) => item.status !== "not_applicable");
  const docCompleted = docApplicable.filter((item) => item.status === "compliant").length;

  const policyCompleted = policyStatus.filter((item) => item.status === "acknowledged").length;

  const complianceApplicable = compliance;
  const complianceCompleted = compliance.filter((item) => item.status === "compliant").length;

  const onboardingRequired = onboardingStatus.filter((item) => item.required);
  const onboardingCompleted = onboardingRequired.filter((item) => item.status === "complete").length;

  const readiness = readinessFromCounts([
    {
      key: "documents",
      label: "Documents",
      weight: READINESS_WEIGHTS.documents,
      completed: docCompleted,
      total: docApplicable.length,
      percentage: docApplicable.length === 0 ? 0 : Math.round((docCompleted / docApplicable.length) * 100),
      included: docApplicable.length > 0,
    },
    {
      key: "compliance",
      label: "Compliance",
      weight: READINESS_WEIGHTS.compliance,
      completed: complianceCompleted,
      total: complianceApplicable.length,
      percentage: complianceApplicable.length === 0 ? 0 : Math.round((complianceCompleted / complianceApplicable.length) * 100),
      included: complianceApplicable.length > 0,
    },
    {
      key: "policies",
      label: "Policies",
      weight: READINESS_WEIGHTS.policies,
      completed: policyCompleted,
      total: policyStatus.length,
      percentage: policyStatus.length === 0 ? 0 : Math.round((policyCompleted / policyStatus.length) * 100),
      included: policyStatus.length > 0,
    },
    {
      key: "onboarding",
      label: "Onboarding",
      weight: READINESS_WEIGHTS.onboarding,
      completed: onboardingCompleted,
      total: onboardingRequired.length,
      percentage: onboardingRequired.length === 0 ? 0 : Math.round((onboardingCompleted / onboardingRequired.length) * 100),
      included: onboardingRequired.length > 0,
    },
  ]);

  const owner = resolveOwner(position, seed.positions, seed.employees);
  const missingItems: MissingItem[] = [];

  for (const item of documentStatus) {
    if (item.status !== "missing" && item.status !== "expired") continue;
    const status: MissingItem["status"] = item.status;
    missingItems.push({
      id: `missing-doc-${position.id}-${slugify(item.category)}`,
      type: "document",
      label: item.category,
      status,
      reason: item.detail,
      owner,
      dueDate: plusDays(now, SLA_DAYS.document),
      actionId: `act-doc-${position.id}-${slugify(item.category)}`,
    });
  }

  for (const item of policyStatus) {
    if (item.status !== "pending") continue;
    missingItems.push({
      id: `missing-policy-${position.id}-${item.policyId}`,
      type: "policy",
      label: `${item.policyName} v${item.version}`,
      status: "pending",
      reason: `Acknowledgement pending since ${item.pendingSince}`,
      owner,
      dueDate: plusDays(now, SLA_DAYS.policy),
      actionId: `act-policy-${position.id}-${item.policyId}`,
    });
  }

  for (const item of onboardingStatus) {
    if (item.status !== "pending") continue;
    missingItems.push({
      id: `missing-onboarding-${position.id}-${slugify(item.title)}`,
      type: "onboarding",
      label: item.title,
      status: "pending",
      reason: `${item.title} not complete`,
      owner,
      dueDate: plusDays(now, SLA_DAYS.onboarding),
      actionId: `act-onboarding-${position.id}-${slugify(item.title)}`,
    });
  }

  for (const item of compliance) {
    if (item.status === "compliant") continue;
    missingItems.push({
      id: `missing-compliance-${position.id}-${slugify(item.category)}`,
      type: "compliance",
      label: item.category,
      status: item.status === "expired" ? "expired" : "missing",
      reason: item.detail,
      owner,
      dueDate: plusDays(now, SLA_DAYS.compliance),
      actionId: `act-compliance-${position.id}-${slugify(item.category)}`,
    });
  }

  return {
    position,
    employee,
    statusDot,
    manager,
    directReports,
    readiness,
    missingItems,
    compliance,
    documentStatus,
    policyStatus,
    onboardingTasks: onboardingStatus.map((item) => ({ title: item.title, status: item.status })),
  };
}

function generateRisks(contexts: PositionComputedContext[], now: string): RiskItem[] {
  const risks: RiskItem[] = [];

  for (const context of contexts) {
    const { position, employee } = context;

    if (!employee) {
      if (position.isCriticalPosition) {
        risks.push({
          id: `risk-vacant-${position.id}`,
          positionId: position.id,
          employeeId: null,
          positionTitle: position.title,
          employeeName: "Vacant",
          severity: "critical",
          trigger: "vacant_critical_position",
          cause: `Critical position ${position.title} is vacant`,
          impact: "Operational ownership gap in key function",
          action: "Assign an employee or interim owner immediately",
          daysOpen: 0,
        });
      }
      continue;
    }

    for (const document of context.documentStatus) {
      if (document.status !== "missing" && document.status !== "expired") continue;
      const severity: RiskItem["severity"] = document.status === "missing" && position.isCriticalPosition ? "critical" : "warning";
      risks.push({
        id: `risk-${document.status}-${position.id}-${slugify(document.category)}`,
        positionId: position.id,
        employeeId: employee.id,
        positionTitle: position.title,
        employeeName: employee.name,
        severity,
        trigger: document.status === "missing" ? "missing_document" : "expired_document",
        cause: `${document.category} is ${document.status}`,
        impact: "Compliance exposure and readiness drop",
        action: document.status === "missing" ? `Upload ${document.category}` : `Refresh ${document.category}`,
        daysOpen: 0,
      });
    }

    for (const policy of context.policyStatus) {
      if (policy.status !== "pending") continue;
      const pendingDays = daysSince(policy.pendingSince, now);
      if (pendingDays < RISK_THRESHOLDS.warningDays) continue;
      const severity: RiskItem["severity"] = pendingDays >= RISK_THRESHOLDS.criticalDays ? "critical" : "warning";
      risks.push({
        id: `risk-policy-${position.id}-${policy.policyId}`,
        positionId: position.id,
        employeeId: employee.id,
        positionTitle: position.title,
        employeeName: employee.name,
        severity,
        trigger: "policy_pending",
        cause: `${policy.policyName} acknowledgement pending ${pendingDays} days`,
        impact: "Policy non-compliance and audit readiness risk",
        action: `Collect acknowledgement for ${policy.policyName}`,
        daysOpen: pendingDays,
      });
    }

    const onboardingPending = context.onboardingTasks.filter((item) => item.status === "pending").length;
    if (onboardingPending > 0) {
      const startedDaysAgo = daysSince(employee.startDate, now);
      const severity: RiskItem["severity"] = startedDaysAgo >= RISK_THRESHOLDS.criticalDays ? "critical" : "warning";
      risks.push({
        id: `risk-onboarding-${position.id}`,
        positionId: position.id,
        employeeId: employee.id,
        positionTitle: position.title,
        employeeName: employee.name,
        severity,
        trigger: "onboarding_incomplete",
        cause: `${onboardingPending} onboarding tasks incomplete`,
        impact: "Reduced operational readiness for the role",
        action: "Complete remaining onboarding tasks",
        daysOpen: startedDaysAgo,
      });
    }
  }

  return risks.sort((a, b) => (a.severity === b.severity ? b.daysOpen - a.daysOpen : a.severity === "critical" ? -1 : 1));
}

function mapRiskToAction(risk: RiskItem, actionState: ActionState | undefined, now: string): ActionItem {
  let dueDate = plusDays(now, 7);
  let requiresUpload = false;
  let suggestedFileCategory: DocumentCategory | null = null;

  if (risk.trigger === "missing_document" || risk.trigger === "expired_document") {
    dueDate = plusDays(now, 3);
    requiresUpload = true;
    const docName = risk.action.replace(/^Upload\s|^Refresh\s/, "").trim() as DocumentCategory;
    suggestedFileCategory = docName;
  } else if (risk.trigger === "policy_pending") {
    dueDate = plusDays(now, 2);
  } else if (risk.trigger === "vacant_critical_position") {
    dueDate = plusDays(now, 1);
  } else if (risk.trigger === "onboarding_incomplete") {
    dueDate = plusDays(now, 4);
  }

  return {
    id: `action-${risk.id}`,
    positionId: risk.positionId,
    employeeId: risk.employeeId,
    positionTitle: risk.positionTitle,
    employeeName: risk.employeeName,
    label: risk.action,
    detail: `${risk.cause} -> ${risk.impact}`,
    requiresUpload,
    suggestedFileCategory,
    dueDate,
    status: actionState?.status ?? "open",
    completedAt: actionState?.completedAt,
    completedBy: actionState?.completedBy,
    evidence: actionState?.evidence,
    uploadedFileName: actionState?.uploadedFileName,
  };
}

function buildOrgTree(
  positions: Position[],
  employees: Employee[],
  temporaryOoo: TemporaryOooOverride[],
  matchedPositionIds: Set<string>,
  openRiskByPosition: Map<string, number>,
  openActionByPosition: Map<string, number>,
  now: string,
  parentId: string | null,
): OrgNode[] {
  const children = positions
    .filter((position) => position.reportsToId === parentId)
    .sort((a, b) => a.order - b.order);

  return children.map((position) => {
    const employee = employeeForPosition(employees, position.id);
    const nested = buildOrgTree(
      positions,
      employees,
      temporaryOoo,
      matchedPositionIds,
      openRiskByPosition,
      openActionByPosition,
      now,
      position.id,
    );

    return {
      position,
      employee,
      children: nested,
      directReportCount: positions.filter((item) => item.reportsToId === position.id).length,
      statusDot: computeStatusDot(employee, temporaryOoo, now),
      hasSearchMatch: matchedPositionIds.has(position.id),
      openRiskCount: openRiskByPosition.get(position.id) ?? 0,
      openActionCount: openActionByPosition.get(position.id) ?? 0,
    };
  });
}

function ancestryIds(positions: Position[], targetId: string | null): string[] {
  if (!targetId) return [];
  const ids: string[] = [];
  let current: string | null = targetId;
  while (current) {
    ids.push(current);
    const pos = findPositionById(positions, current);
    current = pos?.reportsToId ?? null;
  }
  return ids.reverse();
}

function filterTreeForView(
  nodes: OrgNode[],
  predicate: (positionId: string, hasRisk: boolean, hasAction: boolean, hasEmployee: boolean) => boolean,
  collapseLevel: number,
  focusPath: Set<string> | null,
  depth = 0,
): OrgNode[] {
  const next: OrgNode[] = [];
  for (const node of nodes) {
    const includeFocus = !focusPath || focusPath.has(node.position.id);
    if (!includeFocus) continue;

    const children =
      depth + 1 >= collapseLevel
        ? []
        : filterTreeForView(node.children, predicate, collapseLevel, focusPath, depth + 1);

    const includeNode = predicate(
      node.position.id,
      node.openRiskCount > 0,
      node.openActionCount > 0,
      Boolean(node.employee),
    );

    if (includeNode || children.length > 0) {
      next.push({ ...node, children });
    }
  }
  return next;
}

function employeeStatusLabel(employee: Employee): string {
  if (employee.status === "on_leave") return "On Leave";
  if (employee.status === "offboarding") return "Offboarding";
  return "Working";
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function buildEmployeeDirectory(
  positions: Position[],
  employees: Employee[],
  temporaryOoo: TemporaryOooOverride[],
  search: string,
  now: string,
): EmployeeDirectoryRow[] {
  const query = normalizeSearch(search);
  const rows = positions
    .map((position) => {
      const employee = employeeForPosition(employees, position.id);
      if (!employee) return null;
      const manager = findPositionById(positions, position.reportsToId);
      const managerEmployee = manager ? employeeForPosition(employees, manager.id) : null;
      return {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        positionId: position.id,
        positionTitle: position.title,
        department: position.department,
        location: employee.location,
        statusDot: computeStatusDot(employee, temporaryOoo, now),
        managerName: managerEmployee?.name ?? manager?.title ?? "—",
      } satisfies EmployeeDirectoryRow;
    })
    .filter((item): item is EmployeeDirectoryRow => Boolean(item));

  if (!query) return rows;
  return rows.filter((row) => {
    const text = `${row.name} ${row.positionTitle} ${row.department} ${row.managerName}`.toLowerCase();
    return text.includes(query);
  });
}

function buildFinanceRows(
  positions: Position[],
  employees: Employee[],
  search: string,
  sortBy: FinanceSortBy,
  sortDirection: "asc" | "desc",
): FinanceReportRow[] {
  const rows = positions
    .map((position) => {
      const employee = employeeForPosition(employees, position.id);
      if (!employee) return null;
      const managerPos = findPositionById(positions, position.reportsToId);
      const managerEmp = managerPos ? employeeForPosition(employees, managerPos.id) : null;
      return {
        employeeId: employee.employeeCode,
        employeeName: employee.name,
        position: position.title,
        department: position.department,
        manager: managerEmp?.name ?? managerPos?.title ?? "—",
        employmentStatus: employeeStatusLabel(employee),
        salary: employee.salary,
        currency: employee.currency,
        bankName: employee.bankName,
        accountNumber: employee.bankAccount,
        iban: employee.iban,
        joinDate: employee.startDate,
      } satisfies FinanceReportRow;
    })
    .filter((item): item is FinanceReportRow => Boolean(item));

  const query = normalizeSearch(search);
  const filtered =
    query.length === 0
      ? rows
      : rows.filter((row) =>
          `${row.employeeName} ${row.employeeId} ${row.position} ${row.department} ${row.manager}`
            .toLowerCase()
            .includes(query),
        );

  const direction = sortDirection === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const left = financeSortValue(a, sortBy);
    const right = financeSortValue(b, sortBy);
    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;
    return 0;
  });
}

function financeSortValue(row: FinanceReportRow, sortBy: FinanceSortBy): string | number {
  if (sortBy === "employeeCode") return row.employeeId;
  if (sortBy === "name") return row.employeeName;
  if (sortBy === "position") return row.position;
  if (sortBy === "department") return row.department;
  if (sortBy === "manager") return row.manager;
  if (sortBy === "status") return row.employmentStatus;
  if (sortBy === "salary") return row.salary;
  if (sortBy === "currency") return row.currency;
  if (sortBy === "bankName") return row.bankName;
  if (sortBy === "bankAccount") return row.accountNumber;
  if (sortBy === "iban") return row.iban;
  return row.joinDate;
}

function buildDocumentsRepository(
  positions: Position[],
  employees: Employee[],
  contexts: PositionComputedContext[],
  documents: EmployeeDocument[],
): DocumentsRepositoryRow[] {
  return contexts
    .filter((context): context is PositionComputedContext & { employee: Employee } => Boolean(context.employee))
    .map((context) => {
      const employeeDocs = documents.filter((doc) => doc.employeeId === context.employee.id);
      return {
        employeeId: context.employee.id,
        employeeName: context.employee.name,
        positionTitle: context.position.title,
        missingCount: context.documentStatus.filter((item) => item.status === "missing").length,
        expiredCount: context.documentStatus.filter((item) => item.status === "expired").length,
        documents: employeeDocs,
      };
    })
    .sort((a, b) => b.missingCount + b.expiredCount - (a.missingCount + a.expiredCount));
}

function buildPolicyLibrary(
  policies: PolicyDefinition[],
  acknowledgements: PolicyAcknowledgement[],
  positions: Position[],
  employees: Employee[],
): PolicyLibraryItem[] {
  return policies.map((policy) => {
    let acknowledgedCount = 0;
    let pendingCount = 0;

    for (const employee of employees) {
      const position = findPositionById(positions, employee.positionId);
      if (!position) continue;
      const applicable = applicablePolicies([policy], employee, position).length > 0;
      if (!applicable) continue;

      const ack = acknowledgements
        .filter((item) => item.policyId === policy.id && item.employeeId === employee.id)
        .sort((a, b) => b.version - a.version)[0];

      if (!ack || ack.version !== policy.version || ack.status === "pending") pendingCount += 1;
      else acknowledgedCount += 1;
    }

    return { policy, acknowledgedCount, pendingCount };
  });
}

function selectProfile(
  selectedEmployee: Employee | null,
  selectedPosition: Position | null,
  contexts: PositionComputedContext[],
  pendingActions: ActionItem[],
  actionHistory: ActionItem[],
): EmployeeProfileView | null {
  if (!selectedEmployee || !selectedPosition) return null;
  const context = contexts.find((item) => item.position.id === selectedPosition.id && item.employee?.id === selectedEmployee.id);
  if (!context) return null;

  const manager = context.manager?.employee
    ? { employee: context.manager.employee, position: context.manager.position }
    : null;

  const directReports = context.directReports
    .filter((item): item is { position: Position; employee: Employee } => Boolean(item.employee))
    .map((item) => ({ position: item.position, employee: item.employee }));

  return {
    employee: selectedEmployee,
    position: selectedPosition,
    manager,
    directReports,
    documentStatus: context.documentStatus,
    policyStatus: context.policyStatus,
    compliance: context.compliance,
    readiness: context.readiness,
    pendingActions: pendingActions.filter((action) => action.employeeId === selectedEmployee.id),
    completedActions: actionHistory.filter((action) => action.employeeId === selectedEmployee.id),
    onboardingTasks: context.onboardingTasks,
  };
}

function buildEmptyStates(seed: EffectiveSeed): UIState["emptyStates"] {
  return {
    firstOrgSetup: seed.positions.length === 0,
    noEmployees: seed.employees.length === 0,
    noPolicies: seed.policies.length === 0,
    noDocuments: seed.documents.length === 0,
  };
}

export function createDefaultControlState(seed: SeedData): ControlState {
  const root = seed.positions.find((position) => position.reportsToId === null) ?? seed.positions[0];
  const selectedEmployee = root ? seed.employees.find((employee) => employee.positionId === root.id) ?? null : null;
  const now = isoNow();

  return {
    scenarioId: "DEFAULT_VIEW",
    selectedPositionId: root?.id ?? "",
    selectedEmployeeId: selectedEmployee?.id ?? null,
    selectedActionId: null,
    positionEdits: [],
    activeKpiFilter: "all",
    orgSearchQuery: "",
    collapseLevel: 4,
    focusPathOnly: false,
    detailPanelOpen: false,
    readinessExpanded: false,
    employeeSearch: "",
    financeSearch: "",
    financeSortBy: "name",
    financeSortDirection: "asc",
    temporaryOoo: [],
    actionStates: [],
    uploadedDocuments: [],
    policyVersionOverrides: [],
    policyAckOverrides: [],
    onboardingOverrides: [],
    addedPositions: [],
    addedEmployees: [],
    setupState: {
      currentStep: 1,
      completedSteps: [],
      dismissed: false,
      lastSavedAt: now,
    },
    auditEvents: [],
  };
}

export function transitionAction(
  controlState: ControlState,
  params: {
    actionId: string;
    status: ActionLifecycleStatus;
    completedBy?: string;
    evidence?: string;
    uploadedFileName?: string;
  },
): ControlState {
  const now = isoNow();
  const existing = controlState.actionStates.find((item) => item.actionId === params.actionId);
  const next: ActionState = {
    actionId: params.actionId,
    status: params.status,
    updatedAt: now,
    completedAt: params.status === "completed" ? now : existing?.completedAt,
    completedBy: params.status === "completed" ? params.completedBy : existing?.completedBy,
    evidence: params.status === "completed" ? params.evidence : existing?.evidence,
    uploadedFileName: params.status === "completed" ? params.uploadedFileName : existing?.uploadedFileName,
    archivedAt: params.status === "archived" ? now : existing?.archivedAt,
  };

  const actionStates = existing
    ? controlState.actionStates.map((item) => (item.actionId === params.actionId ? next : item))
    : [...controlState.actionStates, next];

  return {
    ...controlState,
    actionStates,
    auditEvents: [
      {
        id: `audit-action-${params.actionId}-${now}`,
        type: "action_state_change",
        message: `Action ${params.actionId} moved to ${params.status}`,
        timestamp: now,
        actionId: params.actionId,
      },
      {
        id: `audit-risk-${params.actionId}-${now}`,
        type: "risk_state_change",
        message: `Risk state recalculated from action ${params.actionId}`,
        timestamp: now,
      },
      ...controlState.auditEvents,
    ],
  };
}

export function setTemporaryOoo(
  controlState: ControlState,
  override: TemporaryOooOverride,
): ControlState {
  const temporaryOoo = controlState.temporaryOoo.some((item) => item.employeeId === override.employeeId)
    ? controlState.temporaryOoo.map((item) => (item.employeeId === override.employeeId ? override : item))
    : [...controlState.temporaryOoo, override];

  return {
    ...controlState,
    temporaryOoo,
  };
}

export function clearTemporaryOoo(controlState: ControlState, employeeId: string): ControlState {
  return {
    ...controlState,
    temporaryOoo: controlState.temporaryOoo.filter((item) => item.employeeId !== employeeId),
  };
}

export function publishPolicyVersion(
  controlState: ControlState,
  params: { policyId: string; version: number; effectiveDate: string; uploadedBy: string },
): ControlState {
  const now = isoNow();
  const override: PolicyVersionOverride = {
    policyId: params.policyId,
    version: params.version,
    effectiveDate: params.effectiveDate,
    uploadedBy: params.uploadedBy,
    updatedAt: now,
  };

  const policyVersionOverrides = controlState.policyVersionOverrides.some((item) => item.policyId === params.policyId)
    ? controlState.policyVersionOverrides.map((item) => (item.policyId === params.policyId ? override : item))
    : [...controlState.policyVersionOverrides, override];

  return {
    ...controlState,
    policyVersionOverrides,
    auditEvents: [
      {
        id: `audit-policy-${params.policyId}-${now}`,
        type: "policy_update",
        message: `Policy ${params.policyId} published as v${params.version}`,
        timestamp: now,
      },
      ...controlState.auditEvents,
    ],
  };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function csvRows(csvText: string): string[][] {
  return csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseCsvLine(line));
}

export function importPositionsFromCsv(
  seed: SeedData,
  controlState: ControlState,
  csvText: string,
): CsvImportResult<Position> {
  const rows = csvRows(csvText);
  if (rows.length === 0) return { imported: [], errors: ["CSV is empty"] };

  const header = rows[0].map((cell) => cell.toLowerCase());
  const required = ["positiontitle", "department", "reportingmanager"];
  const missingColumns = required.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) {
    return { imported: [], errors: [`Missing required columns: ${missingColumns.join(", ")}`] };
  }

  const titleIdx = header.indexOf("positiontitle");
  const departmentIdx = header.indexOf("department");
  const managerIdx = header.indexOf("reportingmanager");
  const criticalIdx = header.indexOf("iscriticalposition");

  const now = isoNow();
  const existing = [...seed.positions, ...controlState.addedPositions];
  const existingTitles = new Set(existing.map((item) => item.title.toLowerCase()));
  const imported: Position[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const positionTitle = (row[titleIdx] ?? "").trim();
    const department = (row[departmentIdx] ?? "").trim();
    const reportingManager = (row[managerIdx] ?? "").trim();
    const criticalValue = (row[criticalIdx] ?? "false").trim().toLowerCase();

    if (!positionTitle || !department || !reportingManager) {
      errors.push(`Row ${rowNumber}: required fields positionTitle/department/reportingManager are missing`);
      return;
    }

    if (existingTitles.has(positionTitle.toLowerCase()) || imported.some((item) => item.title.toLowerCase() === positionTitle.toLowerCase())) {
      errors.push(`Row ${rowNumber}: duplicate positionTitle '${positionTitle}'`);
      return;
    }

    const manager = [...existing, ...imported].find((item) => item.title.toLowerCase() === reportingManager.toLowerCase());
    if (!manager) {
      errors.push(`Row ${rowNumber}: reportingManager '${reportingManager}' not found`);
      return;
    }

    const isCriticalPosition = ["true", "1", "yes", "y"].includes(criticalValue);
    const id = `csv-pos-${Date.now()}-${index}`;
    imported.push({
      id,
      title: positionTitle,
      department,
      reportsToId: manager.id,
      order: existing.length + imported.length,
      level: manager.level + 1,
      isCriticalPosition,
    });

    existingTitles.add(positionTitle.toLowerCase());
  });

  return { imported, errors };
}

export function importEmployeesFromCsv(
  seed: SeedData,
  controlState: ControlState,
  csvText: string,
): CsvImportResult<Employee> {
  const rows = csvRows(csvText);
  if (rows.length === 0) return { imported: [], errors: ["CSV is empty"] };

  const header = rows[0].map((cell) => cell.toLowerCase());
  const required = ["name", "email", "positiontitle"];
  const missingColumns = required.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) {
    return { imported: [], errors: [`Missing required columns: ${missingColumns.join(", ")}`] };
  }

  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  const positionIdx = header.indexOf("positiontitle");

  const positions = [...seed.positions, ...controlState.addedPositions];
  const existingEmails = new Set([...seed.employees, ...controlState.addedEmployees].map((item) => item.email.toLowerCase()));

  const imported: Employee[] = [];
  const errors: string[] = [];

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const name = (row[nameIdx] ?? "").trim();
    const email = (row[emailIdx] ?? "").trim().toLowerCase();
    const positionTitle = (row[positionIdx] ?? "").trim();

    if (!name || !email || !positionTitle) {
      errors.push(`Row ${rowNumber}: required fields name/email/positionTitle are missing`);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Row ${rowNumber}: invalid email '${email}'`);
      return;
    }

    if (existingEmails.has(email) || imported.some((item) => item.email === email)) {
      errors.push(`Row ${rowNumber}: duplicate email '${email}'`);
      return;
    }

    const position = positions.find((item) => item.title.toLowerCase() === positionTitle.toLowerCase());
    if (!position) {
      errors.push(`Row ${rowNumber}: positionTitle '${positionTitle}' not found`);
      return;
    }

    const initials = name
      .split(" ")
      .map((item) => item[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2);

    const id = `csv-emp-${Date.now()}-${index}`;
    imported.push({
      id,
      employeeCode: `EMP-${5000 + index}`,
      name,
      positionId: position.id,
      status: "active",
      email,
      phone: "",
      location: "",
      timeZone: "UTC",
      region: "US",
      startDate: isoNow().slice(0, 10),
      address: "",
      nationality: "",
      dateOfBirth: "",
      employmentType: "full_time",
      avatarInitials: initials || "NA",
      avatarColor: "#64748b",
      salary: 0,
      currency: "USD",
      bankName: "",
      bankAccount: "",
      iban: "",
      requiresResidenceAuthorization: false,
      onboardingStatus: "not_started",
      onboardingProgress: 0,
      emergencyContacts: [],
      activityHistory: [],
    });

    existingEmails.add(email);
  });

  return { imported, errors };
}

export function computeUIState(seed: SeedData, controlState: ControlState): UIState {
  const scenario = SCENARIOS[controlState.scenarioId] ?? {};
  const mergedControl: ControlState = {
    ...controlState,
    ...scenario,
    positionEdits: controlState.positionEdits ?? [],
    temporaryOoo: controlState.temporaryOoo ?? [],
    actionStates: controlState.actionStates ?? [],
    uploadedDocuments: controlState.uploadedDocuments ?? [],
    policyVersionOverrides: controlState.policyVersionOverrides ?? [],
    policyAckOverrides: controlState.policyAckOverrides ?? [],
    onboardingOverrides: controlState.onboardingOverrides ?? [],
    addedPositions: controlState.addedPositions ?? [],
    addedEmployees: controlState.addedEmployees ?? [],
    auditEvents: controlState.auditEvents ?? [],
  };

  const now = isoNow();
  const effectiveSeed = mergeSeed(seed, mergedControl);

  const selectedPosition =
    effectiveSeed.positions.find((position) => position.id === mergedControl.selectedPositionId) ?? null;
  const selectedEmployee = mergedControl.selectedEmployeeId
    ? effectiveSeed.employees.find((employee) => employee.id === mergedControl.selectedEmployeeId) ?? null
    : selectedPosition
    ? employeeForPosition(effectiveSeed.employees, selectedPosition.id)
    : null;

  const contexts = effectiveSeed.positions
    .map((position) =>
      buildPositionContext(
        position,
        employeeForPosition(effectiveSeed.employees, position.id),
        effectiveSeed,
        mergedControl.temporaryOoo,
        now,
      ),
    )
    .sort((a, b) => a.position.order - b.position.order);

  const risks = generateRisks(contexts, now);
  const actionStateById = new Map(mergedControl.actionStates.map((item) => [item.actionId, item]));

  const allActions = risks.map((risk) => mapRiskToAction(risk, actionStateById.get(`action-${risk.id}`), now));
  const pendingActions = allActions.filter((action) => action.status === "open" || action.status === "in_progress");
  const actionHistory = allActions.filter((action) => action.status === "completed" || action.status === "archived");

  const openRiskByPosition = new Map<string, number>();
  for (const risk of risks) {
    openRiskByPosition.set(risk.positionId, (openRiskByPosition.get(risk.positionId) ?? 0) + 1);
  }

  const openActionByPosition = new Map<string, number>();
  for (const action of pendingActions) {
    openActionByPosition.set(action.positionId, (openActionByPosition.get(action.positionId) ?? 0) + 1);
  }

  const searchQuery = normalizeSearch(mergedControl.orgSearchQuery);
  const matchedPositionIds = new Set<string>();
  if (searchQuery) {
    for (const position of effectiveSeed.positions) {
      const employee = employeeForPosition(effectiveSeed.employees, position.id);
      const text = `${position.title} ${employee?.name ?? ""}`.toLowerCase();
      if (text.includes(searchQuery)) matchedPositionIds.add(position.id);
    }
  }

  const orgTree = buildOrgTree(
    effectiveSeed.positions,
    effectiveSeed.employees,
    mergedControl.temporaryOoo,
    matchedPositionIds,
    openRiskByPosition,
    openActionByPosition,
    now,
    null,
  );

  const filterPredicate = (positionId: string, hasRisk: boolean, hasAction: boolean, hasEmployee: boolean) => {
    if (mergedControl.activeKpiFilter === "filled") return hasEmployee;
    if (mergedControl.activeKpiFilter === "vacant") return !hasEmployee;
    if (mergedControl.activeKpiFilter === "open_risks") return hasRisk;
    if (mergedControl.activeKpiFilter === "open_actions") return hasAction;
    return true;
  };

  const focusPathIdsArray = mergedControl.focusPathOnly
    ? ancestryIds(effectiveSeed.positions, selectedPosition?.id ?? null)
    : [];
  const focusPathSet = mergedControl.focusPathOnly ? new Set(focusPathIdsArray) : null;

  const filteredOrgTree = filterTreeForView(
    orgTree,
    filterPredicate,
    Math.max(1, mergedControl.collapseLevel),
    focusPathSet,
  );

  const complianceView = contexts.flatMap((context) => context.compliance);

  const positionDetail = selectedPosition
    ? contexts.find((context) => context.position.id === selectedPosition.id) ?? null
    : null;

  const selectedProfile = selectProfile(selectedEmployee, selectedPosition, contexts, pendingActions, actionHistory);

  const employeeDirectory = buildEmployeeDirectory(
    effectiveSeed.positions,
    effectiveSeed.employees,
    mergedControl.temporaryOoo,
    mergedControl.employeeSearch,
    now,
  );

  const financeRows = buildFinanceRows(
    effectiveSeed.positions,
    effectiveSeed.employees,
    mergedControl.financeSearch,
    mergedControl.financeSortBy,
    mergedControl.financeSortDirection,
  );

  const documentsRepository = buildDocumentsRepository(
    effectiveSeed.positions,
    effectiveSeed.employees,
    contexts,
    effectiveSeed.documents,
  );

  const policies = buildPolicyLibrary(
    effectiveSeed.policies,
    effectiveSeed.policyAcknowledgements,
    effectiveSeed.positions,
    effectiveSeed.employees,
  );

  const stats = {
    totalPositions: effectiveSeed.positions.length,
    filledPositions: effectiveSeed.positions.filter((position) => employeeForPosition(effectiveSeed.employees, position.id)).length,
    vacantPositions: effectiveSeed.positions.filter((position) => !employeeForPosition(effectiveSeed.employees, position.id)).length,
    employeesOnline: effectiveSeed.employees.filter((employee) => computeStatusDot(employee, mergedControl.temporaryOoo, now) === "green").length,
    openRisks: risks.length,
    openActions: pendingActions.length,
  };

  const signalSummary = {
    critical: risks.filter((risk) => risk.severity === "critical").length,
    warning: risks.filter((risk) => risk.severity === "warning").length,
  };

  const riskBreakdown = {
    missingDocuments: risks.filter((risk) => risk.trigger === "missing_document").length,
    expiredDocuments: risks.filter((risk) => risk.trigger === "expired_document").length,
    policyPending: risks.filter((risk) => risk.trigger === "policy_pending").length,
    vacantCriticalPositions: risks.filter((risk) => risk.trigger === "vacant_critical_position").length,
    onboardingIncomplete: risks.filter((risk) => risk.trigger === "onboarding_incomplete").length,
  };

  const auditTimeline = [...mergedControl.auditEvents].sort((a, b) => parseIso(b.timestamp) - parseIso(a.timestamp));

  return {
    selectedPosition,
    selectedEmployee,
    selectedProfile,
    positionDetail,
    orgTree,
    filteredOrgTree,
    matchedPositionIds: [...matchedPositionIds],
    focusPathIds: focusPathIdsArray,
    complianceView,
    risks,
    pendingActions,
    actionHistory,
    employeeDirectory,
    financeRows,
    documentsRepository,
    policies,
    auditTimeline,
    stats,
    signalSummary,
    riskBreakdown,
    emptyStates: buildEmptyStates(effectiveSeed),
  };
}

export function financeMatrix(rows: FinanceReportRow[]): string[][] {
  return [
    [
      "Employee ID",
      "Employee Name",
      "Position",
      "Department",
      "Manager",
      "Employment Status",
      "Salary",
      "Currency",
      "Bank Name",
      "Account Number",
      "IBAN",
      "Join Date",
    ],
    ...rows.map((row) => [
      row.employeeId,
      row.employeeName,
      row.position,
      row.department,
      row.manager,
      row.employmentStatus,
      String(row.salary),
      row.currency,
      row.bankName,
      row.accountNumber,
      row.iban,
      row.joinDate,
    ]),
  ];
}

export function isCompanyDocumentCategory(category: DocumentCategory): boolean {
  return REQUIRED_COMPANY_DOCUMENTS.includes(category);
}
