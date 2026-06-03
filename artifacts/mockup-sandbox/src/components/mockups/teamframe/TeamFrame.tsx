import { useMemo, useState } from "react";
import { SEED, type EmploymentStatusId } from "../../../teamframe/data/seed";
import { type ControlState, type OrgNode, computeUIState } from "../../../teamframe/engine/compute";

type NavId = "org" | "people" | "actions" | "risks" | "policies" | "finance" | "administration";
type AdminTabId = "organization-setup" | "csv-imports" | "configuration" | "audit-timeline";

const NAV_ITEMS: { id: NavId; label: string; icon: string }[] = [
  { id: "org", label: "Organization Map", icon: "⬡" },
  { id: "people", label: "People", icon: "◉" },
  { id: "actions", label: "Actions", icon: "⚡" },
  { id: "risks", label: "Risks", icon: "🔥" },
  { id: "policies", label: "Policies", icon: "📚" },
  { id: "finance", label: "Finance", icon: "≡" },
  { id: "administration", label: "Administration", icon: "⚙" },
];

const ADMIN_TABS: { id: AdminTabId; label: string }[] = [
  { id: "organization-setup", label: "Organization Setup" },
  { id: "csv-imports", label: "CSV Imports" },
  { id: "configuration", label: "Configuration" },
  { id: "audit-timeline", label: "Audit Timeline" },
];

const cardStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
};

function statusColor(status: EmploymentStatusId | "vacant"): string {
  if (status === "vacant") return "#94a3b8";
  return SEED.config.employmentStatuses.find((item) => item.id === status)?.dotColor ?? "#94a3b8";
}

function statusLabel(status: EmploymentStatusId | "vacant"): string {
  if (status === "vacant") return "Vacant";
  return SEED.config.employmentStatuses.find((item) => item.id === status)?.label ?? status;
}

function StatusDot({ status }: { status: EmploymentStatusId | "vacant" }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: statusColor(status), display: "inline-block", flexShrink: 0 }} />;
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
  return (
    <button
      onClick={() => onSelect(node.position.id, node.employee?.id ?? null)}
      style={{
        ...cardStyle,
        width: 180,
        borderColor: selected ? "#6366f1" : "rgba(255,255,255,0.1)",
        background: selected ? "rgba(99,102,241,0.17)" : "rgba(255,255,255,0.03)",
        padding: "10px 11px",
        textAlign: "left",
        cursor: "pointer",
      }}
      title={`${node.position.title} · ${node.employee?.name ?? "Vacant"}`}
    >
      <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{node.position.title}</div>
      <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>{node.employee?.name ?? "Vacant"}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <StatusDot status={node.employee?.status ?? "vacant"} />
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

function PositionPanel({
  uiState,
  onClose,
  onOpenProfile,
}: {
  uiState: ReturnType<typeof computeUIState>;
  onClose: () => void;
  onOpenProfile: (employeeId: string) => void;
}) {
  const selectedPosition = uiState.selectedPosition;
  if (!selectedPosition) return null;

  return (
    <aside style={{ position: "absolute", right: 0, top: 0, width: 340, height: "100%", background: "#161b27", borderLeft: "1px solid rgba(255,255,255,0.1)", padding: 12, overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>{selectedPosition.title}</div>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>{uiState.selectedEmployee?.name ?? "Vacant"}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}>×</button>
      </div>

      <div style={{ ...cardStyle, padding: 10 }}>
        <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Position</div>
        <div style={{ fontSize: 12 }}>Department: {selectedPosition.department}</div>
        <div style={{ fontSize: 12 }}>Status: {statusLabel(uiState.selectedEmployee?.status ?? "vacant")}</div>
      </div>

      <div style={{ ...cardStyle, padding: 10, marginTop: 10 }}>
        <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase" }}>Readiness</div>
        <div style={{ color: "#fff", fontSize: 28, fontWeight: 800 }}>{uiState.selectedProfile?.readinessScore ?? 0}%</div>
        <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginTop: 8 }}>Missing Items</div>
        <ul style={{ margin: "6px 0 0 16px", padding: 0, color: "#cbd5e1", fontSize: 12 }}>
          {(uiState.selectedProfile?.missingItems ?? []).length === 0
            ? <li>None</li>
            : (uiState.selectedProfile?.missingItems ?? []).map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>

      {uiState.selectedEmployee && (
        <button
          onClick={() => onOpenProfile(uiState.selectedEmployee!.id)}
          style={{
            width: "100%",
            marginTop: 10,
            borderRadius: 8,
            padding: "8px 10px",
            border: "1px solid rgba(99,102,241,0.45)",
            background: "rgba(99,102,241,0.16)",
            color: "#c7d2fe",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          View Full Profile
        </button>
      )}
    </aside>
  );
}

function ProfileView({ profile }: { profile: ReturnType<typeof computeUIState>["selectedProfile"] }) {
  if (!profile) {
    return <div style={{ ...cardStyle, padding: 12, color: "#94a3b8" }}>Select an employee to open full profile.</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ ...cardStyle, padding: 12 }}>
        <div style={{ color: "#fff", fontSize: 16, fontWeight: 800 }}>{profile.employee.name}</div>
        <div style={{ color: "#94a3b8", fontSize: 11 }}>{profile.employee.employeeCode} · {profile.position.title} · {profile.position.department}</div>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(220px, 1fr))" }}>
        <div style={{ ...cardStyle, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Work Contact</div>
          <div style={{ fontSize: 12 }}>Email: {profile.employee.workContact.email}</div>
          <div style={{ fontSize: 12 }}>Phone: {profile.employee.workContact.phone}</div>
          {profile.employee.workContact.extension && <div style={{ fontSize: 12 }}>Extension: {profile.employee.workContact.extension}</div>}
        </div>

        <div style={{ ...cardStyle, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Personal Contact</div>
          <div style={{ fontSize: 12 }}>Mobile: {profile.employee.personalContact.mobile}</div>
          {profile.employee.personalContact.personalEmail && <div style={{ fontSize: 12 }}>Personal Email: {profile.employee.personalContact.personalEmail}</div>}
        </div>

        <div style={{ ...cardStyle, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Emergency Contacts</div>
          {profile.employee.emergencyContacts.map((contact) => (
            <div key={`${contact.name}-${contact.phone}`} style={{ marginBottom: 8, fontSize: 12 }}>
              <div style={{ color: "#fff", fontWeight: 700 }}>{contact.name}</div>
              <div>{contact.relationship} · {contact.phone}</div>
              {contact.email && <div>{contact.email}</div>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
        <div style={{ ...cardStyle, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Compensation Components</div>
          {profile.compensationComponents.map((component) => (
            <div key={component.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span>{component.label}</span>
              <span>{component.currency} {component.amount.toLocaleString()}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
            <span>Total Compensation</span>
            <span>{profile.compensationComponents[0]?.currency ?? "USD"} {profile.totalCompensation.toLocaleString()}</span>
          </div>
        </div>

        <div style={{ ...cardStyle, padding: 10 }}>
          <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Reporting</div>
          <div style={{ fontSize: 12 }}>Reports To: {profile.managerName}</div>
          <div style={{ fontSize: 12 }}>Direct Reports: {profile.directReports.length}</div>
        </div>
      </div>
    </div>
  );
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState<NavId>("org");
  const [peopleMode, setPeopleMode] = useState<"directory" | "profile">("directory");
  const [adminTab, setAdminTab] = useState<AdminTabId>("organization-setup");
  const [directorySearch, setDirectorySearch] = useState("");
  const [financeSearch, setFinanceSearch] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const [controlState, setControlState] = useState<ControlState>({
    scenarioId: "DEFAULT_VIEW",
    selectedPositionId: "1-001",
    selectedEmployeeId: "e-001",
    resolvedActions: [],
    positionEdits: [],
    onboardingCompleted: [],
  });

  const uiState = useMemo(() => computeUIState(SEED, controlState), [controlState]);

  const selectPosition = (positionId: string, employeeId: string | null) => {
    setControlState((prev) => ({ ...prev, selectedPositionId: positionId, selectedEmployeeId: employeeId }));
    setDetailOpen(true);
  };

  const openProfile = (employeeId: string) => {
    const employee = SEED.employees.find((item) => item.id === employeeId);
    if (!employee) return;
    setControlState((prev) => ({ ...prev, selectedEmployeeId: employee.id, selectedPositionId: employee.positionId }));
    setPeopleMode("profile");
    setActiveNav("people");
    setDetailOpen(false);
  };

  const directoryRows = uiState.employeeDirectory.filter((row) => {
    const query = directorySearch.trim().toLowerCase();
    if (!query) return true;
    return `${row.employeeName} ${row.positionTitle} ${row.department} ${row.email} ${row.phone} ${row.managerName}`.toLowerCase().includes(query);
  });

  const financeRows = uiState.financeRows.filter((row) => {
    const query = financeSearch.trim().toLowerCase();
    if (!query) return true;
    return `${row.employeeId} ${row.employeeName} ${row.position} ${row.department} ${row.manager}`.toLowerCase().includes(query);
  });

  const navTitle = NAV_ITEMS.find((item) => item.id === activeNav)?.label ?? "TeamFrame";

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <aside style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.1)", background: "#13161f", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 14px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>TeamFrame</div>
          <div style={{ color: "#64748b", fontSize: 10 }}>Operational Workspace</div>
        </div>
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.id;
            const badge = item.id === "actions" ? uiState.actions.length : item.id === "risks" ? uiState.risks.length : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  width: "100%",
                  border: "none",
                  textAlign: "left",
                  borderLeft: `2px solid ${active ? "#6366f1" : "transparent"}`,
                  background: active ? "rgba(99,102,241,0.15)" : "none",
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
                {badge > 0 && <span style={{ fontSize: 9, background: "rgba(99,102,241,0.75)", color: "#fff", borderRadius: 8, padding: "1px 6px" }}>{badge}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.1)", background: "#13161f", display: "flex", alignItems: "center", padding: "0 14px" }}>
          <h1 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 800 }}>{navTitle}</h1>
        </header>

        <section style={{ flex: 1, overflow: "auto", padding: 14, position: "relative" }}>
          {activeNav === "org" && (
            <div style={{ display: "grid", gap: 12, height: "100%" }}>
              <div style={{ ...cardStyle, padding: 10, display: "grid", gridTemplateColumns: "repeat(5, minmax(130px, 1fr))", gap: 8 }}>
                {[
                  { label: "Total Positions", value: uiState.stats.totalPositions },
                  { label: "Filled Positions", value: uiState.stats.filledPositions },
                  { label: "Vacant Positions", value: uiState.stats.vacantPositions },
                  { label: "Open Risks", value: uiState.stats.openRisks },
                  { label: "Open Actions", value: uiState.stats.openActions },
                ].map((item) => (
                  <div key={item.label} style={{ ...cardStyle, padding: 8 }}>
                    <div style={{ color: "#64748b", fontSize: 10 }}>{item.label}</div>
                    <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ ...cardStyle, minHeight: "78vh", position: "relative", paddingTop: 22 }}>
                <OrgTree nodes={uiState.orgTree} selectedPositionId={controlState.selectedPositionId} onSelect={selectPosition} />
                {detailOpen && <PositionPanel uiState={uiState} onClose={() => setDetailOpen(false)} onOpenProfile={openProfile} />}
              </div>
            </div>
          )}

          {activeNav === "people" && (
            <div style={{ display: "grid", gap: 10 }}>
              {peopleMode === "directory" && (
                <div style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>Employee Directory</div>
                    <input
                      value={directorySearch}
                      onChange={(event) => setDirectorySearch(event.target.value)}
                      placeholder="Search employees"
                      style={{ width: 220, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.03)", color: "#e2e8f0", padding: "7px 9px", fontSize: 11, outline: "none" }}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {directoryRows.map((row) => (
                      <button
                        key={row.employeeId}
                        onClick={() => openProfile(row.employeeId)}
                        style={{ ...cardStyle, width: "100%", cursor: "pointer", padding: 10, textAlign: "left", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1.3fr 1fr 1.3fr auto", gap: 8, alignItems: "center" }}
                      >
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{row.employeeName}</span>
                        <span style={{ fontSize: 11 }}>{row.positionTitle}</span>
                        <span style={{ fontSize: 11 }}>{row.department}</span>
                        <span style={{ fontSize: 11 }}>{row.email}</span>
                        <span style={{ fontSize: 11 }}>{row.phone}</span>
                        <span style={{ fontSize: 11 }}>Reports To: {row.managerName}</span>
                        <StatusDot status={row.status} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {peopleMode === "profile" && (
                <>
                  <button onClick={() => setPeopleMode("directory")} style={{ ...cardStyle, width: 190, cursor: "pointer", padding: "8px 10px", textAlign: "left", color: "#cbd5e1", fontSize: 11 }}>
                    ← Back to directory
                  </button>
                  <ProfileView profile={uiState.selectedProfile} />
                </>
              )}
            </div>
          )}

          {activeNav === "actions" && (
            <div style={{ ...cardStyle, padding: 12 }}>
              {uiState.actions.map((action) => (
                <div key={action.id} style={{ ...cardStyle, padding: 10, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{action.label}</div>
                    <div style={{ color: "#94a3b8", fontSize: 11 }}>{action.dueIn}</div>
                  </div>
                  <button
                    onClick={() => setControlState((prev) => ({ ...prev, resolvedActions: [...prev.resolvedActions, action.id, action.relatedSignalId ?? ""] }))}
                    style={{ borderRadius: 8, border: "1px solid rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.15)", color: "#4ade80", cursor: "pointer", fontSize: 11, padding: "6px 10px" }}
                  >
                    Complete
                  </button>
                </div>
              ))}
              {uiState.actions.length === 0 && <div style={{ color: "#22c55e", fontSize: 12 }}>No open actions.</div>}
            </div>
          )}

          {activeNav === "risks" && (
            <div style={{ ...cardStyle, padding: 12 }}>
              {uiState.risks.map((risk) => (
                <div key={`${risk.positionId}-${risk.message}`} style={{ ...cardStyle, padding: 10, marginBottom: 8 }}>
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{risk.positionTitle}</div>
                  <div style={{ color: risk.level === "critical" ? "#fca5a5" : "#fcd34d", fontSize: 11 }}>{risk.message}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{risk.detail}</div>
                </div>
              ))}
            </div>
          )}

          {activeNav === "policies" && (
            <div style={{ ...cardStyle, padding: 12 }}>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Policy Categories</div>
              <ul style={{ margin: 0, paddingLeft: 16, color: "#cbd5e1", fontSize: 12 }}>
                {SEED.config.policyCategories.map((category) => <li key={category}>{category}</li>)}
              </ul>
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
                  style={{ width: 220, borderRadius: 8, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.03)", color: "#e2e8f0", padding: "7px 9px", fontSize: 11, outline: "none" }}
                />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {["Employee ID", "Employee Name", "Position", "Department", "Manager", "Status", "Compensation", "Currency", "Bank", "Account", "IBAN", "Join Date"].map((header) => (
                        <th key={header} style={{ textAlign: "left", padding: "7px 6px", borderBottom: "1px solid rgba(255,255,255,0.16)", color: "#94a3b8", whiteSpace: "nowrap" }}>{header}</th>
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
                        <td style={{ padding: 6 }}>{row.totalCompensation.toLocaleString()}</td>
                        <td style={{ padding: 6 }}>{row.currency}</td>
                        <td style={{ padding: 6 }}>{row.bankName}</td>
                        <td style={{ padding: 6 }}>{row.accountNumber}</td>
                        <td style={{ padding: 6 }}>{row.iban}</td>
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
                      border: `1px solid ${adminTab === tab.id ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.14)"}`,
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
                <div style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>Organization Setup</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Org structure and setup activities are managed only in Administration.</div>
                </div>
              )}

              {adminTab === "csv-imports" && (
                <div style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>CSV Imports</div>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ ...cardStyle, padding: 10, color: "#94a3b8", fontSize: 11 }}>
                      Positions CSV: positionTitle, department, reportingManager, criticalPosition(optional)
                    </div>
                    <div style={{ ...cardStyle, padding: 10, color: "#94a3b8", fontSize: 11 }}>
                      Employees CSV: name, email, positionTitle, status, manager
                    </div>
                  </div>
                </div>
              )}

              {adminTab === "configuration" && (
                <div style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>System Configuration</div>
                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(240px, 1fr))" }}>
                    <div style={{ ...cardStyle, padding: 10 }}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Employment Statuses</div>
                      {SEED.config.employmentStatuses.map((item) => <div key={item.id} style={{ fontSize: 12 }}>{item.label}</div>)}
                    </div>
                    <div style={{ ...cardStyle, padding: 10 }}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Document Types</div>
                      {SEED.config.documentTypes.map((item) => <div key={item} style={{ fontSize: 12 }}>{item}</div>)}
                    </div>
                    <div style={{ ...cardStyle, padding: 10 }}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Policy Categories</div>
                      {SEED.config.policyCategories.map((item) => <div key={item} style={{ fontSize: 12 }}>{item}</div>)}
                    </div>
                    <div style={{ ...cardStyle, padding: 10 }}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Compensation Components</div>
                      {SEED.config.compensationComponentTemplates.map((item) => <div key={item} style={{ fontSize: 12 }}>{item}</div>)}
                    </div>
                    <div style={{ ...cardStyle, padding: 10 }}>
                      <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", marginBottom: 6 }}>Risk Categories</div>
                      {SEED.config.riskCategories.map((item) => <div key={item} style={{ fontSize: 12 }}>{item}</div>)}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === "audit-timeline" && (
                <div style={{ ...cardStyle, padding: 12 }}>
                  <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>Audit Timeline</div>
                  {[...controlState.resolvedActions.map((id) => `Action completed: ${id}`), ...controlState.positionEdits.map((item) => `Position updated: ${item.title}`)].map((line, index) => (
                    <div key={`${line}-${index}`} style={{ color: "#cbd5e1", fontSize: 12, marginBottom: 5 }}>{line}</div>
                  ))}
                  {controlState.resolvedActions.length === 0 && controlState.positionEdits.length === 0 && (
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
