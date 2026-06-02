import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { SEED, type DocumentCategory, type Employee, type EmployeeDocument, type Position } from "../../../teamframe/data/seed";
import {
  type ActionItem,
  type AuditEvent,
  type ControlState,
  type KpiFilterId,
  type OrgNode,
  type StatusDot,
  clearTemporaryOoo,
  computeUIState,
  createDefaultControlState,
  financeMatrix,
  importEmployeesFromCsv,
  importPositionsFromCsv,
  publishPolicyVersion,
  setTemporaryOoo,
  transitionAction,
} from "../../../teamframe/engine/compute";

const STORAGE_KEY = "teamframe-org-first-control-state-v2";

const NAV_ITEMS = [
  { id: "org", label: "Organization Map", icon: "⬡" },
  { id: "directory", label: "Employee Directory", icon: "◉" },
  { id: "profile", label: "Employee Profile", icon: "◎" },
  { id: "actions", label: "Actions", icon: "⚡" },
  { id: "risk", label: "Risk", icon: "🔥" },
  { id: "finance", label: "Finance Report", icon: "≡" },
  { id: "policies", label: "Policies", icon: "📚" },
  { id: "audit", label: "Audit Timeline", icon: "🕒" },
  { id: "setup", label: "Setup Wizard", icon: "🧭" },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

type ActionDraft = {
  completedBy: string;
  evidence: string;
  fileName: string;
};

type CsvState = {
  positionsCsv: string;
  employeesCsv: string;
  positionErrors: string[];
  employeeErrors: string[];
};

const cardStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  padding: 14,
};

const buttonBase: CSSProperties = {
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  color: "#cbd5e1",
  fontSize: 11,
  padding: "7px 10px",
  cursor: "pointer",
};

function loadControlState(): ControlState {
  if (typeof window === "undefined") return createDefaultControlState(SEED);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultControlState(SEED);
    const parsed = JSON.parse(raw) as ControlState;
    return {
      ...createDefaultControlState(SEED),
      ...parsed,
      positionEdits: parsed.positionEdits ?? [],
      temporaryOoo: parsed.temporaryOoo ?? [],
      actionStates: parsed.actionStates ?? [],
      uploadedDocuments: parsed.uploadedDocuments ?? [],
      policyVersionOverrides: parsed.policyVersionOverrides ?? [],
      policyAckOverrides: parsed.policyAckOverrides ?? [],
      onboardingOverrides: parsed.onboardingOverrides ?? [],
      addedPositions: parsed.addedPositions ?? [],
      addedEmployees: parsed.addedEmployees ?? [],
      auditEvents: parsed.auditEvents ?? [],
    };
  } catch {
    return createDefaultControlState(SEED);
  }
}

function saveControlState(controlState: ControlState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(controlState));
}

function statusDotColor(dot: StatusDot): string {
  if (dot === "green") return "#22c55e";
  if (dot === "yellow") return "#f59e0b";
  return "#cbd5e1";
}

function statusDotLabel(dot: StatusDot, vacant: boolean): string {
  if (vacant) return "Vacant";
  if (dot === "yellow") return "Out of Office";
  if (dot === "grey") return "On Leave";
  return "Working";
}

function download(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = fileName;
  window.document.body.appendChild(a);
  a.click();
  window.document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function textInputStyle(width: string | number = "100%"): CSSProperties {
  return {
    width,
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#e2e8f0",
    fontSize: 11,
    padding: "8px 10px",
    outline: "none",
  };
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
  const vacant = !node.employee;
  return (
    <button
      onClick={() => onSelect(node.position.id, node.employee?.id ?? null)}
      title={`${node.position.title} · ${node.employee?.name ?? "Vacant"} · ${statusDotLabel(node.statusDot, vacant)}`}
      style={{
        width: 178,
        borderRadius: 12,
        border: `1px solid ${selected ? "#6366f1" : "rgba(255,255,255,0.12)"}`,
        background: selected ? "rgba(99,102,241,0.14)" : "rgba(255,255,255,0.03)",
        padding: "10px 11px",
        cursor: "pointer",
        textAlign: "left",
        boxShadow: node.hasSearchMatch ? "0 0 0 1px rgba(34,197,94,0.4)" : "none",
      }}
    >
      <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}>{node.position.title}</div>
      <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{node.employee?.name ?? "Vacant"}</div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: statusDotColor(node.statusDot),
            display: "inline-block",
          }}
        />
        <span style={{ color: "#64748b", fontSize: 10 }}>{node.directReportCount} reports</span>
      </div>
    </button>
  );
}

function OrgBranch({
  nodes,
  selectedPositionId,
  onSelect,
}: {
  nodes: OrgNode[];
  selectedPositionId: string;
  onSelect: (positionId: string, employeeId: string | null) => void;
}) {
  if (nodes.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
      {nodes.map((node) => (
        <div key={node.position.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <OrgNodeCard node={node} selectedPositionId={selectedPositionId} onSelect={onSelect} />
          {node.children.length > 0 && (
            <>
              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.15)" }} />
              <OrgBranch nodes={node.children} selectedPositionId={selectedPositionId} onSelect={onSelect} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function kpiMeta(stats: {
  totalPositions: number;
  filledPositions: number;
  vacantPositions: number;
  openRisks: number;
  openActions: number;
}) {
  return [
    { id: "all" as KpiFilterId, label: "Total Positions", value: stats.totalPositions },
    { id: "filled" as KpiFilterId, label: "Filled", value: stats.filledPositions },
    { id: "vacant" as KpiFilterId, label: "Vacant", value: stats.vacantPositions },
    { id: "open_risks" as KpiFilterId, label: "Open Risks", value: stats.openRisks },
    { id: "open_actions" as KpiFilterId, label: "Open Actions", value: stats.openActions },
  ];
}

function EmptyStateCard({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ ...cardStyle, borderStyle: "dashed", color: "#94a3b8", fontSize: 12 }}>
      <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div>{body}</div>
    </div>
  );
}

function SetupWizard({
  controlState,
  onUpdate,
  csvState,
  onCsvChange,
  onImportPositions,
  onImportEmployees,
}: {
  controlState: ControlState;
  onUpdate: (updater: (prev: ControlState) => ControlState) => void;
  csvState: CsvState;
  onCsvChange: (next: Partial<CsvState>) => void;
  onImportPositions: () => void;
  onImportEmployees: () => void;
}) {
  const steps = [
    "Create Organization Structure",
    "Create Positions",
    "Assign Employees",
    "Upload Policies",
    "Invite Employees",
  ];

  const completeStep = (step: number) => {
    onUpdate((prev) => ({
      ...prev,
      setupState: {
        ...prev.setupState,
        currentStep: Math.max(prev.setupState.currentStep, step + 1),
        completedSteps: prev.setupState.completedSteps.includes(step)
          ? prev.setupState.completedSteps
          : [...prev.setupState.completedSteps, step],
        lastSavedAt: new Date().toISOString(),
      },
    }));
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
      <div style={cardStyle}>
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Initial Setup Flow</div>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 12 }}>
          Save & resume is local-first. The org remains usable while setup is in progress.
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {steps.map((title, index) => {
            const complete = controlState.setupState.completedSteps.includes(index + 1);
            const active = controlState.setupState.currentStep === index + 1;
            return (
              <div
                key={title}
                style={{
                  border: `1px solid ${active ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 10,
                  padding: "10px 12px",
                  background: active ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
                    Step {index + 1} · {title}
                  </div>
                  {complete ? (
                    <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700 }}>DONE</span>
                  ) : (
                    <button style={buttonBase} onClick={() => completeStep(index + 1)}>
                      Mark complete
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...cardStyle, display: "grid", gap: 10 }}>
        <div>
          <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Positions CSV Import (strict)</div>
          <textarea
            value={csvState.positionsCsv}
            onChange={(event) => onCsvChange({ positionsCsv: event.target.value })}
            placeholder={'positionTitle,department,reportingManager,isCriticalPosition\nFrontend Engineer,Engineering,Head of Engineering,false'}
            style={{ ...textInputStyle("100%"), minHeight: 120, resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <button style={buttonBase} onClick={onImportPositions}>Import positions</button>
            <span style={{ color: "#64748b", fontSize: 10 }}>Rejects invalid rows</span>
          </div>
          {csvState.positionErrors.length > 0 && (
            <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 10 }}>
              {csvState.positionErrors.map((error) => (
                <div key={error}>• {error}</div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ color: "#fff", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Employees CSV Import (strict)</div>
          <textarea
            value={csvState.employeesCsv}
            onChange={(event) => onCsvChange({ employeesCsv: event.target.value })}
            placeholder={'name,email,positionTitle\nJane Doe,jane@company.com,Frontend Engineer'}
            style={{ ...textInputStyle("100%"), minHeight: 120, resize: "vertical" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <button style={buttonBase} onClick={onImportEmployees}>Import employees</button>
            <span style={{ color: "#64748b", fontSize: 10 }}>Rejects unknown positionTitle</span>
          </div>
          {csvState.employeeErrors.length > 0 && (
            <div style={{ marginTop: 8, color: "#fca5a5", fontSize: 10 }}>
              {csvState.employeeErrors.map((error) => (
                <div key={error}>• {error}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PositionSlideOver({
  isOpen,
  onClose,
  detail,
  readinessExpanded,
  onToggleReadiness,
  onOpenAction,
  onViewProfile,
  onSetOoo,
  onClearOoo,
}: {
  isOpen: boolean;
  onClose: () => void;
  detail: ReturnType<typeof computeUIState>["positionDetail"];
  readinessExpanded: boolean;
  onToggleReadiness: () => void;
  onOpenAction: (actionId: string) => void;
  onViewProfile: () => void;
  onSetOoo: (endDate: string | null) => void;
  onClearOoo: () => void;
}) {
  if (!isOpen || !detail) return null;

  const employee = detail.employee;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        height: "100%",
        width: 420,
        background: "#151925",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "-10px 0 24px rgba(0,0,0,0.35)",
        display: "flex",
        flexDirection: "column",
        zIndex: 30,
      }}
    >
      <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>{detail.position.title}</div>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>{employee?.name ?? "Vacant"}</div>
        </div>
        <button style={buttonBase} onClick={onClose}>Close</button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 14, display: "grid", gap: 12 }}>
        <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Position Data</div>
            <div style={{ color: "#e2e8f0", fontSize: 12 }}>Position: {detail.position.title}</div>
            <div style={{ color: "#e2e8f0", fontSize: 12 }}>Department: {detail.position.department}</div>
            <div style={{ color: "#e2e8f0", fontSize: 12 }}>
              Reporting Manager: {detail.manager?.employee?.name ?? detail.manager?.position.title ?? "—"}
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 12 }}>
              Critical Position: {detail.position.isCriticalPosition ? "Yes" : "No"}
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 12 }}>Direct Reports: {detail.directReports.length}</div>
          </div>
          <div>
            <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Employee Data</div>
            {employee ? (
              <>
                <div style={{ color: "#e2e8f0", fontSize: 12 }}>Employee Name: {employee.name}</div>
                <div style={{ color: "#e2e8f0", fontSize: 12 }}>Joining Date: {employee.startDate}</div>
                <div style={{ color: "#e2e8f0", fontSize: 12 }}>Phone: {employee.phone || "—"}</div>
                <div style={{ color: "#e2e8f0", fontSize: 12 }}>Email: {employee.email || "—"}</div>
                <div style={{ color: "#e2e8f0", fontSize: 12 }}>Time Zone: {employee.timeZone || "—"}</div>
              </>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 12 }}>No employee is assigned to this position.</div>
            )}
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase" }}>Readiness Score</div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{detail.readiness.score}%</div>
            </div>
            <button style={buttonBase} onClick={onToggleReadiness}>{readinessExpanded ? "Hide checklist" : "Show checklist"}</button>
          </div>

          <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 11 }}>
            why this % → {detail.readiness.summaryText}
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
            {detail.readiness.components.map((component) => (
              <div key={component.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span style={{ color: "#94a3b8" }}>{component.label}</span>
                <span style={{ color: "#e2e8f0" }}>{component.completed}/{component.total}</span>
              </div>
            ))}
          </div>

          {readinessExpanded && (
            <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "grid", gap: 8 }}>
              {detail.missingItems.length === 0 ? (
                <div style={{ color: "#22c55e", fontSize: 11 }}>No missing items.</div>
              ) : (
                detail.missingItems.map((item) => (
                  <div key={item.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 8 }}>
                    <div style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.label}</div>
                    <div style={{ color: "#94a3b8", fontSize: 10 }}>{item.reason}</div>
                    <div style={{ color: "#64748b", fontSize: 10, marginTop: 4 }}>
                      Owner: {item.owner} · Due: {item.dueDate}
                    </div>
                    <button style={{ ...buttonBase, marginTop: 6 }} onClick={() => onOpenAction(item.actionId)}>
                      Open action
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {employee && (
          <div style={cardStyle}>
            <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 8 }}>Temporary OOO override</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="date"
                style={textInputStyle("100%")}
                onChange={(event) => onSetOoo(event.target.value ? `${event.target.value}T23:59:59Z` : null)}
              />
              <button style={buttonBase} onClick={() => onSetOoo(null)}>Set OOO</button>
              <button style={buttonBase} onClick={onClearOoo}>Clear</button>
            </div>
          </div>
        )}

        {employee && (
          <button style={{ ...buttonBase, background: "rgba(99,102,241,0.2)", borderColor: "rgba(99,102,241,0.45)", color: "#c7d2fe" }} onClick={onViewProfile}>
            View Full Profile
          </button>
        )}
      </div>
    </div>
  );
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState<NavId>("org");
  const [controlState, setControlState] = useState<ControlState>(() => loadControlState());
  const [actionDrafts, setActionDrafts] = useState<Record<string, ActionDraft>>({});
  const [csvState, setCsvState] = useState<CsvState>({
    positionsCsv: "",
    employeesCsv: "",
    positionErrors: [],
    employeeErrors: [],
  });

  const uiState = useMemo(() => computeUIState(SEED, controlState), [controlState]);

  useEffect(() => {
    saveControlState(controlState);
  }, [controlState]);

  const withControlUpdate = (updater: (prev: ControlState) => ControlState) => {
    setControlState((prev) => updater(prev));
  };

  const selectPosition = (positionId: string, employeeId: string | null) => {
    withControlUpdate((prev) => ({
      ...prev,
      selectedPositionId: positionId,
      selectedEmployeeId: employeeId,
      detailPanelOpen: true,
      focusPathOnly: prev.focusPathOnly,
      scenarioId: "DEFAULT_VIEW",
    }));
  };

  const openProfile = (employee: Employee, position: Position) => {
    withControlUpdate((prev) => ({
      ...prev,
      selectedEmployeeId: employee.id,
      selectedPositionId: position.id,
      detailPanelOpen: false,
    }));
    setActiveNav("profile");
  };

  const updateActionDraft = (actionId: string, patch: Partial<ActionDraft>) => {
    setActionDrafts((prev) => ({
      ...prev,
      [actionId]: {
        completedBy: prev[actionId]?.completedBy ?? "",
        evidence: prev[actionId]?.evidence ?? "",
        fileName: prev[actionId]?.fileName ?? "",
        ...patch,
      },
    }));
  };

  const completeAction = (action: ActionItem) => {
    const draft = actionDrafts[action.id] ?? { completedBy: "", evidence: "", fileName: "" };
    if (!draft.completedBy.trim()) {
      window.alert("Completed By is required.");
      return;
    }
    if (action.requiresUpload && !draft.fileName.trim()) {
      window.alert("This action requires an uploaded file.");
      return;
    }

    withControlUpdate((prev) => {
      let next = transitionAction(prev, {
        actionId: action.id,
        status: "completed",
        completedBy: draft.completedBy.trim(),
        evidence: draft.evidence.trim(),
        uploadedFileName: draft.fileName.trim(),
      });

      if (action.requiresUpload && draft.fileName.trim() && action.suggestedFileCategory && action.employeeId) {
        const now = new Date().toISOString();
        const uploaded: EmployeeDocument = {
          id: `upl-${Date.now()}-${action.id}`,
          employeeId: action.employeeId,
          positionId: action.positionId,
          scope: "employee",
          category: action.suggestedFileCategory,
          requirementLevel: "required",
          fileName: draft.fileName.trim(),
          uploadedAt: now,
          uploadedBy: draft.completedBy.trim(),
          status: "valid",
        };
        next = {
          ...next,
          uploadedDocuments: [...next.uploadedDocuments, uploaded],
          auditEvents: [
            {
              id: `audit-doc-${uploaded.id}`,
              type: "document_change",
              message: `${uploaded.category} uploaded for ${action.employeeName}`,
              timestamp: now,
              employeeId: action.employeeId,
              positionId: action.positionId,
            },
            ...next.auditEvents,
          ],
        };
      }

      return next;
    });
  };

  const moveAction = (actionId: string, status: "open" | "in_progress" | "archived") => {
    withControlUpdate((prev) => transitionAction(prev, { actionId, status }));
  };

  const exportCsv = () => {
    const rows = financeMatrix(uiState.financeRows);
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    download("teamframe-finance-report.csv", csv, "text/csv;charset=utf-8;");
  };

  const exportExcel = () => {
    const rows = financeMatrix(uiState.financeRows);
    const tsv = rows.map((row) => row.join("	")).join("\n");
    download("teamframe-finance-report.xls", tsv, "application/vnd.ms-excel");
  };

  const importPositions = () => {
    const result = importPositionsFromCsv(SEED, controlState, csvState.positionsCsv);
    setCsvState((prev) => ({ ...prev, positionErrors: result.errors }));
    if (result.imported.length === 0) return;
    withControlUpdate((prev) => ({
      ...prev,
      addedPositions: [...prev.addedPositions, ...result.imported],
      setupState: {
        ...prev.setupState,
        completedSteps: prev.setupState.completedSteps.includes(2)
          ? prev.setupState.completedSteps
          : [...prev.setupState.completedSteps, 2],
        currentStep: Math.max(prev.setupState.currentStep, 3),
        lastSavedAt: new Date().toISOString(),
      },
    }));
  };

  const importEmployees = () => {
    const result = importEmployeesFromCsv(SEED, controlState, csvState.employeesCsv);
    setCsvState((prev) => ({ ...prev, employeeErrors: result.errors }));
    if (result.imported.length === 0) return;
    withControlUpdate((prev) => ({
      ...prev,
      addedEmployees: [...prev.addedEmployees, ...result.imported],
      setupState: {
        ...prev.setupState,
        completedSteps: prev.setupState.completedSteps.includes(3)
          ? prev.setupState.completedSteps
          : [...prev.setupState.completedSteps, 3],
        currentStep: Math.max(prev.setupState.currentStep, 4),
        lastSavedAt: new Date().toISOString(),
      },
    }));
  };

  const publishPolicy = (policyId: string, nextVersion: number) => {
    withControlUpdate((prev) =>
      publishPolicyVersion(prev, {
        policyId,
        version: nextVersion,
        effectiveDate: new Date().toISOString().slice(0, 10),
        uploadedBy: "Operations Admin",
      }),
    );
  };

  const acknowledgePolicy = (policyId: string, employeeId: string, version: number) => {
    withControlUpdate((prev) => ({
      ...prev,
      policyAckOverrides: [
        ...prev.policyAckOverrides.filter(
          (item) => !(item.policyId === policyId && item.employeeId === employeeId && item.version === version),
        ),
        {
          policyId,
          employeeId,
          version,
          status: "acknowledged",
          acknowledgedAt: new Date().toISOString(),
          pendingSince: new Date().toISOString().slice(0, 10),
        },
      ],
    }));
  };

  const navLabel = NAV_ITEMS.find((item) => item.id === activeNav)?.label ?? "TeamFrame";
  const positionDetail = uiState.positionDetail;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: "#0f1117",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <aside
        style={{
          width: 230,
          borderRight: "1px solid rgba(255,255,255,0.08)",
          background: "#13161f",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>TeamFrame</div>
          <div style={{ color: "#64748b", fontSize: 10 }}>Org-First Operational Graph</div>
        </div>

        <nav style={{ flex: 1, paddingTop: 8 }}>
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeNav;
            const badge =
              item.id === "actions"
                ? uiState.pendingActions.length
                : item.id === "risk"
                ? uiState.risks.length
                : item.id === "audit"
                ? uiState.auditTimeline.length
                : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  borderLeft: `2px solid ${active ? "#6366f1" : "transparent"}`,
                  background: active ? "rgba(99,102,241,0.16)" : "none",
                  color: active ? "#c7d2fe" : "#64748b",
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {badge > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      borderRadius: 8,
                      padding: "1px 6px",
                      background: "rgba(99,102,241,0.8)",
                      color: "#fff",
                      fontWeight: 800,
                    }}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12 }}>
          <div style={{ color: "#64748b", fontSize: 10, marginBottom: 8 }}>Org Snapshot</div>
          <div style={{ color: "#e2e8f0", fontSize: 11 }}>Total Positions: {uiState.stats.totalPositions}</div>
          <div style={{ color: "#e2e8f0", fontSize: 11 }}>Filled Positions: {uiState.stats.filledPositions}</div>
          <div style={{ color: "#e2e8f0", fontSize: 11 }}>Vacant Positions: {uiState.stats.vacantPositions}</div>
          <div style={{ color: "#e2e8f0", fontSize: 11 }}>Employees Online: {uiState.stats.employeesOnline}</div>
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header
          style={{
            height: 58,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "#13161f",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
          }}
        >
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 800 }}>{navLabel}</h1>
            <div style={{ color: "#64748b", fontSize: 10 }}>Seed Data + Scenario + Compute Engine = UI State</div>
          </div>
          <button
            style={buttonBase}
            onClick={() =>
              withControlUpdate((prev) => ({
                ...prev,
                setupState: { ...prev.setupState, dismissed: !prev.setupState.dismissed },
              }))
            }
          >
            {controlState.setupState.dismissed ? "Show Setup" : "Hide Setup"}
          </button>
          <button
            style={buttonBase}
            onClick={() => {
              const reset = createDefaultControlState(SEED);
              setControlState(reset);
              setActiveNav("org");
            }}
          >
            Reset Demo
          </button>
        </header>

        <section style={{ flex: 1, overflow: "auto", padding: 14, position: "relative" }}>
          {!controlState.setupState.dismissed && (
            <div style={{ marginBottom: 14 }}>
              <SetupWizard
                controlState={controlState}
                onUpdate={withControlUpdate}
                csvState={csvState}
                onCsvChange={(next) => setCsvState((prev) => ({ ...prev, ...next }))}
                onImportPositions={importPositions}
                onImportEmployees={importEmployees}
              />
            </div>
          )}

          {activeNav === "org" && (
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ ...cardStyle, position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(8px)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {kpiMeta(uiState.stats).map((chip) => {
                    const active = controlState.activeKpiFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        onClick={() => withControlUpdate((prev) => ({ ...prev, activeKpiFilter: chip.id }))}
                        style={{
                          ...buttonBase,
                          background: active ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                          borderColor: active ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.12)",
                          color: active ? "#c7d2fe" : "#cbd5e1",
                        }}
                      >
                        {chip.label}: {chip.value}
                      </button>
                    );
                  })}
                  <button
                    style={buttonBase}
                    onClick={() => withControlUpdate((prev) => ({ ...prev, activeKpiFilter: "all" }))}
                  >
                    Reset filters
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={controlState.orgSearchQuery}
                    onChange={(event) =>
                      withControlUpdate((prev) => ({ ...prev, orgSearchQuery: event.target.value }))
                    }
                    placeholder="Search + highlight node"
                    style={textInputStyle(220)}
                  />

                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ color: "#64748b", fontSize: 10 }}>Collapse level</span>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        style={{
                          ...buttonBase,
                          padding: "5px 8px",
                          background:
                            controlState.collapseLevel === level ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                        }}
                        onClick={() => withControlUpdate((prev) => ({ ...prev, collapseLevel: level }))}
                      >
                        {level}
                      </button>
                    ))}
                  </div>

                  <button
                    style={buttonBase}
                    onClick={() => withControlUpdate((prev) => ({ ...prev, focusPathOnly: !prev.focusPathOnly }))}
                  >
                    {controlState.focusPathOnly ? "Disable focus path" : "Focus path (CEO → selected)"}
                  </button>

                  <span style={{ color: "#64748b", fontSize: 10 }}>
                    Highlights: {uiState.matchedPositionIds.length}
                  </span>
                </div>
              </div>

              {(uiState.emptyStates.firstOrgSetup ||
                uiState.emptyStates.noEmployees ||
                uiState.emptyStates.noPolicies ||
                uiState.emptyStates.noDocuments) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
                  {uiState.emptyStates.firstOrgSetup && (
                    <EmptyStateCard
                      title="First org setup"
                      body="Start with organization structure, then attach employees and policies."
                    />
                  )}
                  {uiState.emptyStates.noEmployees && (
                    <EmptyStateCard title="No employees" body="Attach employees to positions to activate readiness and risks." />
                  )}
                  {uiState.emptyStates.noPolicies && (
                    <EmptyStateCard title="No policies" body="Upload policy library items to drive acknowledgements." />
                  )}
                  {uiState.emptyStates.noDocuments && (
                    <EmptyStateCard title="No documents" body="Upload required employee/company documents to remove compliance risks." />
                  )}
                </div>
              )}

              <div
                style={{
                  ...cardStyle,
                  minHeight: "65vh",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  paddingTop: 24,
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {uiState.filteredOrgTree.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>No nodes match current filters.</div>
                ) : (
                  <OrgBranch
                    nodes={uiState.filteredOrgTree}
                    selectedPositionId={controlState.selectedPositionId}
                    onSelect={selectPosition}
                  />
                )}

                <PositionSlideOver
                  isOpen={controlState.detailPanelOpen}
                  detail={positionDetail}
                  readinessExpanded={controlState.readinessExpanded}
                  onToggleReadiness={() =>
                    withControlUpdate((prev) => ({ ...prev, readinessExpanded: !prev.readinessExpanded }))
                  }
                  onClose={() => withControlUpdate((prev) => ({ ...prev, detailPanelOpen: false }))}
                  onOpenAction={(actionId) => {
                    withControlUpdate((prev) => ({ ...prev, selectedActionId: actionId }));
                    setActiveNav("actions");
                  }}
                  onViewProfile={() => {
                    if (positionDetail?.employee) openProfile(positionDetail.employee, positionDetail.position);
                  }}
                  onSetOoo={(endDate) => {
                    const employeeId = positionDetail?.employee?.id;
                    if (!employeeId) return;
                    withControlUpdate((prev) =>
                      setTemporaryOoo(prev, {
                        employeeId,
                        endsAt: endDate,
                      }),
                    );
                  }}
                  onClearOoo={() => {
                    const employeeId = positionDetail?.employee?.id;
                    if (!employeeId) return;
                    withControlUpdate((prev) => clearTemporaryOoo(prev, employeeId));
                  }}
                />
              </div>
            </div>
          )}

          {activeNav === "directory" && (
            <div style={{ ...cardStyle, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Directory (derived from positions)</div>
                <input
                  value={controlState.employeeSearch}
                  onChange={(event) =>
                    withControlUpdate((prev) => ({ ...prev, employeeSearch: event.target.value }))
                  }
                  placeholder="Search employees"
                  style={textInputStyle(240)}
                />
              </div>
              {uiState.employeeDirectory.map((row) => {
                const employee = SEED.employees.concat(controlState.addedEmployees).find((item) => item.id === row.employeeId);
                const position = SEED.positions.concat(controlState.addedPositions).find((item) => item.id === row.positionId);
                return (
                  <button
                    key={row.employeeId}
                    style={{
                      ...buttonBase,
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                    onClick={() => {
                      if (employee && position) openProfile(employee, position);
                    }}
                  >
                    <span>
                      <span style={{ color: "#fff", fontWeight: 700 }}>{row.name}</span>
                      <span style={{ color: "#94a3b8" }}> · {row.positionTitle} · {row.department}</span>
                    </span>
                    <span style={{ color: "#64748b" }}>{row.managerName}</span>
                  </button>
                );
              })}
              {uiState.employeeDirectory.length === 0 && <div style={{ color: "#94a3b8" }}>No matching employees.</div>}
            </div>
          )}

          {activeNav === "profile" && (
            <div style={{ display: "grid", gap: 10 }}>
              {!uiState.selectedProfile ? (
                <EmptyStateCard title="No profile selected" body="Open a profile from Position Detail or Employee Directory." />
              ) : (
                <>
                  <div style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>{uiState.selectedProfile.employee.name}</div>
                      <div style={{ color: "#94a3b8", fontSize: 11 }}>
                        {uiState.selectedProfile.employee.employeeCode} · {uiState.selectedProfile.position.title}
                      </div>
                    </div>
                    <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{uiState.selectedProfile.readiness.score}% readiness</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(220px,1fr))", gap: 10 }}>
                    <div style={cardStyle}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Personal Information</div>
                      <div style={{ fontSize: 12 }}>Email: {uiState.selectedProfile.employee.email || "—"}</div>
                      <div style={{ fontSize: 12 }}>Phone: {uiState.selectedProfile.employee.phone || "—"}</div>
                      <div style={{ fontSize: 12 }}>Address: {uiState.selectedProfile.employee.address || "—"}</div>
                      <div style={{ fontSize: 12 }}>Nationality: {uiState.selectedProfile.employee.nationality || "—"}</div>
                    </div>

                    <div style={cardStyle}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Employment Information</div>
                      <div style={{ fontSize: 12 }}>Join Date: {uiState.selectedProfile.employee.startDate}</div>
                      <div style={{ fontSize: 12 }}>Employment Type: {uiState.selectedProfile.employee.employmentType}</div>
                      <div style={{ fontSize: 12 }}>Reporting Line: {uiState.selectedProfile.manager?.employee.name ?? "—"}</div>
                      <div style={{ fontSize: 12 }}>Direct Reports: {uiState.selectedProfile.directReports.length}</div>
                    </div>

                    <div style={cardStyle}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Bank + Salary</div>
                      <div style={{ fontSize: 12 }}>Salary: {uiState.selectedProfile.employee.currency} {uiState.selectedProfile.employee.salary.toLocaleString()}</div>
                      <div style={{ fontSize: 12 }}>Bank: {uiState.selectedProfile.employee.bankName || "—"}</div>
                      <div style={{ fontSize: 12 }}>Account: {uiState.selectedProfile.employee.bankAccount || "—"}</div>
                      <div style={{ fontSize: 12 }}>IBAN: {uiState.selectedProfile.employee.iban || "—"}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div style={cardStyle}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Documents + Compliance</div>
                      {uiState.selectedProfile.documentStatus.map((item) => (
                        <div key={item.category} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                          <span>{item.category}</span>
                          <span style={{ color: item.status === "compliant" ? "#22c55e" : item.status === "expired" ? "#f59e0b" : "#f87171" }}>
                            {item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={cardStyle}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Policy Acknowledgements</div>
                      {uiState.selectedProfile.policyStatus.map((item) => (
                        <div key={item.policyId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, marginBottom: 6 }}>
                          <span>{item.policyName} v{item.version}</span>
                          {item.status === "acknowledged" ? (
                            <span style={{ color: "#22c55e" }}>Acknowledged</span>
                          ) : (
                            <button style={buttonBase} onClick={() => acknowledgePolicy(item.policyId, uiState.selectedProfile!.employee.id, item.version)}>
                              Acknowledge
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeNav === "actions" && (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={cardStyle}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>
                  Action Lifecycle: open → in_progress → completed → archived
                </div>
                {uiState.pendingActions.length === 0 ? (
                  <div style={{ color: "#22c55e", fontSize: 12 }}>No open actions.</div>
                ) : (
                  uiState.pendingActions.map((action) => {
                    const draft = actionDrafts[action.id] ?? { completedBy: "", evidence: "", fileName: "" };
                    const highlighted = controlState.selectedActionId === action.id;
                    return (
                      <div
                        key={action.id}
                        style={{
                          border: `1px solid ${highlighted ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 8,
                          background: highlighted ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                        }}
                      >
                        <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{action.label}</div>
                        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>{action.detail}</div>
                        <div style={{ color: "#64748b", fontSize: 10, marginBottom: 8 }}>
                          {action.employeeName} · Due {action.dueDate} · {action.status}
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          <input
                            value={draft.completedBy}
                            onChange={(event) => updateActionDraft(action.id, { completedBy: event.target.value })}
                            placeholder="Completed by"
                            style={textInputStyle()}
                          />
                          <input
                            value={draft.evidence}
                            onChange={(event) => updateActionDraft(action.id, { evidence: event.target.value })}
                            placeholder="Evidence note"
                            style={textInputStyle()}
                          />
                          <input
                            value={draft.fileName}
                            onChange={(event) => updateActionDraft(action.id, { fileName: event.target.value })}
                            placeholder={action.requiresUpload ? "Upload file name (required)" : "Upload file name (optional)"}
                            style={textInputStyle()}
                          />
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          {action.status === "open" && (
                            <button style={buttonBase} onClick={() => moveAction(action.id, "in_progress")}>Start</button>
                          )}
                          {action.status === "in_progress" && (
                            <button style={buttonBase} onClick={() => moveAction(action.id, "open")}>Move to Open</button>
                          )}
                          <button style={buttonBase} onClick={() => completeAction(action)}>Complete</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={cardStyle}>
                <div style={{ color: "#fff", fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Completed / Archived History</div>
                {uiState.actionHistory.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>No historical actions yet.</div>
                ) : (
                  uiState.actionHistory.map((action) => (
                    <div
                      key={action.id}
                      style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 8, marginBottom: 8 }}
                    >
                      <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{action.label}</div>
                      <div style={{ color: "#64748b", fontSize: 10 }}>
                        Status: {action.status} · Completed By: {action.completedBy ?? "—"} · {action.completedAt ?? ""}
                      </div>
                      {action.status === "completed" && (
                        <button style={{ ...buttonBase, marginTop: 6 }} onClick={() => moveAction(action.id, "archived")}>
                          Archive
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeNav === "risk" && (
            <div style={cardStyle}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Rule-Based Risk Engine</div>
              <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 10 }}>
                Thresholds: Warning ≥ 7 days, Critical ≥ 14 days (policy pending). Cause → Impact → Action format.
              </div>
              {uiState.risks.map((risk) => (
                <div
                  key={risk.id}
                  style={{
                    border: `1px solid ${risk.severity === "critical" ? "rgba(239,68,68,0.4)" : "rgba(245,158,11,0.4)"}`,
                    borderRadius: 10,
                    padding: 10,
                    marginBottom: 8,
                    background: risk.severity === "critical" ? "rgba(239,68,68,0.08)" : "rgba(245,158,11,0.08)",
                  }}
                >
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                    {risk.positionTitle} · {risk.employeeName}
                  </div>
                  <div style={{ color: "#fca5a5", fontSize: 10 }}>Cause: {risk.cause}</div>
                  <div style={{ color: "#fdba74", fontSize: 10 }}>Impact: {risk.impact}</div>
                  <div style={{ color: "#a5b4fc", fontSize: 10 }}>Action: {risk.action}</div>
                </div>
              ))}
              {uiState.risks.length === 0 && <div style={{ color: "#22c55e" }}>No open risks.</div>}
            </div>
          )}

          {activeNav === "finance" && (
            <div style={{ ...cardStyle, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={controlState.financeSearch}
                  onChange={(event) =>
                    withControlUpdate((prev) => ({ ...prev, financeSearch: event.target.value }))
                  }
                  placeholder="Search finance rows"
                  style={textInputStyle(220)}
                />
                <button style={buttonBase} onClick={exportCsv}>CSV Export</button>
                <button style={buttonBase} onClick={exportExcel}>Excel Export</button>
                <button style={buttonBase} onClick={() => window.print()}>Print View</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {[
                        ["employeeCode", "Employee ID"],
                        ["name", "Employee Name"],
                        ["position", "Position"],
                        ["department", "Department"],
                        ["manager", "Manager"],
                        ["status", "Employment Status"],
                        ["salary", "Salary"],
                        ["currency", "Currency"],
                        ["bankName", "Bank Name"],
                        ["bankAccount", "Account Number"],
                        ["iban", "IBAN"],
                        ["startDate", "Join Date"],
                      ].map(([id, label]) => (
                        <th key={id} style={{ textAlign: "left", padding: "8px 6px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                          <button
                            style={{ ...buttonBase, border: "none", padding: 0, background: "none", color: "#cbd5e1" }}
                            onClick={() =>
                              withControlUpdate((prev) => ({
                                ...prev,
                                financeSortBy: id as ControlState["financeSortBy"],
                                financeSortDirection:
                                  prev.financeSortBy === id && prev.financeSortDirection === "asc" ? "desc" : "asc",
                              }))
                            }
                          >
                            {label}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uiState.financeRows.map((row) => (
                      <tr key={row.employeeId}>
                        <td style={{ padding: "6px" }}>{row.employeeId}</td>
                        <td style={{ padding: "6px" }}>{row.employeeName}</td>
                        <td style={{ padding: "6px" }}>{row.position}</td>
                        <td style={{ padding: "6px" }}>{row.department}</td>
                        <td style={{ padding: "6px" }}>{row.manager}</td>
                        <td style={{ padding: "6px" }}>{row.employmentStatus}</td>
                        <td style={{ padding: "6px" }}>{row.salary.toLocaleString()}</td>
                        <td style={{ padding: "6px" }}>{row.currency}</td>
                        <td style={{ padding: "6px" }}>{row.bankName}</td>
                        <td style={{ padding: "6px" }}>{row.accountNumber}</td>
                        <td style={{ padding: "6px" }}>{row.iban}</td>
                        <td style={{ padding: "6px" }}>{row.joinDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === "policies" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={cardStyle}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Policy Library</div>
                {uiState.policies.map((entry) => (
                  <div key={entry.policy.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>
                      {entry.policy.name} · v{entry.policy.version}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 10 }}>
                      Effective: {entry.policy.effectiveDate} · Uploaded by {entry.policy.uploadedBy}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 4 }}>
                      Acknowledged: {entry.acknowledgedCount} · Pending: {entry.pendingCount}
                    </div>
                    <button
                      style={{ ...buttonBase, marginTop: 6 }}
                      onClick={() => publishPolicy(entry.policy.id, entry.policy.version + 1)}
                    >
                      Publish v{entry.policy.version + 1}
                    </button>
                  </div>
                ))}
              </div>

              <div style={cardStyle}>
                <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Policy reset behavior</div>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>
                  Version updates reset acknowledgements only for applicable roles/regions. Prior versions remain in audit history.
                </div>
                <div style={{ marginTop: 10, color: "#64748b", fontSize: 11 }}>
                  Applicable role/region filtering is computed from Position.department and Employee.region.
                </div>
              </div>
            </div>
          )}

          {activeNav === "audit" && (
            <div style={cardStyle}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 800, marginBottom: 8 }}>Lightweight Audit Timeline</div>
              {uiState.auditTimeline.length === 0 ? (
                <div style={{ color: "#94a3b8" }}>No events yet.</div>
              ) : (
                uiState.auditTimeline.map((event: AuditEvent) => (
                  <div key={event.id} style={{ borderLeft: "2px solid rgba(99,102,241,0.5)", paddingLeft: 10, marginBottom: 10 }}>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{event.message}</div>
                    <div style={{ color: "#64748b", fontSize: 10 }}>
                      {event.type} · {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeNav === "setup" && (
            <SetupWizard
              controlState={controlState}
              onUpdate={withControlUpdate}
              csvState={csvState}
              onCsvChange={(next) => setCsvState((prev) => ({ ...prev, ...next }))}
              onImportPositions={importPositions}
              onImportEmployees={importEmployees}
            />
          )}
        </section>
      </main>
    </div>
  );
}
