import { useMemo, useState } from "react";
import { SEED } from "../../../teamframe/data/seed";
import {
  ActionItem,
  ActionStatus,
  ControlState,
  OrgNode,
  computeUIState,
} from "../../../teamframe/engine/compute";

type NavId = "org" | "people" | "actions" | "policies" | "finance" | "administration";
type ActionFilter = "all" | "open" | "in_progress" | "completed";
type AdminTab = "organization-setup" | "csv-imports" | "configuration" | "audit";

const NAV_ITEMS: { id: NavId; label: string; icon: string }[] = [
  { id: "org", label: "Organization Map", icon: "⬡" },
  { id: "people", label: "People", icon: "◉" },
  { id: "actions", label: "Actions", icon: "⚡" },
  { id: "policies", label: "Policies", icon: "📚" },
  { id: "finance", label: "Finance", icon: "≡" },
  { id: "administration", label: "Administration", icon: "⚙" },
];

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: "organization-setup", label: "Organization Setup" },
  { id: "csv-imports", label: "CSV Imports" },
  { id: "configuration", label: "Configuration" },
  { id: "audit", label: "Audit Timeline" },
];

const FILTER_TABS: { id: ActionFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
];

const cardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
};

function positionStatusStyle(status: "filled" | "vacant" | "frozen") {
  if (status === "filled") return { color: "#22c55e", label: "Filled" };
  if (status === "vacant") return { color: "#f59e0b", label: "Vacant" };
  return { color: "#94a3b8", label: "Frozen" };
}

function priorityStyle(priority: ActionItem["priority"]) {
  if (priority === "critical") return { bg: "rgba(239,68,68,0.18)", color: "#fca5a5" };
  if (priority === "high") return { bg: "rgba(245,158,11,0.18)", color: "#fcd34d" };
  if (priority === "normal") return { bg: "rgba(99,102,241,0.18)", color: "#c7d2fe" };
  return { bg: "rgba(148,163,184,0.18)", color: "#cbd5e1" };
}

function actionStatusStyle(status: ActionStatus) {
  if (status === "completed") return { bg: "rgba(34,197,94,0.18)", color: "#86efac", label: "Completed" };
  if (status === "in_progress") return { bg: "rgba(99,102,241,0.18)", color: "#c7d2fe", label: "In Progress" };
  return { bg: "rgba(245,158,11,0.18)", color: "#fcd34d", label: "Open" };
}

function OrgNodeCard({
  node,
  selectedPositionId,
  onSelect,
}: {
  node: OrgNode;
  selectedPositionId: string;
  onSelect: (positionId: string, employeeId: string | null) => void;
}) {
  const selected = selectedPositionId === node.position.id;
  const dotColor =
    node.signalLevel === "critical"
      ? "#ef4444"
      : node.signalLevel === "warning"
      ? "#f59e0b"
      : node.signalLevel === "info"
      ? "#94a3b8"
      : "#22c55e";

  return (
    <button
      onClick={() => onSelect(node.position.id, node.employee?.id ?? null)}
      style={{
        ...cardStyle,
        width: 188,
        borderColor: selected ? "#6366f1" : "rgba(255,255,255,0.1)",
        background: selected ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.03)",
        padding: "10px 11px",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{node.position.title}</div>
      <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 3 }}>{node.employee?.name ?? "Vacant"}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, display: "inline-block" }} />
        <span style={{ color: "#64748b", fontSize: 10 }}>{node.children.length} reports</span>
      </div>
    </button>
  );
}

function OrgTree({
  nodes,
  selectedPositionId,
  onSelect,
}: {
  nodes: OrgNode[];
  selectedPositionId: string;
  onSelect: (positionId: string, employeeId: string | null) => void;
}) {
  if (!nodes.length) return null;
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
      {nodes.map((node) => (
        <div key={node.position.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <OrgNodeCard node={node} selectedPositionId={selectedPositionId} onSelect={onSelect} />
          {node.children.length > 0 && (
            <>
              <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.14)" }} />
              <OrgTree nodes={node.children} selectedPositionId={selectedPositionId} onSelect={onSelect} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState<NavId>("org");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [adminTab, setAdminTab] = useState<AdminTab>("organization-setup");
  const [detailOpen, setDetailOpen] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const [financeSearch, setFinanceSearch] = useState("");
  const [newCommentByAction, setNewCommentByAction] = useState<Record<string, string>>({});

  const [controlState, setControlState] = useState<ControlState>({
    scenarioId: "DEFAULT_VIEW",
    selectedPositionId: "1-001",
    selectedEmployeeId: "e-001",
    resolvedActions: [],
    positionEdits: [],
    onboardingCompleted: [],
    actionOverrides: {},
  });

  const uiState = useMemo(() => computeUIState(SEED, controlState), [controlState]);

  const ownerOptions = useMemo(
    () =>
      SEED.employees.map((employee) => ({
        id: employee.id,
        label: employee.name,
      })),
    []
  );

  const selectPosition = (positionId: string, employeeId: string | null) => {
    setControlState((prev) => ({
      ...prev,
      selectedPositionId: positionId,
      selectedEmployeeId: employeeId,
    }));
    setDetailOpen(true);
  };

  const setActionOverride = (actionId: string, patch: Partial<ControlState["actionOverrides"][string]>) => {
    setControlState((prev) => ({
      ...prev,
      actionOverrides: {
        ...prev.actionOverrides,
        [actionId]: {
          ...(prev.actionOverrides[actionId] ?? {}),
          ...patch,
        },
      },
    }));
  };

  const setActionStatus = (action: ActionItem, status: ActionStatus) => {
    setActionOverride(action.id, { status });
    setControlState((prev) => {
      const resolved = new Set(prev.resolvedActions);
      if (status === "completed") {
        resolved.add(action.id);
        resolved.add(action.linkedRiskId);
      } else {
        resolved.delete(action.id);
        resolved.delete(action.linkedRiskId);
      }
      return { ...prev, resolvedActions: [...resolved] };
    });
  };

  const addActionComment = (action: ActionItem) => {
    const comment = (newCommentByAction[action.id] ?? "").trim();
    if (!comment) return;
    setActionOverride(action.id, {
      comments: [...action.comments, `${new Date().toISOString().slice(0, 10)} · ${comment}`],
    });
    setNewCommentByAction((prev) => ({ ...prev, [action.id]: "" }));
  };

  const filteredActions = uiState.actions.filter((action) => {
    if (actionFilter === "all") return true;
    return action.status === actionFilter;
  });

  const peopleRows = uiState.employeeDirectory.filter((row) => {
    const query = directorySearch.trim().toLowerCase();
    if (!query) return true;
    return `${row.employeeName} ${row.positionTitle} ${row.department} ${row.email} ${row.managerName}`
      .toLowerCase()
      .includes(query);
  });

  const financeRows = uiState.financeRows.filter((row) => {
    const query = financeSearch.trim().toLowerCase();
    if (!query) return true;
    return `${row.employeeId} ${row.employeeName} ${row.position} ${row.department} ${row.manager}`
      .toLowerCase()
      .includes(query);
  });

  const selectedPositionStatus =
    uiState.selectedPositionStatus && positionStatusStyle(uiState.selectedPositionStatus);

  return (
    <div
      style={{
        display: "flex",
        width: "100vw",
        height: "100vh",
        background: "#0f1117",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <aside
        style={{
          width: 228,
          borderRight: "1px solid rgba(255,255,255,0.1)",
          background: "#13161f",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>TeamFrame</div>
          <div style={{ color: "#64748b", fontSize: 10 }}>Operations Platform</div>
        </div>
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.id;
            const badge = item.id === "actions" ? uiState.stats.needsAttention : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  width: "100%",
                  border: "none",
                  textAlign: "left",
                  borderLeft: `2px solid ${active ? "#6366f1" : "transparent"}`,
                  background: active ? "rgba(99,102,241,0.16)" : "none",
                  color: active ? "#c7d2fe" : "#64748b",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  padding: "8px 14px",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      background: "rgba(99,102,241,0.75)",
                      color: "#fff",
                      borderRadius: 8,
                      padding: "1px 6px",
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
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            background: "#13161f",
            display: "flex",
            alignItems: "center",
            padding: "0 14px",
          }}
        >
          <h1 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 800 }}>
            {NAV_ITEMS.find((item) => item.id === activeNav)?.label}
          </h1>
        </header>

        <section style={{ flex: 1, overflow: "auto", padding: 14, position: "relative" }}>
          {activeNav === "org" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ ...cardStyle, padding: 10, display: "grid", gap: 8, gridTemplateColumns: "repeat(6, minmax(130px, 1fr))" }}>
                {[
                  { label: "Total Positions", value: uiState.stats.totalPositions },
                  { label: "Filled Positions", value: uiState.stats.filledPositions },
                  { label: "Vacant Positions", value: uiState.stats.vacantPositions },
                  { label: "Critical Vacancies", value: uiState.stats.criticalVacancies },
                  { label: "Needs Attention", value: uiState.stats.needsAttention },
                  { label: "Due Soon (48h)", value: uiState.stats.dueSoon },
                ].map((item) => (
                  <div key={item.label} style={{ ...cardStyle, padding: 8 }}>
                    <div style={{ color: "#64748b", fontSize: 10 }}>{item.label}</div>
                    <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...cardStyle, minHeight: "76vh", paddingTop: 22, position: "relative" }}>
                <OrgTree nodes={uiState.orgTree} selectedPositionId={controlState.selectedPositionId} onSelect={selectPosition} />

                {detailOpen && uiState.selectedPosition && (
                  <aside
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      width: 340,
                      height: "100%",
                      borderLeft: "1px solid rgba(255,255,255,0.1)",
                      background: "#161b27",
                      padding: 12,
                      overflowY: "auto",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>
                          {uiState.selectedPosition.title}
                        </div>
                        <div style={{ color: "#94a3b8", fontSize: 11 }}>
                          {uiState.selectedEmployee?.name ?? "Vacant"}
                        </div>
                      </div>
                      <button
                        onClick={() => setDetailOpen(false)}
                        style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}
                      >
                        ×
                      </button>
                    </div>

                    <div style={{ ...cardStyle, padding: 10 }}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>
                        Position Status
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        {selectedPositionStatus && (
                          <>
                            <span
                              style={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                background: selectedPositionStatus.color,
                                display: "inline-block",
                              }}
                            />
                            {selectedPositionStatus.label}
                          </>
                        )}
                      </div>
                    </div>

                    <div style={{ ...cardStyle, padding: 10, marginTop: 10 }}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>
                        Missing Items
                      </div>
                      <ul style={{ margin: "0 0 0 16px", padding: 0, color: "#cbd5e1", fontSize: 12 }}>
                        {uiState.selectedPositionMissingItems.length === 0 ? (
                          <li>None</li>
                        ) : (
                          uiState.selectedPositionMissingItems.map((item) => <li key={item}>{item}</li>)
                        )}
                      </ul>
                    </div>
                  </aside>
                )}
              </div>
            </div>
          )}

          {activeNav === "people" && (
            <div style={{ ...cardStyle, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Employee Directory</div>
                <input
                  value={directorySearch}
                  onChange={(event) => setDirectorySearch(event.target.value)}
                  placeholder="Search employees"
                  style={{
                    width: 220,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#e2e8f0",
                    padding: "7px 9px",
                    fontSize: 11,
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {peopleRows.map((row) => (
                  <button
                    key={row.employeeId}
                    onClick={() => {
                      setControlState((prev) => ({
                        ...prev,
                        selectedEmployeeId: row.employeeId,
                        selectedPositionId: SEED.employees.find((item) => item.id === row.employeeId)?.positionId ?? prev.selectedPositionId,
                      }));
                      setActiveNav("org");
                      setDetailOpen(true);
                    }}
                    style={{
                      ...cardStyle,
                      width: "100%",
                      cursor: "pointer",
                      padding: 10,
                      textAlign: "left",
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 1fr 1.3fr 1fr 1.3fr auto",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{row.employeeName}</span>
                    <span style={{ fontSize: 11 }}>{row.positionTitle}</span>
                    <span style={{ fontSize: 11 }}>{row.department}</span>
                    <span style={{ fontSize: 11 }}>{row.email}</span>
                    <span style={{ fontSize: 11 }}>{row.phone}</span>
                    <span style={{ fontSize: 11 }}>Reports To: {row.managerName}</span>
                    <span style={{ fontSize: 10, color: row.status === "active" ? "#22c55e" : row.status === "on_leave" ? "#f59e0b" : "#ef4444" }}>
                      ●
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeNav === "actions" && (
            <div style={{ ...cardStyle, padding: 12 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {FILTER_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActionFilter(tab.id)}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${actionFilter === tab.id ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.14)"}`,
                      background: actionFilter === tab.id ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.03)",
                      color: actionFilter === tab.id ? "#c7d2fe" : "#94a3b8",
                      fontSize: 11,
                      padding: "7px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {filteredActions.map((action) => {
                  const priority = priorityStyle(action.priority);
                  const status = actionStatusStyle(action.status);
                  return (
                    <div key={action.id} style={{ ...cardStyle, padding: 10 }}>
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          gridTemplateColumns: "1.6fr 0.8fr 1fr 0.9fr 1fr 1.1fr 1.1fr",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <div>
                          <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{action.title}</div>
                          <div style={{ color: "#94a3b8", fontSize: 11 }}>{action.relatedRequirement}</div>
                        </div>
                        <span
                          style={{
                            display: "inline-flex",
                            justifyContent: "center",
                            borderRadius: 999,
                            background: priority.bg,
                            color: priority.color,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 8px",
                            textTransform: "uppercase",
                          }}
                        >
                          {action.priority}
                        </span>
                        <div style={{ fontSize: 11 }}>Owner: {ownerOptions.find((item) => item.id === action.ownerId)?.label ?? action.ownerRole}</div>
                        <div style={{ fontSize: 11 }}>Due: {formatDate(action.dueDate)}</div>
                        <span
                          style={{
                            display: "inline-flex",
                            justifyContent: "center",
                            borderRadius: 999,
                            background: status.bg,
                            color: status.color,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "3px 8px",
                            textTransform: "uppercase",
                          }}
                        >
                          {status.label}
                        </span>
                        <div style={{ fontSize: 11 }}>{action.relatedEmployeeName}</div>
                        <div style={{ fontSize: 11 }}>{action.relatedPositionTitle}</div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          gridTemplateColumns: "1fr 1fr 1.6fr auto auto auto",
                          alignItems: "center",
                        }}
                      >
                        <select
                          value={action.ownerId}
                          onChange={(event) =>
                            setActionOverride(action.id, {
                              ownerId: event.target.value,
                              ownerRole: "employee",
                            })
                          }
                          style={{
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.16)",
                            background: "rgba(255,255,255,0.03)",
                            color: "#e2e8f0",
                            fontSize: 11,
                            padding: "7px 9px",
                          }}
                        >
                          <option value={action.ownerId}>
                            {ownerOptions.find((item) => item.id === action.ownerId)?.label ?? action.ownerRole}
                          </option>
                          {ownerOptions
                            .filter((item) => item.id !== action.ownerId)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                        </select>

                        <input
                          type="date"
                          value={action.dueDate}
                          onChange={(event) => setActionOverride(action.id, { dueDate: event.target.value })}
                          style={{
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.16)",
                            background: "rgba(255,255,255,0.03)",
                            color: "#e2e8f0",
                            fontSize: 11,
                            padding: "7px 9px",
                          }}
                        />

                        <input
                          value={newCommentByAction[action.id] ?? ""}
                          onChange={(event) =>
                            setNewCommentByAction((prev) => ({ ...prev, [action.id]: event.target.value }))
                          }
                          placeholder="Add comment"
                          style={{
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.16)",
                            background: "rgba(255,255,255,0.03)",
                            color: "#e2e8f0",
                            fontSize: 11,
                            padding: "7px 9px",
                          }}
                        />

                        <button
                          onClick={() => addActionComment(action)}
                          style={{
                            borderRadius: 8,
                            border: "1px solid rgba(99,102,241,0.35)",
                            background: "rgba(99,102,241,0.16)",
                            color: "#c7d2fe",
                            fontSize: 11,
                            padding: "7px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Add Comment
                        </button>

                        <button
                          onClick={() =>
                            setActionStatus(action, action.status === "in_progress" ? "open" : "in_progress")
                          }
                          style={{
                            borderRadius: 8,
                            border: "1px solid rgba(245,158,11,0.35)",
                            background: "rgba(245,158,11,0.16)",
                            color: "#fcd34d",
                            fontSize: 11,
                            padding: "7px 10px",
                            cursor: "pointer",
                          }}
                        >
                          {action.status === "in_progress" ? "Move to Open" : "In Progress"}
                        </button>

                        <button
                          onClick={() =>
                            setActionStatus(action, action.status === "completed" ? "open" : "completed")
                          }
                          style={{
                            borderRadius: 8,
                            border: "1px solid rgba(34,197,94,0.35)",
                            background: "rgba(34,197,94,0.16)",
                            color: "#86efac",
                            fontSize: 11,
                            padding: "7px 10px",
                            cursor: "pointer",
                          }}
                        >
                          {action.status === "completed" ? "Reopen" : "Complete"}
                        </button>
                      </div>

                      {action.comments.length > 0 && (
                        <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
                          {action.comments.map((comment) => (
                            <div key={comment}>• {comment}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeNav === "policies" && (
            <div style={{ ...cardStyle, padding: 12 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                Policy & Compliance Queue
              </div>
              {uiState.complianceView.map((item) => (
                <div key={item.id} style={{ ...cardStyle, padding: 10, marginBottom: 8 }}>
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{item.type}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{item.description}</div>
                  <div style={{ color: item.status === "expired" ? "#fca5a5" : item.status === "missing" ? "#fcd34d" : "#86efac", fontSize: 11, marginTop: 4 }}>
                    {item.status === "expired" ? "Expired" : item.status === "missing" ? "Missing" : "Complete"}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeNav === "finance" && (
            <div style={{ ...cardStyle, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Finance Report</div>
                <input
                  value={financeSearch}
                  onChange={(event) => setFinanceSearch(event.target.value)}
                  placeholder="Search finance rows"
                  style={{
                    width: 220,
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.16)",
                    background: "rgba(255,255,255,0.03)",
                    color: "#e2e8f0",
                    padding: "7px 9px",
                    fontSize: 11,
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {[
                        "Employee ID",
                        "Employee Name",
                        "Position",
                        "Department",
                        "Manager",
                        "Status",
                        "Salary",
                        "Bank",
                        "Account",
                        "Join Date",
                      ].map((header) => (
                        <th
                          key={header}
                          style={{
                            textAlign: "left",
                            padding: "7px 6px",
                            borderBottom: "1px solid rgba(255,255,255,0.16)",
                            color: "#94a3b8",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {financeRows.map((row) => (
                      <tr key={row.employeeId}>
                        <td style={{ padding: 6 }}>{row.employeeId}</td>
                        <td style={{ padding: 6 }}>{row.employeeName}</td>
                        <td style={{ padding: 6 }}>{row.position}</td>
                        <td style={{ padding: 6 }}>{row.department}</td>
                        <td style={{ padding: 6 }}>{row.manager}</td>
                        <td style={{ padding: 6 }}>{row.employmentStatus}</td>
                        <td style={{ padding: 6 }}>${row.salary.toLocaleString()}</td>
                        <td style={{ padding: 6 }}>{row.bankName}</td>
                        <td style={{ padding: 6 }}>{row.accountNumber}</td>
                        <td style={{ padding: 6 }}>{row.joinDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === "administration" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ ...cardStyle, padding: 10 }}>
                {ADMIN_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setAdminTab(tab.id)}
                    style={{
                      marginRight: 8,
                      borderRadius: 8,
                      border: `1px solid ${
                        adminTab === tab.id ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.14)"
                      }`,
                      background: adminTab === tab.id ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.03)",
                      color: adminTab === tab.id ? "#c7d2fe" : "#94a3b8",
                      fontSize: 11,
                      padding: "7px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {adminTab === "organization-setup" && (
                <div style={{ ...cardStyle, padding: 12, color: "#94a3b8", fontSize: 12 }}>
                  Organization setup lives here and is hidden from daily operational screens.
                </div>
              )}

              {adminTab === "csv-imports" && (
                <div style={{ ...cardStyle, padding: 12, color: "#94a3b8", fontSize: 12 }}>
                  Import positions and employees from CSV files.
                </div>
              )}

              {adminTab === "configuration" && (
                <div style={{ ...cardStyle, padding: 12, color: "#94a3b8", fontSize: 12 }}>
                  Configure document types, policy categories, and status settings.
                </div>
              )}

              {adminTab === "audit" && (
                <div style={{ ...cardStyle, padding: 12 }}>
                  {[...controlState.resolvedActions.map((item) => `Action or risk resolved: ${item}`)].map(
                    (event, index) => (
                      <div key={`${event}-${index}`} style={{ color: "#cbd5e1", fontSize: 12, marginBottom: 5 }}>
                        {event}
                      </div>
                    )
                  )}
                  {controlState.resolvedActions.length === 0 && (
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>No audit events yet.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
