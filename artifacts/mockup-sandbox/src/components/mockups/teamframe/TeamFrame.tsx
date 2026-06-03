import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";

import { SEED, type Employee, type Position } from "../../../teamframe/data/seed";
import { type ActionItem as EngineAction, type ControlState, computeUIState } from "../../../teamframe/engine/compute";

const NAV_ITEMS = [
  { id: "org", label: "Organization Map" },
  { id: "actions", label: "Actions" },
  { id: "team", label: "Team" },
  { id: "policies", label: "Policies" },
  { id: "administration", label: "Administration" },
] as const;

const ACTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];
type ActionFilter = (typeof ACTION_FILTERS)[number]["id"];
type ActionStatus = "open" | "in_progress" | "completed";

type PositionRecord = {
  position: Position;
  employee: Employee | null;
};

type DepartmentNode = {
  id: string;
  name: string;
  executiveId: string | null;
  head: PositionRecord | null;
  members: PositionRecord[];
};

type ExecutiveNode = {
  executive: PositionRecord | null;
  label: string;
  departments: DepartmentNode[];
};

type ActionRuntime = {
  status: ActionStatus;
  ownerId: string;
  dueDate: string;
  comments: string[];
};

type ActionView = {
  action: EngineAction;
  position: Position | null;
  employee: Employee | null;
  manager: Employee | null;
  priority: "critical" | "high" | "normal" | "low";
  status: ActionStatus;
  ownerId: string;
  dueDate: string;
  comments: string[];
  isOverdue: boolean;
  isDueSoon: boolean;
};

type PolicyFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

type PolicyDocument = {
  id: string;
  name: string;
  folderId: string | null;
  uploadDate: string;
  lastUpdated?: string;
};

const THEME = {
  background: "#F7F9FC",
  panel: "#FFFFFF",
  panelSoft: "#F9FAFB",
  border: "#E5E7EB",
  textStrong: "#0F172A",
  textBody: "#1F2937",
  textMuted: "#64748B",
  accent: "#6366F1",
};

function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDueDate(dueIn: string): string {
  const match = dueIn.toLowerCase().match(/(\d+)\s+(day|days|week|weeks)/);
  if (!match) return toDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const amount = Number(match[1]);
  const days = match[2].startsWith("week") ? amount * 7 : amount;
  return toDateString(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

function actionPriority(action: EngineAction): "critical" | "high" | "normal" | "low" {
  return action.priority;
}

function priorityStyles(priority: ActionView["priority"]): { bg: string; text: string } {
  if (priority === "critical") return { bg: "rgba(239,68,68,0.14)", text: "#DC2626" };
  if (priority === "high") return { bg: "rgba(245,158,11,0.14)", text: "#D97706" };
  if (priority === "normal") return { bg: "rgba(99,102,241,0.14)", text: "#4F46E5" };
  return { bg: "rgba(148,163,184,0.14)", text: "#64748B" };
}

function statusForEmployee(employee: Employee | null): "filled" | "on_leave" | "offboarding" | "vacant" {
  if (!employee) return "vacant";
  if (employee.status === "on_leave") return "on_leave";
  if (employee.status === "offboarding") return "offboarding";
  return "filled";
}

function statusColor(status: ReturnType<typeof statusForEmployee>): string {
  if (status === "filled") return "#16A34A";
  if (status === "on_leave") return "#D97706";
  if (status === "offboarding") return "#DC2626";
  return "#64748B";
}

function statusLabel(status: ReturnType<typeof statusForEmployee>): string {
  if (status === "filled") return "Filled";
  if (status === "on_leave") return "On Leave";
  if (status === "offboarding") return "Offboarding";
  return "Vacant";
}

function completionPercent(employee: Employee | null): number {
  if (!employee) return 0;
  if (employee.onboardingStatus === "complete") return 100;
  if (employee.onboardingStatus === "in_progress") return 50;
  if (employee.onboardingStatus === "not_started") return 0;
  return 0;
}

function managerForPosition(position: Position | null): Employee | null {
  if (!position?.reportsToId) return null;
  return SEED.employees.find((employee) => employee.positionId === position.reportsToId) ?? null;
}

function rootAnchorId(position: Position, positionsById: Map<string, Position>): string | null {
  let cursor: Position | null = position;
  const seen = new Set<string>();

  while (cursor) {
    if (seen.has(cursor.id)) return null;
    seen.add(cursor.id);
    if (!cursor.reportsToId) return cursor.id;

    const parentPosition: Position | null = positionsById.get(cursor.reportsToId) ?? null;
    if (!parentPosition) return null;
    cursor = parentPosition;
  }

  return null;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((chunk) => chunk[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Avatar({ name, color, size = 30 }: { name: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(10, size * 0.35),
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: "default" | "good" | "warn" | "critical" }) {
  const toneStyles =
    tone === "good"
      ? { valueColor: "#16A34A", bg: "rgba(22,163,74,0.1)" }
      : tone === "warn"
      ? { valueColor: "#D97706", bg: "rgba(217,119,6,0.1)" }
      : tone === "critical"
      ? { valueColor: "#DC2626", bg: "rgba(220,38,38,0.1)" }
      : { valueColor: THEME.textStrong, bg: THEME.panel };

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${THEME.border}`,
        background: toneStyles.bg,
        padding: "8px 10px",
        minHeight: 60,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: THEME.textMuted,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: toneStyles.valueColor, lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

function FullProfileDrawer({ employeeId, onClose }: { employeeId: string | null; onClose: () => void }) {
  if (!employeeId) return null;
  const employee = SEED.employees.find((item) => item.id === employeeId);
  if (!employee) return null;
  const position = SEED.positions.find((item) => item.id === employee.positionId) ?? null;
  const manager = managerForPosition(position);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 410,
        background: THEME.panel,
        borderLeft: `1px solid ${THEME.border}`,
        boxShadow: "-12px 0 28px rgba(15,23,42,0.12)",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: `1px solid ${THEME.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: THEME.textStrong }}>Employee Profile</div>
          <div style={{ fontSize: 11, color: THEME.textMuted }}>Complete employee details</div>
        </div>
        <button
          onClick={onClose}
          style={{
            border: `1px solid ${THEME.border}`,
            borderRadius: 8,
            background: THEME.panelSoft,
            color: THEME.textBody,
            fontSize: 11,
            fontWeight: 700,
            padding: "6px 10px",
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>

      <div style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={employee.name} color={employee.avatarColor} size={40} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: THEME.textStrong }}>{employee.name}</div>
            <div style={{ fontSize: 12, color: THEME.textMuted }}>{position?.title ?? "Unknown Position"}</div>
          </div>
        </div>

        {[
          { label: "Employee Number", value: employee.id },
          { label: "Department", value: position?.department ?? "" },
          { label: "Manager", value: manager?.name ?? "" },
          { label: "Work Location", value: employee.location },
          { label: "Email", value: employee.email },
          { label: "Phone", value: employee.phone },
          { label: "Date of Joining", value: employee.startDate },
          { label: "Employment Status", value: employee.status.replace("_", " ") },
          { label: "Onboarding", value: employee.onboardingStatus.replace("_", " ") },
          { label: "Salary", value: employee.salary ? `$${employee.salary.toLocaleString()}` : "" },
          { label: "Bank Name", value: employee.bankName },
          { label: "IBAN", value: employee.bankAccount ?? "" },
          { label: "SWIFT / BIC", value: "" },
        ].map((item) => (
          <div key={item.label} style={{ border: `1px solid ${THEME.border}`, borderRadius: 10, padding: "10px 12px", background: THEME.panelSoft }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: THEME.textMuted }}>
              {item.label}
            </div>
            <div style={{ fontSize: 13, color: THEME.textBody, marginTop: 3 }}>{item.value || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState<NavId>("org");
  const [controlState, setControlState] = useState<ControlState>({
    scenarioId: "DEFAULT_VIEW",
    selectedPositionId: "1-001",
    selectedEmployeeId: "e-001",
    resolvedActions: [],
    positionEdits: [],
    onboardingCompleted: [],
    actionOverrides: {},
  });
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [actionRuntime, setActionRuntime] = useState<Record<string, ActionRuntime>>({});
  const [actionCommentDrafts, setActionCommentDrafts] = useState<Record<string, string>>({});
  const [teamSearch, setTeamSearch] = useState("");
  const [fullProfileEmployeeId, setFullProfileEmployeeId] = useState<string | null>(null);
  const [focusPathOnly, setFocusPathOnly] = useState(false);
  const [collapsedDepartmentIds, setCollapsedDepartmentIds] = useState<Set<string>>(new Set());

  const [policyFolders, setPolicyFolders] = useState<PolicyFolder[]>([
    { id: "folder-company", name: "Company Policies", parentId: null },
    { id: "folder-hr", name: "HR", parentId: "folder-company" },
    { id: "folder-security", name: "IT & Security", parentId: "folder-company" },
    { id: "folder-onboarding", name: "Onboarding", parentId: "folder-hr" },
  ]);
  const [policyDocuments, setPolicyDocuments] = useState<PolicyDocument[]>(
    SEED.compliance.map((item, index) => ({
      id: `doc-${index + 1}`,
      name: `${item.type}.pdf`,
      folderId:
        item.type.toLowerCase().includes("security") || item.type.toLowerCase().includes("privacy")
          ? "folder-security"
          : item.type.toLowerCase().includes("conduct")
          ? "folder-onboarding"
          : "folder-hr",
      uploadDate: toDateString(new Date(Date.now() - (index + 3) * 86400000)),
      lastUpdated: index % 2 === 0 ? toDateString(new Date(Date.now() - (index + 1) * 86400000)) : undefined,
    })),
  );
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>("folder-company");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>("folder-company");

  const uiState = useMemo(() => computeUIState(SEED, controlState), [controlState]);

  const positionMap = useMemo(() => new Map(SEED.positions.map((position) => [position.id, position])), []);
  const employeeByPositionMap = useMemo(
    () => new Map(SEED.employees.map((employee) => [employee.positionId, employee])),
    [],
  );

  const executives = useMemo(() => {
    const positions = [...SEED.positions].sort((a, b) => a.order - b.order);
    const executiveIds = new Set(positions.filter((position) => position.reportsToId === null).map((position) => position.id));
    const departments = [...new Set(positions.map((position) => position.department))].sort((a, b) => a.localeCompare(b));

    const departmentNodes: DepartmentNode[] = departments.map((departmentName) => {
      const records = positions
        .filter((position) => position.department === departmentName)
        .map((position) => ({
          position,
          employee: employeeByPositionMap.get(position.id) ?? null,
        }))
        .sort((left, right) => {
          if (left.position.level === right.position.level) return left.position.order - right.position.order;
          return left.position.level - right.position.level;
        });

      const head = records[0] ?? null;

      const executiveId = head?.position ? rootAnchorId(head.position, positionMap) : null;

      return {
        id: `dept-${departmentName.toLowerCase().replace(/\s+/g, "-")}-${executiveId ?? "unassigned"}`,
        name: departmentName,
        executiveId,
        head,
        members: records.slice(1),
      };
    });

    const grouped = new Map<string, DepartmentNode[]>();
    for (const node of departmentNodes) {
      const key = node.executiveId ?? "unassigned";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)?.push(node);
    }

    const executiveRows: ExecutiveNode[] = [...executiveIds]
      .sort((leftId, rightId) => {
        const left = positionMap.get(leftId);
        const right = positionMap.get(rightId);
        return (left?.order ?? 0) - (right?.order ?? 0);
      })
      .map((executiveId) => {
        const position = positionMap.get(executiveId) ?? null;
        return {
          executive: position
            ? {
                position,
                employee: employeeByPositionMap.get(position.id) ?? null,
              }
            : null,
          label: position?.title ?? "Executive",
          departments: (grouped.get(executiveId) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
        };
      });

    if ((grouped.get("unassigned") ?? []).length > 0) {
      executiveRows.push({
        executive: null,
        label: "Unassigned Root",
        departments: grouped.get("unassigned") ?? [],
      });
    }

    return executiveRows;
  }, [employeeByPositionMap, positionMap]);

  const departmentIds = useMemo(
    () => executives.flatMap((executive) => executive.departments.map((department) => department.id)),
    [executives],
  );

  const selectedPositionId = uiState.selectedPosition?.id ?? null;

  const selectedExecutiveAndDepartment = useMemo(() => {
    if (!selectedPositionId) return { executiveId: null as string | null, departmentId: null as string | null };
    for (const executive of executives) {
      for (const department of executive.departments) {
        const inDepartment =
          department.head?.position.id === selectedPositionId ||
          department.members.some((member) => member.position.id === selectedPositionId);
        if (inDepartment) {
          return {
            executiveId: executive.executive?.position.id ?? "unassigned-root",
            departmentId: department.id,
          };
        }
      }
    }
    return { executiveId: null as string | null, departmentId: null as string | null };
  }, [executives, selectedPositionId]);

  const actionViews = useMemo<ActionView[]>(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dueSoonThreshold = Date.now() + 48 * 60 * 60 * 1000;

    return uiState.actions
      .map((action) => {
        const position = positionMap.get(action.relatedPositionId) ?? null;
        const employee = employeeByPositionMap.get(action.relatedPositionId) ?? null;
        const manager = managerForPosition(position);
        const defaultOwner = employee?.id ?? manager?.id ?? "";
        const runtime = actionRuntime[action.id] ?? {
          status: action.status,
          ownerId: action.ownerId || defaultOwner,
          dueDate: action.dueDate,
          comments: action.comments ?? [],
        };
        const dueTime = runtime.dueDate ? new Date(runtime.dueDate).getTime() : Number.NaN;
        const isOverdue = runtime.status !== "completed" && Number.isFinite(dueTime) && dueTime < startOfToday.getTime();
        const isDueSoon =
          runtime.status !== "completed" &&
          Number.isFinite(dueTime) &&
          dueTime >= startOfToday.getTime() &&
          dueTime <= dueSoonThreshold;

        return {
          action,
          position,
          employee,
          manager,
          priority: actionPriority(action),
          status: runtime.status,
          ownerId: runtime.ownerId,
          dueDate: runtime.dueDate,
          comments: runtime.comments,
          isOverdue,
          isDueSoon,
        };
      })
      .sort((left, right) => {
        const leftRank = left.isOverdue ? 0 : left.isDueSoon ? 1 : left.priority === "critical" ? 2 : left.priority === "high" ? 3 : 4;
        const rightRank = right.isOverdue ? 0 : right.isDueSoon ? 1 : right.priority === "critical" ? 2 : right.priority === "high" ? 3 : 4;
        return leftRank - rightRank;
      });
  }, [actionRuntime, employeeByPositionMap, positionMap, uiState.actions]);

  const filteredActions = useMemo(
    () => actionViews.filter((action) => actionFilter === "all" || action.status === actionFilter),
    [actionFilter, actionViews],
  );

  const totalPositions = SEED.positions.length;
  const filledPositions = SEED.positions.filter((position) => employeeByPositionMap.has(position.id)).length;
  const vacantPositions = totalPositions - filledPositions;
  const criticalVacancies = SEED.positions.filter(
    (position) => position.isCriticalPosition && !employeeByPositionMap.has(position.id),
  ).length;
  const needsAttention = actionViews.filter((action) => action.isOverdue).length;
  const dueSoon = actionViews.filter((action) => action.isDueSoon).length;

  const teamRows = useMemo(
    () =>
      SEED.employees
        .map((employee) => {
          const position = positionMap.get(employee.positionId) ?? null;
          return {
            employee,
            position,
            completion: completionPercent(employee),
          };
        })
        .filter((row) => {
          const query = teamSearch.trim().toLowerCase();
          if (!query) return true;
          return (
            row.employee.name.toLowerCase().includes(query) ||
            row.employee.email.toLowerCase().includes(query) ||
            row.employee.phone.toLowerCase().includes(query) ||
            (row.position?.title.toLowerCase().includes(query) ?? false) ||
            (row.position?.department.toLowerCase().includes(query) ?? false)
          );
        }),
    [positionMap, teamSearch],
  );

  const selectedFolder = policyFolders.find((folder) => folder.id === selectedFolderId) ?? null;
  const childFolders = policyFolders.filter((folder) => folder.parentId === selectedFolderId);
  const visibleDocuments = policyDocuments.filter((document) => document.folderId === selectedFolderId);

  const selectedQuickRecord = selectedPositionId
    ? {
        position: positionMap.get(selectedPositionId) ?? null,
        employee: employeeByPositionMap.get(selectedPositionId) ?? null,
      }
    : { position: null, employee: null };

  const quickManager = managerForPosition(selectedQuickRecord.position);
  const quickCompletion = completionPercent(selectedQuickRecord.employee);

  const updateActionRuntime = (actionId: string, patch: Partial<ActionRuntime>) => {
    setActionRuntime((prev) => {
      const existing = prev[actionId] ?? {
        status: "open" as ActionStatus,
        ownerId: "",
        dueDate: parseDueDate("Due in 1 week"),
        comments: [],
      };
      return {
        ...prev,
        [actionId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const addActionComment = (actionId: string) => {
    const text = (actionCommentDrafts[actionId] ?? "").trim();
    if (!text) return;
    setActionRuntime((prev) => {
      const existing = prev[actionId] ?? {
        status: "open" as ActionStatus,
        ownerId: "",
        dueDate: parseDueDate("Due in 1 week"),
        comments: [],
      };
      return {
        ...prev,
        [actionId]: {
          ...existing,
          comments: [...existing.comments, text],
        },
      };
    });
    setActionCommentDrafts((prev) => ({ ...prev, [actionId]: "" }));
  };

  const selectPosition = (positionId: string) => {
    const employee = employeeByPositionMap.get(positionId) ?? null;
    setControlState((prev) => ({
      ...prev,
      selectedPositionId: positionId,
      selectedEmployeeId: employee?.id ?? null,
      scenarioId: "DEFAULT_VIEW",
    }));
  };

  const downloadPayrollReport = () => {
    const headers = [
      "Employee Number",
      "Full Name",
      "Date of Joining",
      "Position",
      "Department",
      "Location",
      "Salary Breakdown",
      "Basic",
      "Allowances",
      "Bonuses",
      "Deductions",
      "Currency",
      "Bank Name",
      "IBAN",
      "SWIFT / BIC",
    ];

    const rows = SEED.employees.map((employee) => {
      const position = positionMap.get(employee.positionId) ?? null;
      const salaryBreakdown = {
        basic: employee.salary ?? null,
        allowances: null,
        bonuses: null,
        deductions: null,
        currency: null,
      };
      return [
        employee.id ?? "",
        employee.name ?? "",
        employee.startDate ?? "",
        position?.title ?? "",
        position?.department ?? "",
        employee.location ?? "",
        JSON.stringify(salaryBreakdown),
        salaryBreakdown.basic,
        salaryBreakdown.allowances,
        salaryBreakdown.bonuses,
        salaryBreakdown.deductions,
        salaryBreakdown.currency,
        employee.bankName ?? "",
        employee.bankAccount ?? "",
        "",
      ];
    });

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `payroll-report-${toDateString(new Date())}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  };

  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    setPolicyFolders((prev) => [
      ...prev,
      {
        id: createId("folder"),
        name,
        parentId: newFolderParentId,
      },
    ]);
    setNewFolderName("");
  };

  const uploadPolicyFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const now = toDateString(new Date());
    const newDocs = Array.from(files).map((file) => ({
      id: createId("doc"),
      name: file.name,
      folderId: selectedFolderId,
      uploadDate: now,
      lastUpdated: now,
    }));
    setPolicyDocuments((prev) => [...prev, ...newDocs]);
    event.target.value = "";
  };

  const folderPath = useMemo(() => {
    if (!selectedFolder) return "All folders";
    const path: string[] = [selectedFolder.name];
    let cursor = selectedFolder;
    while (cursor.parentId) {
      const parent = policyFolders.find((folder) => folder.id === cursor.parentId) ?? null;
      if (!parent) break;
      path.unshift(parent.name);
      cursor = parent;
    }
    return path.join(" / ");
  }, [policyFolders, selectedFolder]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: THEME.background,
        color: THEME.textBody,
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: THEME.panel,
          borderRight: `1px solid ${THEME.border}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "15px 14px", borderBottom: `1px solid ${THEME.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              T
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: THEME.textStrong }}>TeamFrame V2</div>
          </div>
        </div>

        <nav style={{ padding: "8px 0", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "11px 14px",
                  border: "none",
                  borderLeft: `2px solid ${active ? THEME.accent : "transparent"}`,
                  background: active ? "rgba(99,102,241,0.09)" : "transparent",
                  color: active ? "#4338CA" : THEME.textMuted,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header
          style={{
            height: 56,
            flexShrink: 0,
            background: THEME.panel,
            borderBottom: `1px solid ${THEME.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 800, color: THEME.textStrong }}>
            {activeNav === "org"
              ? "Organization Map"
              : activeNav === "actions"
              ? "Actions"
              : activeNav === "team"
              ? "Team"
              : activeNav === "policies"
              ? "Policies"
              : "Administration"}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={downloadPayrollReport}
              style={{
                border: `1px solid rgba(99,102,241,0.35)`,
                borderRadius: 8,
                background: "rgba(99,102,241,0.08)",
                color: "#4338CA",
                fontSize: 11,
                fontWeight: 700,
                padding: "7px 10px",
                cursor: "pointer",
              }}
            >
              Download Payroll Report
            </button>
          </div>
        </header>

        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeNav === "org" && (
            <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ background: THEME.panel, borderBottom: `1px solid ${THEME.border}`, padding: "10px 14px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(120px, 1fr))", gap: 8 }}>
                  <KpiCard label="Total Positions" value={totalPositions} tone="default" />
                  <KpiCard label="Filled Positions" value={filledPositions} tone="good" />
                  <KpiCard label="Vacant Positions" value={vacantPositions} tone="warn" />
                  <KpiCard label="Critical Vacancies" value={criticalVacancies} tone="critical" />
                  <KpiCard label="Needs Attention" value={needsAttention} tone={needsAttention ? "critical" : "default"} />
                  <KpiCard label="Due Soon" value={dueSoon} tone={dueSoon ? "warn" : "default"} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => setCollapsedDepartmentIds(new Set(departmentIds))}
                    style={{
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 8,
                      background: THEME.panelSoft,
                      color: THEME.textBody,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "5px 9px",
                      cursor: "pointer",
                    }}
                  >
                    Collapse All
                  </button>
                  <button
                    onClick={() => setCollapsedDepartmentIds(new Set())}
                    style={{
                      border: `1px solid ${THEME.border}`,
                      borderRadius: 8,
                      background: THEME.panelSoft,
                      color: THEME.textBody,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "5px 9px",
                      cursor: "pointer",
                    }}
                  >
                    Expand All
                  </button>
                  <button
                    onClick={() => setFocusPathOnly((prev) => !prev)}
                    style={{
                      border: `1px solid ${focusPathOnly ? "rgba(99,102,241,0.35)" : THEME.border}`,
                      borderRadius: 8,
                      background: focusPathOnly ? "rgba(99,102,241,0.09)" : THEME.panelSoft,
                      color: focusPathOnly ? "#4338CA" : THEME.textBody,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "5px 9px",
                      cursor: "pointer",
                    }}
                  >
                    Focus Path
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, overflow: "auto", padding: "14px", paddingRight: 400 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  {executives.map((executive) => {
                    const executiveKey = executive.executive?.position.id ?? executive.label;
                    const executiveDimmed =
                      focusPathOnly &&
                      selectedExecutiveAndDepartment.executiveId !== null &&
                      selectedExecutiveAndDepartment.executiveId !== executiveKey;

                    return (
                      <div
                        key={executiveKey}
                        style={{
                          minWidth: 270,
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                          opacity: executiveDimmed ? 0.35 : 1,
                        }}
                      >
                        <div
                          style={{
                            border: `1px solid ${THEME.border}`,
                            borderRadius: 10,
                            background: THEME.panel,
                            padding: "10px 11px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                              color: THEME.textMuted,
                            }}
                          >
                            Executive
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: THEME.textStrong, marginTop: 4 }}>
                            {executive.executive?.position.title ?? executive.label}
                          </div>
                          <div style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>
                            {executive.executive?.employee?.name ?? "Flexible reporting"}
                          </div>
                        </div>

                        {executive.departments.map((department) => {
                          const collapsed = collapsedDepartmentIds.has(department.id);
                          const departmentSelected = selectedExecutiveAndDepartment.departmentId === department.id;
                          const departmentDimmed =
                            focusPathOnly &&
                            selectedExecutiveAndDepartment.departmentId !== null &&
                            !departmentSelected;

                          return (
                            <div
                              key={department.id}
                              style={{
                                border: `1px solid ${departmentSelected ? "rgba(99,102,241,0.45)" : THEME.border}`,
                                borderRadius: 10,
                                background: THEME.panel,
                                padding: "10px",
                                boxShadow: departmentSelected ? "0 0 0 2px rgba(99,102,241,0.12)" : "none",
                                opacity: departmentDimmed ? 0.3 : 1,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                <div>
                                  <div
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      textTransform: "uppercase",
                                      letterSpacing: "0.06em",
                                      color: THEME.textMuted,
                                    }}
                                  >
                                    Department
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: THEME.textStrong }}>{department.name}</div>
                                </div>
                                <button
                                  onClick={() =>
                                    setCollapsedDepartmentIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(department.id)) next.delete(department.id);
                                      else next.add(department.id);
                                      return next;
                                    })
                                  }
                                  style={{
                                    border: `1px solid ${THEME.border}`,
                                    borderRadius: 999,
                                    background: THEME.panelSoft,
                                    color: THEME.textMuted,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 8px",
                                    cursor: "pointer",
                                  }}
                                >
                                  {collapsed ? "Expand" : "Collapse"}
                                </button>
                              </div>

                              {!collapsed && (
                                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                                  <div>
                                    <div style={{ fontSize: 10, color: THEME.textMuted, marginBottom: 4 }}>Department Head</div>
                                    {department.head ? (
                                      <button
                                        onClick={() => selectPosition(department.head?.position.id ?? "")}
                                        style={{
                                          width: "100%",
                                          textAlign: "left",
                                          border: `1px solid ${selectedPositionId === department.head.position.id ? "rgba(99,102,241,0.45)" : THEME.border}`,
                                          borderRadius: 9,
                                          background:
                                            selectedPositionId === department.head.position.id
                                              ? "rgba(99,102,241,0.09)"
                                              : THEME.panelSoft,
                                          padding: "8px 9px",
                                          cursor: "pointer",
                                        }}
                                      >
                                        <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textStrong }}>
                                          {department.head.position.title}
                                        </div>
                                        <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                                          {department.head.employee?.name ?? "Vacant"}
                                        </div>
                                      </button>
                                    ) : (
                                      <div style={{ fontSize: 11, color: THEME.textMuted }}>No department head assigned</div>
                                    )}
                                  </div>

                                  <div>
                                    <div style={{ fontSize: 10, color: THEME.textMuted, marginBottom: 4 }}>Teams / Employees</div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                      {department.members.map((member) => {
                                        const nodeSelected = selectedPositionId === member.position.id;
                                        const nodeDimmed = focusPathOnly && selectedPositionId !== null && !nodeSelected;
                                        const status = statusForEmployee(member.employee);
                                        return (
                                          <button
                                            key={member.position.id}
                                            onClick={() => selectPosition(member.position.id)}
                                            style={{
                                              textAlign: "left",
                                              border: `1px solid ${nodeSelected ? "rgba(99,102,241,0.45)" : THEME.border}`,
                                              borderRadius: 8,
                                              background: nodeSelected ? "rgba(99,102,241,0.08)" : THEME.panel,
                                              padding: "7px 8px",
                                              cursor: "pointer",
                                              opacity: nodeDimmed ? 0.45 : 1,
                                            }}
                                          >
                                            <div style={{ fontSize: 12, fontWeight: 700, color: THEME.textStrong }}>
                                              {member.position.title}
                                            </div>
                                            <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 1 }}>
                                              {member.employee?.name ?? "Vacant"}
                                            </div>
                                            <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6 }}>
                                              <span
                                                style={{
                                                  width: 7,
                                                  height: 7,
                                                  borderRadius: "50%",
                                                  background: statusColor(status),
                                                  display: "inline-block",
                                                }}
                                              />
                                              <span style={{ fontSize: 10, color: THEME.textMuted }}>{statusLabel(status)}</span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                      {department.members.length === 0 && (
                                        <div style={{ fontSize: 11, color: THEME.textMuted }}>No team members listed</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {collapsed && (
                                <div style={{ fontSize: 10, color: THEME.textMuted, marginTop: 8 }}>
                                  {department.members.length + (department.head ? 1 : 0)} role(s) hidden
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                style={{
                  position: "absolute",
                  top: 98,
                  right: 12,
                  bottom: 12,
                  width: 360,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 12,
                  background: THEME.panel,
                  overflowY: "auto",
                }}
              >
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${THEME.border}` }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: THEME.textStrong }}>Quick Inspection</div>
                  <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>Org chart node details</div>
                </div>

                {selectedQuickRecord.position ? (
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { label: "Full Name", value: selectedQuickRecord.employee?.name ?? "Vacant" },
                      { label: "Position / Role", value: selectedQuickRecord.position.title },
                      { label: "Department", value: selectedQuickRecord.position.department },
                      { label: "Reporting Manager", value: quickManager?.name ?? "" },
                      { label: "Work Location", value: selectedQuickRecord.employee?.location ?? "" },
                      { label: "Email", value: selectedQuickRecord.employee?.email ?? "" },
                      { label: "Phone", value: selectedQuickRecord.employee?.phone ?? "" },
                      {
                        label: "Employment Status",
                        value: selectedQuickRecord.employee?.status.replace("_", " ") ?? "",
                      },
                      { label: "Completion %", value: `${quickCompletion}%` },
                    ].map((item) => (
                      <div key={item.label} style={{ border: `1px solid ${THEME.border}`, borderRadius: 10, background: THEME.panelSoft, padding: "9px 10px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: THEME.textMuted }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: 13, color: THEME.textBody, marginTop: 3 }}>{item.value || "—"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: 18, color: THEME.textMuted, fontSize: 12 }}>Select a role in the map.</div>
                )}
              </div>
            </div>
          )}

          {activeNav === "actions" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ borderRadius: 999, border: `1px solid ${THEME.border}`, background: THEME.panel, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#DC2626" }}>
                  Overdue {needsAttention}
                </div>
                <div style={{ borderRadius: 999, border: `1px solid ${THEME.border}`, background: THEME.panel, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#D97706" }}>
                  Due Soon {dueSoon}
                </div>
                <div style={{ borderRadius: 999, border: `1px solid ${THEME.border}`, background: THEME.panel, padding: "4px 10px", fontSize: 11, fontWeight: 700, color: "#4338CA" }}>
                  Open {actionViews.filter((action) => action.status !== "completed").length}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                {ACTION_FILTERS.map((filter) => {
                  const active = actionFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setActionFilter(filter.id)}
                      style={{
                        border: `1px solid ${active ? "rgba(99,102,241,0.35)" : THEME.border}`,
                        borderRadius: 8,
                        background: active ? "rgba(99,102,241,0.08)" : THEME.panel,
                        color: active ? "#4338CA" : THEME.textBody,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
                {filteredActions.map((item) => {
                  const priority = priorityStyles(item.priority);
                  const rowBorder = item.isOverdue ? "rgba(220,38,38,0.35)" : item.isDueSoon ? "rgba(217,119,6,0.35)" : THEME.border;
                  const ownerLabel = SEED.employees.find((employee) => employee.id === item.ownerId)?.name ?? item.manager?.name ?? "Unassigned";
                  return (
                    <div key={item.action.id} style={{ border: `1px solid ${rowBorder}`, borderRadius: 10, background: THEME.panel, padding: "10px 11px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) 110px 140px 170px 120px", gap: 10, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textStrong }}>{item.action.title}</div>
                          <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
                            {item.position?.title ?? "Unknown Position"} · {item.position?.department ?? ""}
                          </div>
                        </div>
                        <span style={{ width: "fit-content", padding: "3px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, color: priority.text, background: priority.bg }}>
                          {item.priority}
                        </span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: item.isOverdue ? "#DC2626" : item.isDueSoon ? "#D97706" : THEME.textBody }}>
                          {formatDateLabel(item.dueDate)}
                        </div>
                        <div style={{ fontSize: 11, color: THEME.textBody }}>{ownerLabel}</div>
                        <div style={{ fontSize: 11, color: THEME.textBody, fontWeight: 700 }}>
                          {item.status === "in_progress" ? "In Progress" : item.status === "completed" ? "Completed" : "Open"}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "auto auto 180px 150px 1fr auto", gap: 6, marginTop: 8, alignItems: "center" }}>
                        <button
                          onClick={() =>
                            updateActionRuntime(item.action.id, {
                              status: item.status === "completed" ? "open" : "completed",
                            })
                          }
                          style={actionButtonStyle("success")}
                        >
                          {item.status === "completed" ? "Reopen" : "Complete"}
                        </button>
                        <button
                          onClick={() => updateActionRuntime(item.action.id, { status: "in_progress" })}
                          style={actionButtonStyle("primary")}
                        >
                          In Progress
                        </button>
                        <select
                          value={item.ownerId}
                          onChange={(event) => updateActionRuntime(item.action.id, { ownerId: event.target.value })}
                          style={inputStyle()}
                        >
                          <option value="">Unassigned</option>
                          {SEED.employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={item.dueDate}
                          onChange={(event) => updateActionRuntime(item.action.id, { dueDate: event.target.value })}
                          style={inputStyle()}
                        />
                        <input
                          value={actionCommentDrafts[item.action.id] ?? ""}
                          onChange={(event) =>
                            setActionCommentDrafts((prev) => ({
                              ...prev,
                              [item.action.id]: event.target.value,
                            }))
                          }
                          placeholder="Add comment"
                          style={inputStyle()}
                        />
                        <button onClick={() => addActionComment(item.action.id)} style={actionButtonStyle("default")}>
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredActions.length === 0 && (
                  <div style={{ marginTop: 40, textAlign: "center", color: THEME.textMuted, fontSize: 13 }}>No actions in this view.</div>
                )}
              </div>
            </div>
          )}

          {activeNav === "team" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "12px 14px", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 380,
                    border: `1px solid ${THEME.border}`,
                    borderRadius: 8,
                    background: THEME.panel,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 9px",
                  }}
                >
                  <span style={{ fontSize: 11, color: THEME.textMuted }}>Search</span>
                  <input
                    value={teamSearch}
                    onChange={(event) => setTeamSearch(event.target.value)}
                    placeholder="Name, position, department, email"
                    style={{ border: "none", background: "transparent", outline: "none", color: THEME.textBody, width: "100%", fontSize: 12 }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", border: `1px solid ${THEME.border}`, borderRadius: 10, background: THEME.panel }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(180px,2fr) minmax(160px,1.4fr) minmax(140px,1.2fr) minmax(140px,1fr) minmax(130px,1fr) minmax(220px,1.8fr) 110px",
                    gap: 10,
                    padding: "10px 12px",
                    borderBottom: `1px solid ${THEME.border}`,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: THEME.textMuted,
                  }}
                >
                  <span>Name</span>
                  <span>Position</span>
                  <span>Department</span>
                  <span>Work Location</span>
                  <span>Phone</span>
                  <span>Email</span>
                  <span>Completion %</span>
                </div>

                {teamRows.map((row) => (
                  <button
                    key={row.employee.id}
                    onClick={() => setFullProfileEmployeeId(row.employee.id)}
                    style={{
                      width: "100%",
                      border: "none",
                      borderBottom: `1px solid ${THEME.border}`,
                      background: "transparent",
                      textAlign: "left",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(180px,2fr) minmax(160px,1.4fr) minmax(140px,1.2fr) minmax(140px,1fr) minmax(130px,1fr) minmax(220px,1.8fr) 110px",
                        gap: 10,
                        padding: "10px 12px",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: THEME.textStrong }}>{row.employee.name}</span>
                      <span style={{ fontSize: 12, color: THEME.textBody }}>{row.position?.title ?? ""}</span>
                      <span style={{ fontSize: 12, color: THEME.textBody }}>{row.position?.department ?? ""}</span>
                      <span style={{ fontSize: 12, color: THEME.textBody }}>{row.employee.location}</span>
                      <span style={{ fontSize: 12, color: THEME.textBody }}>{row.employee.phone}</span>
                      <span style={{ fontSize: 12, color: THEME.textBody }}>{row.employee.email}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: row.completion < 70 ? "#D97706" : "#16A34A" }}>
                        {row.completion}%
                      </span>
                    </div>
                  </button>
                ))}

                {teamRows.length === 0 && (
                  <div style={{ padding: 22, textAlign: "center", fontSize: 12, color: THEME.textMuted }}>
                    No team members match this search.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeNav === "policies" && (
            <div style={{ height: "100%", display: "flex", padding: 12, gap: 10 }}>
              <div
                style={{
                  width: 260,
                  flexShrink: 0,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 10,
                  background: THEME.panel,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${THEME.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textStrong }}>Folders</div>
                </div>

                <div style={{ padding: "8px 10px", overflowY: "auto", flex: 1 }}>
                  <button
                    onClick={() => setSelectedFolderId(null)}
                    style={folderButtonStyle(selectedFolderId === null)}
                  >
                    All Documents
                  </button>
                  {renderFolderTree(policyFolders, selectedFolderId, setSelectedFolderId, null, 0)}
                </div>
              </div>

              <div
                style={{
                  flex: 1,
                  border: `1px solid ${THEME.border}`,
                  borderRadius: 10,
                  background: THEME.panel,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${THEME.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: THEME.textStrong }}>{folderPath}</div>
                  <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>Folder-based policy explorer</div>
                </div>

                <div style={{ padding: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderBottom: `1px solid ${THEME.border}` }}>
                  <div style={{ border: `1px solid ${THEME.border}`, borderRadius: 10, background: THEME.panelSoft, padding: "10px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: THEME.textMuted, marginBottom: 6 }}>
                      Create Folder
                    </div>
                    <input
                      value={newFolderName}
                      onChange={(event) => setNewFolderName(event.target.value)}
                      placeholder="Folder name"
                      style={inputStyle()}
                    />
                    <select
                      value={newFolderParentId ?? ""}
                      onChange={(event) => setNewFolderParentId(event.target.value || null)}
                      style={{ ...inputStyle(), marginTop: 6 }}
                    >
                      <option value="">Top Level</option>
                      {policyFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                    <button onClick={createFolder} style={{ ...actionButtonStyle("primary"), marginTop: 8 }}>
                      Create Folder
                    </button>
                  </div>

                  <div style={{ border: `1px solid ${THEME.border}`, borderRadius: 10, background: THEME.panelSoft, padding: "10px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: THEME.textMuted, marginBottom: 6 }}>
                      Upload Documents
                    </div>
                    <input type="file" multiple onChange={uploadPolicyFiles} style={{ fontSize: 12 }} />
                    <div style={{ fontSize: 11, color: THEME.textMuted, marginTop: 8 }}>
                      Upload target: {selectedFolder?.name ?? "All Documents"}
                    </div>
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {childFolders.map((folder) => (
                    <div
                      key={folder.id}
                      style={{
                        border: `1px solid ${THEME.border}`,
                        borderRadius: 9,
                        background: THEME.panelSoft,
                        padding: "9px 10px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textStrong }}>{folder.name}</div>
                        <div style={{ fontSize: 11, color: THEME.textMuted }}>Folder</div>
                      </div>
                      <button onClick={() => setSelectedFolderId(folder.id)} style={actionButtonStyle("default")}>
                        Open
                      </button>
                    </div>
                  ))}

                  {visibleDocuments.map((document) => (
                    <div
                      key={document.id}
                      style={{
                        border: `1px solid ${THEME.border}`,
                        borderRadius: 9,
                        background: THEME.panel,
                        padding: "9px 10px",
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto",
                        gap: 10,
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: THEME.textStrong }}>{document.name}</div>
                        <div style={{ fontSize: 11, color: THEME.textMuted }}>Upload Date: {document.uploadDate}</div>
                      </div>
                      <div style={{ fontSize: 11, color: THEME.textMuted }}>
                        Last Updated: {document.lastUpdated ?? "—"}
                      </div>
                    </div>
                  ))}

                  {childFolders.length === 0 && visibleDocuments.length === 0 && (
                    <div
                      style={{
                        border: `1px dashed ${THEME.border}`,
                        borderRadius: 10,
                        padding: "20px",
                        textAlign: "center",
                        color: THEME.textMuted,
                        fontSize: 12,
                        background: THEME.panelSoft,
                      }}
                    >
                      No folders or documents here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeNav === "administration" && (
            <div style={{ height: "100%", padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                <div style={adminCardStyle()}>
                  <div style={adminTitleStyle()}>Download Payroll Report</div>
                  <div style={adminBodyStyle()}>Generate CSV export from employee and organization data.</div>
                  <button onClick={downloadPayrollReport} style={{ ...actionButtonStyle("primary"), marginTop: 8 }}>
                    Download Report
                  </button>
                </div>
                <div style={adminCardStyle()}>
                  <div style={adminTitleStyle()}>Data Import</div>
                  <div style={adminBodyStyle()}>Use upload tools for operational records.</div>
                </div>
                <div style={adminCardStyle()}>
                  <div style={adminTitleStyle()}>Audit Trail</div>
                  <div style={adminBodyStyle()}>Recent changes and activity logs.</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <FullProfileDrawer employeeId={fullProfileEmployeeId} onClose={() => setFullProfileEmployeeId(null)} />
    </div>
  );
}

function formatDateLabel(dateValue: string): string {
  if (!dateValue) return "No date";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function actionButtonStyle(tone: "primary" | "success" | "default") {
  if (tone === "primary") {
    return {
      border: "1px solid rgba(99,102,241,0.32)",
      borderRadius: 7,
      background: "rgba(99,102,241,0.1)",
      color: "#4338CA",
      fontSize: 10,
      fontWeight: 700,
      padding: "5px 8px",
      cursor: "pointer",
    } as const;
  }
  if (tone === "success") {
    return {
      border: "1px solid rgba(22,163,74,0.32)",
      borderRadius: 7,
      background: "rgba(22,163,74,0.1)",
      color: "#15803D",
      fontSize: 10,
      fontWeight: 700,
      padding: "5px 8px",
      cursor: "pointer",
    } as const;
  }
  return {
    border: "1px solid #E5E7EB",
    borderRadius: 7,
    background: "#FFFFFF",
    color: "#1F2937",
    fontSize: 10,
    fontWeight: 700,
    padding: "5px 8px",
    cursor: "pointer",
  } as const;
}

function inputStyle() {
  return {
    border: "1px solid #E5E7EB",
    borderRadius: 7,
    background: "#FFFFFF",
    color: "#1F2937",
    fontSize: 11,
    padding: "6px 8px",
    width: "100%",
    boxSizing: "border-box" as const,
    outline: "none",
  };
}

function folderButtonStyle(active: boolean) {
  return {
    width: "100%",
    textAlign: "left" as const,
    border: `1px solid ${active ? "rgba(99,102,241,0.35)" : "#E5E7EB"}`,
    borderRadius: 8,
    background: active ? "rgba(99,102,241,0.08)" : "#FFFFFF",
    color: active ? "#4338CA" : "#1F2937",
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    padding: "6px 8px",
    cursor: "pointer",
    marginBottom: 5,
  };
}

function renderFolderTree(
  folders: PolicyFolder[],
  selectedFolderId: string | null,
  setSelectedFolderId: (id: string) => void,
  parentId: string | null,
  depth: number,
): ReactNode[] {
  return folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((folder) => {
      const current = (
        <div key={folder.id} style={{ marginLeft: depth * 10 }}>
          <button onClick={() => setSelectedFolderId(folder.id)} style={folderButtonStyle(selectedFolderId === folder.id)}>
            {folder.name}
          </button>
        </div>
      );
      const nested = renderFolderTree(folders, selectedFolderId, setSelectedFolderId, folder.id, depth + 1);
      return [current, ...nested];
    });
}

function adminCardStyle() {
  return {
    border: "1px solid #E5E7EB",
    borderRadius: 10,
    background: "#FFFFFF",
    padding: 12,
  };
}

function adminTitleStyle() {
  return {
    fontSize: 13,
    fontWeight: 800,
    color: "#0F172A",
  };
}

function adminBodyStyle() {
  return {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
  };
}
