import { useMemo, useState, type ReactNode } from "react";
import { SEED, type Employee, type Position } from "../../../teamframe/data/seed";
import { type ActionItem, type ControlState, type OrgNode, computeUIState } from "../../../teamframe/engine/compute";

const NAV_ITEMS = [
  { id: "org", label: "Organization Map" },
  { id: "actions", label: "Actions" },
  { id: "people", label: "People" },
  { id: "policies", label: "Policies" },
  { id: "finance", label: "Finance" },
  { id: "administration", label: "Administration" },
] as const;

const ACTION_FILTERS = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];
type ActionStatus = "open" | "in_progress" | "completed";
type ActionFilter = (typeof ACTION_FILTERS)[number]["id"];

type ActionOverride = {
  status?: ActionStatus;
  ownerId?: string;
  dueDate?: string;
  comments?: string[];
};

type ActionView = {
  action: ActionItem;
  position: Position | null;
  employee: Employee | null;
  manager: Employee | null;
  status: ActionStatus;
  ownerId: string;
  dueDate: string;
  comments: string[];
  priority: "critical" | "high" | "normal" | "low";
  isOverdue: boolean;
  isDueSoon: boolean;
};

function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        fontSize: size * 0.34,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function statusForEmployee(employee: Employee | null): "filled" | "on_leave" | "offboarding" | "vacant" {
  if (!employee) return "vacant";
  if (employee.status === "on_leave") return "on_leave";
  if (employee.status === "offboarding") return "offboarding";
  return "filled";
}

function statusLabel(status: ReturnType<typeof statusForEmployee>) {
  if (status === "filled") return "Filled";
  if (status === "on_leave") return "On Leave";
  if (status === "offboarding") return "Offboarding";
  return "Vacant";
}

function statusColor(status: ReturnType<typeof statusForEmployee>) {
  if (status === "filled") return "#22c55e";
  if (status === "on_leave") return "#f59e0b";
  if (status === "offboarding") return "#ef4444";
  return "#64748b";
}

function managerForPosition(position: Position | null): Employee | null {
  if (!position?.reportsToId) return null;
  return SEED.employees.find((employee) => employee.positionId === position.reportsToId) ?? null;
}

function priorityForAction(action: ActionItem): ActionView["priority"] {
  return action.priority;
}

function priorityStyle(priority: ActionView["priority"]) {
  if (priority === "critical") return { bg: "rgba(239,68,68,0.16)", text: "#ef4444" };
  if (priority === "high") return { bg: "rgba(245,158,11,0.16)", text: "#f59e0b" };
  if (priority === "normal") return { bg: "rgba(99,102,241,0.16)", text: "#818cf8" };
  return { bg: "rgba(148,163,184,0.16)", text: "#94a3b8" };
}

function dueInToDateValue(dueIn: string): string {
  const match = dueIn.toLowerCase().match(/(\d+)\s+(day|days|week|weeks)/);
  const now = Date.now();
  if (!match) {
    return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  const amount = Number(match[1]);
  const days = match[2].startsWith("week") ? amount * 7 : amount;
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatDueDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ownerName(actionView: ActionView) {
  if (actionView.ownerId === "manager") {
    return actionView.manager?.name ?? "Manager";
  }
  return SEED.employees.find((employee) => employee.id === actionView.ownerId)?.name ?? "Manager";
}

function collectCollapsibleIds(nodes: OrgNode[]): string[] {
  const ids: string[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (current.children.length > 0) {
      ids.push(current.position.id);
      stack.push(...current.children);
    }
  }
  return ids;
}

function buildPathSet(selectedPositionId: string | null): Set<string> {
  const path = new Set<string>();
  let current = selectedPositionId;
  while (current) {
    path.add(current);
    const position = SEED.positions.find((item) => item.id === current);
    current = position?.reportsToId ?? null;
  }
  return path;
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "good" | "warn" | "critical";
}) {
  const colors = {
    default: { value: "#f8fafc", bg: "rgba(255,255,255,0.03)" },
    good: { value: "#22c55e", bg: "rgba(34,197,94,0.12)" },
    warn: { value: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    critical: { value: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
  const toneColor = colors[tone];
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.08)",
        background: toneColor.bg,
        padding: "8px 10px",
        minHeight: 56,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>{label}</div>
      <div style={{ fontSize: 20, lineHeight: 1.15, fontWeight: 800, color: toneColor.value }}>{value}</div>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function OrgTree({
  nodes,
  selectedPositionId,
  onSelectPosition,
  collapsedIds,
  onToggleCollapse,
  focusPathOnly,
  pathSet,
}: {
  nodes: OrgNode[];
  selectedPositionId: string | null;
  onSelectPosition: (id: string) => void;
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  focusPathOnly: boolean;
  pathSet: Set<string>;
}) {
  if (nodes.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 28 }}>
      {nodes.map((node) => {
        const isSelected = node.position.id === selectedPositionId;
        const isCollapsed = collapsedIds.has(node.position.id);
        const inPath = pathSet.has(node.position.id);
        const muted = focusPathOnly && !inPath;
        const employee = node.employee;
        const nodeStatus = statusForEmployee(employee);

        return (
          <div key={node.position.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 200 }}>
            <button
              onClick={() => onSelectPosition(node.position.id)}
              style={{
                width: 200,
                textAlign: "left",
                borderRadius: 12,
                border: `1px solid ${isSelected ? "rgba(99,102,241,0.95)" : "rgba(255,255,255,0.08)"}`,
                background: isSelected ? "rgba(99,102,241,0.2)" : "rgba(15,23,42,0.92)",
                boxShadow: isSelected ? "0 0 0 2px rgba(99,102,241,0.32), 0 10px 20px rgba(0,0,0,0.24)" : "none",
                color: "#e2e8f0",
                cursor: "pointer",
                padding: "10px 12px",
                opacity: muted ? 0.35 : 1,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                  {node.position.title}
                </span>
                {node.children.length > 0 && (
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleCollapse(node.position.id);
                    }}
                    style={{
                      fontSize: 10,
                      color: "#94a3b8",
                      border: "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 999,
                      padding: "1px 7px",
                    }}
                  >
                    {isCollapsed ? "Expand" : "Collapse"}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: employee ? "#cbd5e1" : "#94a3b8", marginBottom: 7 }}>{employee?.name ?? "Vacant"}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#94a3b8" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(nodeStatus), display: "inline-block" }} />
                  {statusLabel(nodeStatus)}
                </span>
                <span style={{ color: "#64748b" }}>{node.children.length} reports</span>
              </div>
            </button>

            {node.children.length > 0 && isCollapsed && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  color: "#94a3b8",
                  borderRadius: 999,
                  border: "1px dashed rgba(255,255,255,0.2)",
                  padding: "3px 8px",
                }}
              >
                +{node.children.length} hidden
              </div>
            )}

            {node.children.length > 0 && !isCollapsed && (
              <>
                <div style={{ width: 2, height: 16, background: "rgba(255,255,255,0.12)" }} />
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 16, paddingLeft: 10, paddingRight: 10 }}>
                  <OrgTree
                    nodes={node.children}
                    selectedPositionId={selectedPositionId}
                    onSelectPosition={onSelectPosition}
                    collapsedIds={collapsedIds}
                    onToggleCollapse={onToggleCollapse}
                    focusPathOnly={focusPathOnly}
                    pathSet={pathSet}
                  />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PositionPanel({
  selectedPosition,
  selectedEmployee,
  directReports,
  positionActions,
  onSelectPosition,
  onUpdateAction,
  onAddComment,
}: {
  selectedPosition: Position | null;
  selectedEmployee: Employee | null;
  directReports: { position: Position; employee: Employee | null }[];
  positionActions: ActionView[];
  onSelectPosition: (id: string) => void;
  onUpdateAction: (id: string, patch: ActionOverride) => void;
  onAddComment: (id: string, comment: string) => void;
}) {
  if (!selectedPosition) {
    return <div style={{ padding: 24, color: "#94a3b8", fontSize: 13 }}>Select a position</div>;
  }

  const manager = managerForPosition(selectedPosition);
  const positionStatus = statusForEmployee(selectedEmployee);
  const missingCompliance = SEED.compliance.filter((item) => item.positionId === selectedPosition.id && item.status !== "complete").map((item) => item.type);
  if (selectedEmployee && selectedEmployee.onboardingStatus !== "complete") {
    missingCompliance.push("Onboarding Task");
  }
  const readiness = Math.max(0, 100 - missingCompliance.length * 18 - Math.min(positionActions.length, 3) * 6);
  const openActions = positionActions.filter((item) => item.status !== "completed");

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.2 }}>{selectedPosition.title}</div>
        <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>{selectedEmployee?.name ?? "Vacant"}</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          {selectedPosition.department} · Reporting Manager: {manager?.name ?? "None"}
        </div>
        <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#cbd5e1" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(positionStatus), display: "inline-block" }} />
          {statusLabel(positionStatus)}
        </div>
      </div>

      <PanelSection title="Position Information">
        <div style={{ fontSize: 12, color: "#cbd5e1" }}>Position ID: {selectedPosition.id}</div>
        <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>Department: {selectedPosition.department}</div>
        <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 4 }}>Direct Reports: {directReports.length}</div>
      </PanelSection>

      <PanelSection title="Assigned Employee">
        {selectedEmployee ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar initials={selectedEmployee.avatarInitials} color={selectedEmployee.avatarColor} size={34} />
            <div>
              <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700 }}>{selectedEmployee.name}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{selectedEmployee.email}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{selectedEmployee.phone}</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>No employee assigned</div>
        )}
      </PanelSection>

      <PanelSection title="Position Status">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: statusColor(positionStatus), display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{statusLabel(positionStatus)}</span>
        </div>
      </PanelSection>

      <PanelSection title="Readiness">
        <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>Readiness</div>
        <div style={{ fontSize: 34, lineHeight: 1.15, color: "#fff", fontWeight: 800, marginTop: 4 }}>{readiness}%</div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 9, marginBottom: 5 }}>Missing Items</div>
        {missingCompliance.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 16, color: "#cbd5e1", fontSize: 12, lineHeight: 1.5 }}>
            {missingCompliance.slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <div style={{ fontSize: 12, color: "#22c55e" }}>No missing items</div>
        )}
      </PanelSection>

      <PanelSection title="Open Actions">
        {openActions.length === 0 ? (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>No open actions</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openActions.map((item) => {
              const priority = priorityStyle(item.priority);
              return (
                <div key={item.action.id} style={{ border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "9px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700 }}>{item.action.title}</div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: priority.text, background: priority.bg, borderRadius: 999, padding: "2px 7px" }}>
                      {item.priority}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: item.isOverdue ? "#ef4444" : item.isDueSoon ? "#f59e0b" : "#94a3b8", marginTop: 5 }}>
                    Due {formatDueDate(item.dueDate)} · Owner {ownerName(item)}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => onUpdateAction(item.action.id, { status: "completed" })}
                      style={{
                        border: "1px solid rgba(34,197,94,0.34)",
                        borderRadius: 6,
                        background: "rgba(34,197,94,0.1)",
                        color: "#22c55e",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Complete
                    </button>
                    <button
                      onClick={() => onUpdateAction(item.action.id, { status: "in_progress" })}
                      style={{
                        border: "1px solid rgba(99,102,241,0.34)",
                        borderRadius: 6,
                        background: "rgba(99,102,241,0.1)",
                        color: "#818cf8",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 8px",
                        cursor: "pointer",
                      }}
                    >
                      In Progress
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
                    <select
                      value={item.ownerId}
                      onChange={(event) => onUpdateAction(item.action.id, { ownerId: event.target.value })}
                      style={{
                        border: "1px solid rgba(255,255,255,0.16)",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.03)",
                        color: "#cbd5e1",
                        fontSize: 11,
                        padding: "4px 6px",
                      }}
                    >
                      <option value="manager">Manager</option>
                      {SEED.employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={item.dueDate}
                      onChange={(event) => onUpdateAction(item.action.id, { dueDate: event.target.value })}
                      style={{
                        border: "1px solid rgba(255,255,255,0.16)",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.03)",
                        color: "#cbd5e1",
                        fontSize: 11,
                        padding: "4px 6px",
                      }}
                    />
                  </div>
                  <button
                    onClick={() => onAddComment(item.action.id, "Updated from position panel")}
                    style={{
                      marginTop: 7,
                      border: "1px solid rgba(255,255,255,0.16)",
                      borderRadius: 6,
                      background: "rgba(255,255,255,0.03)",
                      color: "#cbd5e1",
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Add Comment
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </PanelSection>

      <PanelSection title="Supporting Information">
        {selectedEmployee ? (
          <>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Location: {selectedEmployee.location}</div>
            <div style={{ fontSize: 12, color: "#cbd5e1", marginBottom: 4 }}>Start Date: {selectedEmployee.startDate}</div>
            <div style={{ fontSize: 12, color: "#cbd5e1" }}>Bank: {selectedEmployee.bankName}</div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>No supporting data</div>
        )}
      </PanelSection>

      <PanelSection title="Reporting Line">
        {directReports.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {directReports.slice(0, 6).map((report) => (
              <button
                key={report.position.id}
                onClick={() => onSelectPosition(report.position.id)}
                style={{
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.03)",
                  color: "#cbd5e1",
                  fontSize: 10,
                  padding: "4px 8px",
                  cursor: "pointer",
                }}
              >
                {report.position.title}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#94a3b8" }}>No direct reports</div>
        )}
      </PanelSection>
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
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [peopleStatusFilter, setPeopleStatusFilter] = useState<"all" | Employee["status"]>("all");
  const [actionCommentDrafts, setActionCommentDrafts] = useState<Record<string, string>>({});
  const actionOverrides = controlState.actionOverrides;
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [focusPathOnly, setFocusPathOnly] = useState(false);

  const uiState = useMemo(() => computeUIState(SEED, controlState), [controlState]);

  const actionViews = useMemo<ActionView[]>(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dueSoonThreshold = Date.now() + 48 * 60 * 60 * 1000;

    return uiState.actions
      .map((action) => {
        const position = SEED.positions.find((item) => item.id === action.relatedPositionId) ?? null;
        const employee = SEED.employees.find((item) => item.positionId === action.relatedPositionId) ?? null;
        const manager = managerForPosition(position ?? null);
        const override = actionOverrides[action.id];
        const dueDate = override?.dueDate ?? action.dueDate;
        const status = override?.status ?? "open";
        const ownerId = override?.ownerId ?? employee?.id ?? manager?.id ?? "manager";
        const comments = override?.comments ?? [];
        const dueAt = new Date(dueDate).getTime();
        const isOverdue = status !== "completed" && Number.isFinite(dueAt) && dueAt < startOfToday;
        const isDueSoon = status !== "completed" && Number.isFinite(dueAt) && dueAt >= startOfToday && dueAt <= dueSoonThreshold;
        return {
          action,
          position,
          employee,
          manager,
          status,
          ownerId,
          dueDate,
          comments,
          priority: priorityForAction(action),
          isOverdue,
          isDueSoon,
        };
      })
      .sort((left, right) => {
        const leftRank = left.isOverdue ? 0 : left.isDueSoon ? 1 : left.priority === "critical" ? 2 : left.priority === "high" ? 3 : 4;
        const rightRank = right.isOverdue ? 0 : right.isDueSoon ? 1 : right.priority === "critical" ? 2 : right.priority === "high" ? 3 : 4;
        return leftRank - rightRank;
      });
  }, [uiState.actions, actionOverrides]);

  const filteredActions = useMemo(
    () => actionViews.filter((action) => actionFilter === "all" || action.status === actionFilter),
    [actionFilter, actionViews],
  );

  const selectedPositionActions = useMemo(
    () => actionViews.filter((item) => item.position?.id === uiState.selectedPosition?.id),
    [actionViews, uiState.selectedPosition?.id],
  );

  const directReports = useMemo(() => {
    if (!uiState.selectedPosition) return [];
    return SEED.positions
      .filter((position) => position.reportsToId === uiState.selectedPosition?.id)
      .sort((a, b) => a.order - b.order)
      .map((position) => ({
        position,
        employee: SEED.employees.find((employee) => employee.positionId === position.id) ?? null,
      }));
  }, [uiState.selectedPosition]);

  const peopleRows = useMemo(() => {
    return SEED.employees
      .filter((employee) => {
        const position = SEED.positions.find((item) => item.id === employee.positionId);
        const manager = managerForPosition(position ?? null);
        const query = employeeSearch.trim().toLowerCase();
        const matchesQuery =
          !query ||
          employee.name.toLowerCase().includes(query) ||
          employee.email.toLowerCase().includes(query) ||
          employee.phone.toLowerCase().includes(query) ||
          (position?.title.toLowerCase().includes(query) ?? false) ||
          (position?.department.toLowerCase().includes(query) ?? false) ||
          (manager?.name.toLowerCase().includes(query) ?? false);
        const matchesStatus = peopleStatusFilter === "all" || peopleStatusFilter === employee.status;
        return matchesQuery && matchesStatus;
      })
      .map((employee) => {
        const position = SEED.positions.find((item) => item.id === employee.positionId) ?? null;
        const manager = managerForPosition(position ?? null);
        return { employee, position, manager };
      });
  }, [employeeSearch, peopleStatusFilter]);

  const allCollapsibleIds = useMemo(() => collectCollapsibleIds(uiState.orgTree), [uiState.orgTree]);
  const pathSet = useMemo(() => buildPathSet(uiState.selectedPosition?.id ?? null), [uiState.selectedPosition?.id]);

  const overdueCount = actionViews.filter((item) => item.isOverdue).length;
  const dueSoonCount = actionViews.filter((item) => item.isDueSoon).length;
  const criticalVacancyCount = uiState.stats.criticalVacancies;

  const selectPosition = (id: string) => {
    const employee = SEED.employees.find((item) => item.positionId === id);
    setControlState((prev) => ({
      ...prev,
      selectedPositionId: id,
      selectedEmployeeId: employee?.id ?? null,
      scenarioId: "DEFAULT_VIEW",
    }));
  };

  const updateAction = (id: string, patch: ActionOverride) => {
    setControlState((prev) => ({
      ...prev,
      actionOverrides: {
        ...prev.actionOverrides,
        [id]: { ...prev.actionOverrides[id], ...patch },
      },
    }));
  };

  const addComment = (id: string, comment: string) => {
    if (!comment.trim()) return;
    setControlState((prev) => {
      const existing = prev.actionOverrides[id];
      const comments = existing?.comments ?? [];
      return {
        ...prev,
        actionOverrides: {
          ...prev.actionOverrides,
          [id]: { ...existing, comments: [...comments, comment.trim()] },
        },
      };
    });
    setActionCommentDrafts((prev) => ({ ...prev, [id]: "" }));
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        background: "#0b1220",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: "#0f172a",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
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
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>TeamFrame V2</div>
          </div>
        </div>

        <nav style={{ padding: "8px 0", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.id;
            const badge =
              item.id === "actions" ? actionViews.filter((entry) => entry.status !== "completed").length : item.id === "org" ? uiState.stats.vacantPositions : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  width: "100%",
                  border: "none",
                  borderLeft: `2px solid ${active ? "#818cf8" : "transparent"}`,
                  background: active ? "rgba(99,102,241,0.16)" : "transparent",
                  color: active ? "#c7d2fe" : "#94a3b8",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <span>{item.label}</span>
                {badge > 0 && (
                  <span
                    style={{
                      background: "rgba(99,102,241,0.3)",
                      color: "#c7d2fe",
                      borderRadius: 999,
                      padding: "1px 7px",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {badge}
                  </span>
                )}
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
            background: "#0f172a",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 18px",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
            {activeNav === "org"
              ? "Organization Map"
              : activeNav === "actions"
              ? "Actions"
              : activeNav === "people"
              ? "People Directory"
              : activeNav === "policies"
              ? "Policy & Compliance"
              : activeNav === "finance"
              ? "Finance Report"
              : "Administration"}
          </h1>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(99,102,241,0.24)", color: "#e2e8f0", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
            COO
          </div>
        </header>

        <div style={{ flex: 1, overflow: "hidden" }}>
          {activeNav === "org" && (
            <div style={{ height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "11px 16px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(120px, 1fr))", gap: 8 }}>
                  <KpiCard label="Total Positions" value={uiState.stats.totalPositions} tone="default" />
                  <KpiCard label="Filled Positions" value={uiState.stats.filledPositions} tone="good" />
                  <KpiCard label="Vacant Positions" value={uiState.stats.vacantPositions} tone="warn" />
                  <KpiCard label="Critical Vacancies" value={criticalVacancyCount} tone="critical" />
                  <KpiCard label="Needs Attention" value={overdueCount} tone={overdueCount > 0 ? "critical" : "default"} />
                  <KpiCard label="Due Soon" value={dueSoonCount} tone={dueSoonCount > 0 ? "warn" : "default"} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                  <button
                    onClick={() => setCollapsedIds(new Set(allCollapsibleIds))}
                    style={{
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 7,
                      background: "rgba(255,255,255,0.04)",
                      color: "#cbd5e1",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "5px 9px",
                      cursor: "pointer",
                    }}
                  >
                    Collapse All
                  </button>
                  <button
                    onClick={() => setCollapsedIds(new Set())}
                    style={{
                      border: "1px solid rgba(255,255,255,0.14)",
                      borderRadius: 7,
                      background: "rgba(255,255,255,0.04)",
                      color: "#cbd5e1",
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
                      border: `1px solid ${focusPathOnly ? "rgba(99,102,241,0.6)" : "rgba(255,255,255,0.14)"}`,
                      borderRadius: 7,
                      background: focusPathOnly ? "rgba(99,102,241,0.17)" : "rgba(255,255,255,0.04)",
                      color: focusPathOnly ? "#c7d2fe" : "#cbd5e1",
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

              <div style={{ flex: 1, overflow: "auto", padding: "18px 18px 28px" }}>
                {uiState.orgTree.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 14 }}>No organization structure available.</div>
                ) : (
                  <div style={{ minWidth: 1200, paddingRight: 390 }}>
                    <OrgTree
                      nodes={uiState.orgTree}
                      selectedPositionId={uiState.selectedPosition?.id ?? null}
                      onSelectPosition={selectPosition}
                      collapsedIds={collapsedIds}
                      onToggleCollapse={(id) => {
                        setCollapsedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id);
                          else next.add(id);
                          return next;
                        });
                      }}
                      focusPathOnly={focusPathOnly}
                      pathSet={pathSet}
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  position: "absolute",
                  right: 12,
                  top: 114,
                  bottom: 12,
                  width: 360,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(15,23,42,0.96)",
                  boxShadow: "0 18px 42px rgba(0,0,0,0.45)",
                  overflow: "hidden",
                }}
              >
                <PositionPanel
                  selectedPosition={uiState.selectedPosition}
                  selectedEmployee={uiState.selectedEmployee}
                  directReports={directReports}
                  positionActions={selectedPositionActions}
                  onSelectPosition={selectPosition}
                  onUpdateAction={updateAction}
                  onAddComment={addComment}
                />
              </div>
            </div>
          )}

          {activeNav === "actions" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "12px 16px", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div style={{ borderRadius: 999, border: "1px solid rgba(239,68,68,0.35)", background: "rgba(239,68,68,0.14)", color: "#ef4444", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
                  Overdue {overdueCount}
                </div>
                <div style={{ borderRadius: 999, border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.14)", color: "#f59e0b", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
                  Due Soon {dueSoonCount}
                </div>
                <div style={{ borderRadius: 999, border: "1px solid rgba(99,102,241,0.35)", background: "rgba(99,102,241,0.14)", color: "#818cf8", fontSize: 11, fontWeight: 700, padding: "4px 10px" }}>
                  Open {actionViews.filter((item) => item.status !== "completed").length}
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
                        border: `1px solid ${active ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.14)"}`,
                        borderRadius: 8,
                        background: active ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.03)",
                        color: active ? "#c7d2fe" : "#cbd5e1",
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
                {filteredActions.length === 0 && (
                  <div style={{ marginTop: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    No actions in this view.
                  </div>
                )}
                {filteredActions.map((item) => {
                  const priority = priorityStyle(item.priority);
                  const rowBorder = item.isOverdue ? "rgba(239,68,68,0.5)" : item.isDueSoon ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.09)";
                  const rowBg = item.isOverdue ? "rgba(239,68,68,0.08)" : item.isDueSoon ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.02)";
                  const draft = actionCommentDrafts[item.action.id] ?? "";
                  return (
                    <div key={item.action.id} style={{ border: `1px solid ${rowBorder}`, background: rowBg, borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) 110px 150px 170px 130px", gap: 10, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 700 }}>{item.action.title}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                            {item.position?.title ?? "Unknown Position"} · {item.position?.department ?? "Unknown Department"}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: priority.text, background: priority.bg, borderRadius: 999, padding: "3px 8px", width: "fit-content" }}>
                          {item.priority}
                        </span>
                        <div style={{ fontSize: 11, color: item.isOverdue ? "#ef4444" : item.isDueSoon ? "#f59e0b" : "#cbd5e1", fontWeight: 700 }}>
                          {formatDueDate(item.dueDate)}
                        </div>
                        <div style={{ fontSize: 11, color: "#cbd5e1" }}>{ownerName(item)}</div>
                        <div style={{ fontSize: 11, color: "#cbd5e1", fontWeight: 700 }}>
                          {item.status === "in_progress" ? "In Progress" : item.status === "completed" ? "Completed" : "Open"}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "auto auto 180px 150px 1fr auto", gap: 6, marginTop: 8, alignItems: "center" }}>
                        <button
                          onClick={() => updateAction(item.action.id, { status: item.status === "completed" ? "open" : "completed" })}
                          style={{
                            border: "1px solid rgba(34,197,94,0.35)",
                            borderRadius: 7,
                            background: "rgba(34,197,94,0.12)",
                            color: "#22c55e",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "5px 8px",
                            cursor: "pointer",
                          }}
                        >
                          {item.status === "completed" ? "Reopen" : "Complete"}
                        </button>
                        <button
                          onClick={() => updateAction(item.action.id, { status: "in_progress" })}
                          style={{
                            border: "1px solid rgba(99,102,241,0.35)",
                            borderRadius: 7,
                            background: "rgba(99,102,241,0.12)",
                            color: "#818cf8",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "5px 8px",
                            cursor: "pointer",
                          }}
                        >
                          In Progress
                        </button>
                        <select
                          value={item.ownerId}
                          onChange={(event) => updateAction(item.action.id, { ownerId: event.target.value })}
                          style={{
                            border: "1px solid rgba(255,255,255,0.16)",
                            borderRadius: 7,
                            background: "rgba(255,255,255,0.03)",
                            color: "#cbd5e1",
                            fontSize: 11,
                            padding: "5px 8px",
                          }}
                        >
                          <option value="manager">Manager</option>
                          {SEED.employees.map((employee) => (
                            <option key={employee.id} value={employee.id}>
                              {employee.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={item.dueDate}
                          onChange={(event) => updateAction(item.action.id, { dueDate: event.target.value })}
                          style={{
                            border: "1px solid rgba(255,255,255,0.16)",
                            borderRadius: 7,
                            background: "rgba(255,255,255,0.03)",
                            color: "#cbd5e1",
                            fontSize: 11,
                            padding: "5px 8px",
                          }}
                        />
                        <input
                          value={draft}
                          onChange={(event) => setActionCommentDrafts((prev) => ({ ...prev, [item.action.id]: event.target.value }))}
                          placeholder="Add comment"
                          style={{
                            border: "1px solid rgba(255,255,255,0.16)",
                            borderRadius: 7,
                            background: "rgba(255,255,255,0.03)",
                            color: "#cbd5e1",
                            fontSize: 11,
                            padding: "5px 8px",
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={() => addComment(item.action.id, draft)}
                          style={{
                            border: "1px solid rgba(255,255,255,0.16)",
                            borderRadius: 7,
                            background: "rgba(255,255,255,0.05)",
                            color: "#e2e8f0",
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "5px 8px",
                            cursor: "pointer",
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeNav === "people" && (
            <div style={{ height: "100%", display: "flex", flexDirection: "column", padding: "12px 16px", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, maxWidth: 440, display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, background: "rgba(255,255,255,0.03)", padding: "7px 10px" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Search</span>
                  <input
                    value={employeeSearch}
                    onChange={(event) => setEmployeeSearch(event.target.value)}
                    placeholder="Name, position, manager, contact"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#e2e8f0",
                      fontSize: 12,
                      outline: "none",
                      width: "100%",
                    }}
                  />
                </div>
                <select
                  value={peopleStatusFilter}
                  onChange={(event) => setPeopleStatusFilter(event.target.value as "all" | Employee["status"])}
                  style={{
                    border: "1px solid rgba(255,255,255,0.16)",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.03)",
                    color: "#cbd5e1",
                    fontSize: 12,
                    padding: "7px 10px",
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="on_leave">On Leave</option>
                  <option value="offboarding">Offboarding</option>
                </select>
              </div>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 7 }}>
                {peopleRows.length === 0 && (
                  <div style={{ marginTop: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
                    No employees match this filter.
                  </div>
                )}
                {peopleRows.map(({ employee, position, manager }) => {
                  const currentStatus = statusForEmployee(employee);
                  return (
                    <button
                      key={employee.id}
                      onClick={() => {
                        selectPosition(employee.positionId);
                        setActiveNav("org");
                      }}
                      style={{
                        textAlign: "left",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        background: "rgba(255,255,255,0.02)",
                        color: "#e2e8f0",
                        display: "grid",
                        gridTemplateColumns: "minmax(260px, 2fr) minmax(210px, 1fr) minmax(180px, 1fr)",
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar initials={employee.avatarInitials} color={employee.avatarColor} size={34} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>{employee.name}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            {position?.title ?? "Unknown Position"} · {position?.department ?? "Unknown Department"}
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, color: "#cbd5e1" }}>{employee.email}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{employee.phone}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>Manager: {manager?.name ?? "None"}</div>
                        <div style={{ marginTop: 3, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#cbd5e1" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(currentStatus), display: "inline-block" }} />
                          {statusLabel(currentStatus)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeNav === "policies" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "12px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {SEED.compliance.map((item) => {
                  const position = SEED.positions.find((positionItem) => positionItem.id === item.positionId);
                  const statusText = item.status;
                  const statusTone =
                    item.status === "complete"
                      ? { bg: "rgba(34,197,94,0.14)", color: "#22c55e" }
                      : item.status === "expired"
                      ? { bg: "rgba(245,158,11,0.14)", color: "#f59e0b" }
                      : { bg: "rgba(239,68,68,0.14)", color: "#ef4444" };
                  return (
                    <div key={item.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(255,255,255,0.02)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{item.type}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{position?.title ?? "Unknown Position"}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 999, padding: "3px 8px", background: statusTone.bg, color: statusTone.color }}>
                        {statusText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeNav === "finance" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "12px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {SEED.employees.map((employee) => {
                  const position = SEED.positions.find((positionItem) => positionItem.id === employee.positionId);
                  return (
                    <div key={employee.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(255,255,255,0.02)", padding: "10px 12px", display: "grid", gridTemplateColumns: "minmax(220px, 2fr) 130px 190px 120px", gap: 10, alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{employee.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{position?.title ?? "Unknown Position"}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>${employee.salary.toLocaleString()}</div>
                      <div style={{ fontSize: 11, color: "#cbd5e1" }}>{employee.bankName} · ****{employee.bankAccount.slice(-4)}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>{employee.status}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeNav === "administration" && (
            <div style={{ height: "100%", overflowY: "auto", padding: "12px 16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
                {[
                  { title: "Data Import", value: "CSV tools" },
                  { title: "Configuration", value: "Operational settings" },
                  { title: "Audit History", value: "Recent changes" },
                ].map((item) => (
                  <div key={item.title} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(255,255,255,0.02)", padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
