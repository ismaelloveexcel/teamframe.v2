import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SEED, type EmployeeDocument } from "../../../teamframe/data/seed";
import {
  type ActionWorkflow,
  type CompletedActionRecord,
  type ComplianceItem,
  type ControlState,
  type DocumentsRepositoryEmployee,
  type EmployeeDirectoryRow,
  type EmployeeProfileView,
  type FinanceReportRow,
  type FinanceSortBy,
  type OrgNode,
  type UIState,
  computeUIState,
} from "../../../teamframe/engine/compute";

const SCENARIO_LABELS: Record<string, string> = {
  DEFAULT_VIEW: "Default",
  VACANT_POSITION_FOCUS: "Vacant Position",
  ON_LEAVE_EMPLOYEE_FOCUS: "On Leave",
  OFFBOARDING_EMPLOYEE_FOCUS: "Offboarding",
  MISSING_COMPLIANCE_FOCUS: "Compliance Gap",
  FULL_ORGANIZATION_VIEW: "Full Org",
};

type NavItem = {
  id: string;
  label: string;
  icon: string;
  badge?: "risk" | "actions" | "compliance" | "documents";
};

const NAV_ITEMS: NavItem[] = [
  { id: "profile", label: "Employee Profile", icon: "◎" },
  { id: "org", label: "Org Chart", icon: "⬡" },
  { id: "employees", label: "Employee Directory", icon: "◉" },
  { id: "risk", label: "Risk Heatmap", icon: "🔥", badge: "risk" },
  { id: "actions", label: "Actions", icon: "⚡", badge: "actions" },
  { id: "compliance", label: "Compliance", icon: "✓", badge: "compliance" },
  { id: "documents", label: "Documents", icon: "📁", badge: "documents" },
  { id: "reports", label: "Finance Report", icon: "≡" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

type ActionDraft = {
  fileName: string;
  evidence: string;
  completedBy: string;
};

const inputStyle: CSSProperties = {
  borderRadius: 7,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "#e2e8f0",
  fontSize: 11,
  padding: "7px 9px",
  outline: "none",
};

function Avatar({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.34,
        border: "2px solid rgba(255,255,255,0.16)",
      }}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "on_leave" | "offboarding" | "vacant" | "compliant" | "missing" | "expired" }) {
  const styles: Record<string, { fg: string; bg: string; label: string }> = {
    active: { fg: "#22c55e", bg: "rgba(34,197,94,0.14)", label: "Active" },
    on_leave: { fg: "#f59e0b", bg: "rgba(245,158,11,0.14)", label: "On Leave" },
    offboarding: { fg: "#ef4444", bg: "rgba(239,68,68,0.14)", label: "Offboarding" },
    vacant: { fg: "#94a3b8", bg: "rgba(148,163,184,0.14)", label: "Vacant" },
    compliant: { fg: "#22c55e", bg: "rgba(34,197,94,0.14)", label: "Compliant" },
    missing: { fg: "#ef4444", bg: "rgba(239,68,68,0.14)", label: "Missing" },
    expired: { fg: "#f59e0b", bg: "rgba(245,158,11,0.14)", label: "Expired" },
  };
  const style = styles[status];
  return (
    <span style={{ color: style.fg, background: style.bg, borderRadius: 10, fontSize: 10, padding: "2px 8px", fontWeight: 700 }}>
      {style.label}
    </span>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, background: "rgba(255,255,255,0.03)", padding: 14 }}>
      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "5px 0" }}>
      <span style={{ color: "#64748b", fontSize: 10 }}>{label}</span>
      <span style={{ color: "#e2e8f0", fontSize: 10, textAlign: "right" }}>{value}</span>
    </div>
  );
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
  const border =
    selected
      ? "#6366f1"
      : node.signalLevel === "critical"
      ? "rgba(239,68,68,0.5)"
      : node.signalLevel === "warning"
      ? "rgba(245,158,11,0.5)"
      : "rgba(255,255,255,0.12)";
  return (
    <button
      onClick={() => onSelect(node.position.id, node.employee?.id ?? null)}
      style={{
        width: 158,
        borderRadius: 10,
        border: `1px solid ${border}`,
        background: selected ? "rgba(99,102,241,0.16)" : "rgba(255,255,255,0.04)",
        textAlign: "left",
        padding: "9px 10px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {node.employee ? (
          <Avatar initials={node.employee.avatarInitials} color={node.employee.avatarColor} size={28} />
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>?</div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "#fff", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.employee?.name ?? "Vacant"}
          </div>
          <div style={{ fontSize: 9, color: "#64748b" }}>{node.employee?.employeeCode ?? "UNASSIGNED"}</div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#cbd5e1" }}>{node.position.title}</div>
      <div style={{ fontSize: 9, color: "#64748b" }}>{node.position.department}</div>
    </button>
  );
}

function OrgView({ uiState, onSelect }: { uiState: UIState; onSelect: (positionId: string, employeeId: string | null) => void }) {
  const root = uiState.orgTree[0];
  if (!root) return <div style={{ color: "#64748b" }}>No org data.</div>;
  return (
    <div style={{ minWidth: 900, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <OrgNodeCard node={root} selectedPositionId={uiState.selectedPosition?.id ?? ""} onSelect={onSelect} />
      <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)" }} />
      <div style={{ display: "flex", gap: 14 }}>
        {root.children.map((child) => (
          <div key={child.position.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <OrgNodeCard node={child} selectedPositionId={uiState.selectedPosition?.id ?? ""} onSelect={onSelect} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 420 }}>
              {child.children.map((grandChild) => (
                <OrgNodeCard key={grandChild.position.id} node={grandChild} selectedPositionId={uiState.selectedPosition?.id ?? ""} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileView({ profile }: { profile: EmployeeProfileView | null }) {
  if (!profile) return <div style={{ color: "#64748b" }}>Select an employee to open a full profile.</div>;
  const e = profile.employee;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
        <Avatar initials={e.avatarInitials} color={e.avatarColor} size={50} />
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 800 }}>{e.name}</div>
          <div style={{ color: "#94a3b8", fontSize: 11 }}>
            {e.employeeCode} · {profile.position.title} · {profile.position.department}
          </div>
        </div>
        <StatusBadge status={e.status} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Card title="1. Personal Information">
          <Row label="Employee ID" value={e.employeeCode} />
          <Row label="Email" value={e.email} />
          <Row label="Phone" value={e.phone} />
          <Row label="DOB" value={e.dateOfBirth} />
          <Row label="Nationality" value={e.nationality} />
          <Row label="Address" value={e.address} />
        </Card>
        <Card title="2. Employment Information">
          <Row label="Position" value={profile.position.title} />
          <Row label="Department" value={profile.position.department} />
          <Row label="Type" value={e.employmentType === "full_time" ? "Full Time" : "Contractor"} />
          <Row label="Join Date" value={e.startDate} />
          <Row label="Location" value={e.location} />
          <Row label="Status" value={e.status.replace("_", " ")} />
        </Card>
        <Card title="3. Reporting Line">
          <Row label="Manager" value={profile.manager?.employee.name ?? "None"} />
          <Row label="Manager Title" value={profile.manager?.position.title ?? "None"} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Card title="4. Direct Reports">
          {profile.directReports.length === 0 && <div style={{ fontSize: 10, color: "#64748b" }}>No direct reports.</div>}
          {profile.directReports.map((report) => (
            <Row key={report.employee.id} label={report.employee.name} value={report.position.title} />
          ))}
        </Card>
        <Card title="5. Documents">
          {profile.documents.length === 0 && <div style={{ fontSize: 10, color: "#64748b" }}>No documents uploaded.</div>}
          {profile.documents.map((doc) => (
            <Row key={doc.id} label={doc.category} value={`${doc.fileName} (${doc.status})`} />
          ))}
        </Card>
        <Card title="6. Compliance Status">
          <Row label="Compliant" value={`${profile.complianceSummary.compliant}`} />
          <Row label="Missing" value={`${profile.complianceSummary.missing}`} />
          <Row label="Expired" value={`${profile.complianceSummary.expired}`} />
          {profile.documentStatus.map((status) => (
            <Row key={status.category} label={status.category} value={status.status} />
          ))}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Card title="7. Bank Details">
          <Row label="Bank Name" value={e.bankName} />
          <Row label="Account Number" value={e.bankAccount} />
          <Row label="IBAN" value={e.iban} />
        </Card>
        <Card title="8. Salary Information">
          <Row label="Salary" value={`${e.salary.toLocaleString()}`} />
          <Row label="Currency" value={e.currency} />
          <Row label="Mode" value="Read-only" />
        </Card>
        <Card title="9. Onboarding Status">
          <Row label="Status" value={profile.onboarding.status.replace("_", " ")} />
          <Row label="Progress" value={`${profile.onboarding.progress}%`} />
          <Row label="Updated" value={profile.onboarding.updatedAt} />
          <div style={{ height: 8, borderRadius: 4, background: "rgba(255,255,255,0.1)", marginTop: 8 }}>
            <div style={{ width: `${profile.onboarding.progress}%`, height: "100%", borderRadius: 4, background: "linear-gradient(90deg,#6366f1,#22c55e)" }} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function DirectoryView({
  rows,
  search,
  onSearchChange,
  onOpenProfile,
}: {
  rows: EmployeeDirectoryRow[];
  search: string;
  onSearchChange: (value: string) => void;
  onOpenProfile: (employeeId: string, positionId: string) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Search employee, manager, department..." style={{ ...inputStyle, width: 320 }} />
        <span style={{ color: "#64748b", fontSize: 10 }}>{rows.length} employees</span>
      </div>
      {rows.map((row) => (
        <div key={row.employeeId} style={{ display: "grid", gridTemplateColumns: "160px 120px 150px 150px 90px 120px 100px", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, background: "rgba(255,255,255,0.03)", padding: "9px 10px", marginBottom: 7 }}>
          <span style={{ color: "#fff", fontSize: 11 }}>{row.name}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{row.employeeCode}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{row.positionTitle}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{row.managerName}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{row.location}</span>
          <span><StatusBadge status={row.status} /></span>
          <button onClick={() => onOpenProfile(row.employeeId, row.positionId)} style={{ ...buttonPrimary, fontSize: 10 }}>Open Profile</button>
        </div>
      ))}
    </div>
  );
}

function ComplianceView({
  items,
  onOpenProfile,
}: {
  items: ComplianceItem[];
  onOpenProfile: (employeeId: string, positionId: string) => void;
}) {
  return (
    <div>
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 10 }}>Compliance is fully document-driven.</div>
      {items.map((item) => (
        <div key={item.id} style={{ display: "grid", gridTemplateColumns: "90px 110px 170px 170px 180px 1fr 100px", alignItems: "center", gap: 8, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, background: "rgba(255,255,255,0.03)", padding: "9px 10px", marginBottom: 7 }}>
          <StatusBadge status={item.status} />
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{item.employeeCode}</span>
          <span style={{ color: "#e2e8f0", fontSize: 10 }}>{item.employeeName}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{item.positionTitle}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{item.category}</span>
          <span style={{ color: "#94a3b8", fontSize: 10 }}>{item.detail}</span>
          <button onClick={() => onOpenProfile(item.employeeId, item.positionId)} style={{ ...buttonPrimary, fontSize: 10 }}>Open</button>
        </div>
      ))}
    </div>
  );
}

function DocumentsView({
  rows,
  onOpenProfile,
}: {
  rows: DocumentsRepositoryEmployee[];
  onOpenProfile: (employeeId: string) => void;
}) {
  return (
    <div>
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 10 }}>Documents are source of truth for compliance, actions, and risk.</div>
      {rows.map((item) => (
        <div key={item.employeeId} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, background: "rgba(255,255,255,0.03)", padding: "10px 11px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{item.employeeName}</div>
              <div style={{ color: "#64748b", fontSize: 9 }}>{item.employeeCode} · {item.positionTitle}</div>
            </div>
            <span style={{ color: "#ef4444", fontSize: 10, marginRight: 10 }}>Missing {item.missingCount}</span>
            <span style={{ color: "#f59e0b", fontSize: 10, marginRight: 10 }}>Expired {item.expiredCount}</span>
            <button onClick={() => onOpenProfile(item.employeeId)} style={{ ...buttonPrimary, fontSize: 10 }}>Open Profile</button>
          </div>
          {item.requiredCategories.map((category) => {
            const doc = item.documents.find((record) => record.category === category);
            return (
              <div key={`${item.employeeId}-${category}`} style={{ display: "grid", gridTemplateColumns: "170px 1fr 120px 80px", gap: 8, fontSize: 10, borderBottom: "1px solid rgba(255,255,255,0.04)", padding: "4px 0" }}>
                <span style={{ color: "#94a3b8" }}>{category}</span>
                <span style={{ color: "#cbd5e1" }}>{doc?.fileName ?? "Not uploaded"}</span>
                <span style={{ color: "#64748b" }}>{doc?.uploadedAt ?? "—"}</span>
                <span style={{ color: !doc ? "#ef4444" : doc.status === "valid" ? "#22c55e" : "#f59e0b" }}>{!doc ? "Missing" : doc.status}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ActionsView({
  pending,
  history,
  drafts,
  onDraftChange,
  onComplete,
  onOpenProfile,
}: {
  pending: ActionWorkflow[];
  history: CompletedActionRecord[];
  drafts: Record<string, ActionDraft>;
  onDraftChange: (actionId: string, draft: ActionDraft) => void;
  onComplete: (action: ActionWorkflow, draft: ActionDraft) => void;
  onOpenProfile: (employeeId: string, positionId: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
      <Card title={`Pending Workflows (${pending.length})`}>
        {pending.length === 0 && <div style={{ color: "#22c55e", fontSize: 10 }}>No pending workflows.</div>}
        {pending.map((action) => {
          const draft = drafts[action.id] ?? { fileName: "", evidence: "", completedBy: "" };
          return (
            <div key={action.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
                <StatusBadge status={action.severity === "critical" ? "missing" : action.severity === "warning" ? "expired" : "compliant"} />
                <span style={{ marginLeft: 8, color: "#fff", fontSize: 11, fontWeight: 700 }}>{action.label}</span>
                <button onClick={() => onOpenProfile(action.employeeId, action.positionId)} style={{ ...buttonPrimary, fontSize: 9, marginLeft: "auto" }}>Profile</button>
              </div>
              <div style={{ color: "#94a3b8", fontSize: 10, marginBottom: 6 }}>{action.employeeName} · {action.detail}</div>
              <input type="file" onChange={(event) => onDraftChange(action.id, { ...draft, fileName: event.target.files?.[0]?.name ?? "" })} style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }} />
              <input value={draft.completedBy} onChange={(event) => onDraftChange(action.id, { ...draft, completedBy: event.target.value })} placeholder="Completed by" style={{ ...inputStyle, width: "100%", marginBottom: 6 }} />
              <textarea value={draft.evidence} onChange={(event) => onDraftChange(action.id, { ...draft, evidence: event.target.value })} placeholder="Evidence notes" style={{ ...inputStyle, width: "100%", minHeight: 52, resize: "vertical", marginBottom: 6 }} />
              <button onClick={() => onComplete(action, draft)} style={{ ...buttonSuccess, fontSize: 10 }}>Complete Task</button>
            </div>
          );
        })}
      </Card>
      <Card title={`Completed History (${history.length})`}>
        {history.length === 0 && <div style={{ color: "#64748b", fontSize: 10 }}>No completed actions.</div>}
        {history.map((item) => (
          <div key={item.actionId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "7px 0" }}>
            <div style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{item.actionLabel}</div>
            <div style={{ color: "#94a3b8", fontSize: 9 }}>{item.actionDetail}</div>
            <div style={{ color: "#64748b", fontSize: 9 }}>By {item.completedBy} · {new Date(item.completedAt).toLocaleString()}</div>
            {item.uploadedFileName && <div style={{ color: "#94a3b8", fontSize: 9 }}>File: {item.uploadedFileName}</div>}
          </div>
        ))}
      </Card>
    </div>
  );
}

function RiskView({
  uiState,
  onOpenProfile,
}: {
  uiState: UIState;
  onOpenProfile: (employeeId: string, positionId: string) => void;
}) {
  const riskLevel = uiState.riskScore >= 200 ? "critical" : uiState.riskScore >= 100 ? "warning" : "healthy";
  const color = riskLevel === "critical" ? "#ef4444" : riskLevel === "warning" ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Card title="Organization Risk Score">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 62, height: 62, borderRadius: "50%", border: `3px solid ${color}`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800 }}>
            {uiState.riskScore}
          </div>
          <div>
            <div style={{ color, fontSize: 16, fontWeight: 800 }}>{riskLevel.toUpperCase()}</div>
            <div style={{ color: "#94a3b8", fontSize: 11 }}>{uiState.risks.length} active risks</div>
          </div>
        </div>
      </Card>
      <Card title="People Risk Map">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
          {uiState.risks.map((risk) => (
            <div key={risk.id} style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 9, background: "rgba(255,255,255,0.03)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <StatusBadge status={risk.level === "critical" ? "missing" : risk.level === "warning" ? "expired" : "compliant"} />
                <span style={{ color: "#cbd5e1", fontSize: 10, fontWeight: 700 }}>+{risk.score}</span>
              </div>
              <div style={{ color: "#fff", fontSize: 11, fontWeight: 700 }}>{risk.positionTitle}</div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>{risk.message}</div>
              <div style={{ color: "#64748b", fontSize: 9, marginBottom: 6 }}>{risk.detail}</div>
              {risk.employeeId ? (
                <button onClick={() => onOpenProfile(risk.employeeId!, risk.positionId)} style={{ ...buttonPrimary, fontSize: 9 }}>Open Profile</button>
              ) : (
                <span style={{ color: "#64748b", fontSize: 9 }}>No employee assigned</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function FinanceView({
  rows,
  search,
  sortBy,
  sortDirection,
  onSearch,
  onSort,
  onCsv,
  onExcel,
  onPrint,
}: {
  rows: FinanceReportRow[];
  search: string;
  sortBy: FinanceSortBy;
  sortDirection: "asc" | "desc";
  onSearch: (value: string) => void;
  onSort: (column: FinanceSortBy) => void;
  onCsv: () => void;
  onExcel: () => void;
  onPrint: () => void;
}) {
  const header = (column: FinanceSortBy, label: string) => (
    <button onClick={() => onSort(column)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 9, fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
      {label}{sortBy === column ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search..." style={{ ...inputStyle, width: 280 }} />
        <button onClick={onCsv} style={{ ...buttonPrimary, fontSize: 10 }}>CSV Export</button>
        <button onClick={onExcel} style={{ ...buttonPrimary, fontSize: 10 }}>Excel Export</button>
        <button onClick={onPrint} style={{ ...buttonPrimary, fontSize: 10 }}>Print View</button>
      </div>
      <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, overflowX: "auto" }}>
        <div style={{ minWidth: 1280, display: "grid", gridTemplateColumns: "110px 160px 150px 120px 150px 110px 90px 70px 110px 130px 170px 110px", gap: 8, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)" }}>
          {header("employeeCode", "Employee ID")}
          {header("name", "Employee Name")}
          {header("position", "Position")}
          {header("department", "Department")}
          {header("manager", "Manager")}
          {header("status", "Status")}
          {header("salary", "Salary")}
          {header("currency", "Currency")}
          {header("bankName", "Bank Name")}
          {header("bankAccount", "Account Number")}
          {header("iban", "IBAN")}
          {header("startDate", "Join Date")}
        </div>
        {rows.map((row, index) => (
          <div key={`${row.employeeId}-${index}`} style={{ minWidth: 1280, display: "grid", gridTemplateColumns: "110px 160px 150px 120px 150px 110px 90px 70px 110px 130px 170px 110px", gap: 8, padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 10 }}>
            <span style={{ color: "#e2e8f0" }}>{row.employeeId}</span>
            <span style={{ color: "#e2e8f0" }}>{row.employeeName}</span>
            <span style={{ color: "#94a3b8" }}>{row.position}</span>
            <span style={{ color: "#94a3b8" }}>{row.department}</span>
            <span style={{ color: "#94a3b8" }}>{row.manager}</span>
            <span style={{ color: "#94a3b8" }}>{row.employmentStatus}</span>
            <span style={{ color: "#22c55e" }}>{row.salary.toLocaleString()}</span>
            <span style={{ color: "#94a3b8" }}>{row.currency}</span>
            <span style={{ color: "#94a3b8" }}>{row.bankName}</span>
            <span style={{ color: "#94a3b8" }}>{row.accountNumber}</span>
            <span style={{ color: "#94a3b8" }}>{row.iban}</span>
            <span style={{ color: "#94a3b8" }}>{row.joinDate}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const buttonPrimary: CSSProperties = {
  borderRadius: 6,
  border: "1px solid rgba(99,102,241,0.35)",
  background: "rgba(99,102,241,0.16)",
  color: "#a5b4fc",
  fontWeight: 700,
  padding: "5px 8px",
  cursor: "pointer",
};

const buttonSuccess: CSSProperties = {
  borderRadius: 6,
  border: "1px solid rgba(34,197,94,0.35)",
  background: "rgba(34,197,94,0.18)",
  color: "#4ade80",
  fontWeight: 700,
  padding: "6px 8px",
  cursor: "pointer",
};

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function financeMatrix(rows: FinanceReportRow[]): string[][] {
  return [
    ["Employee ID", "Employee Name", "Position", "Department", "Manager", "Employment Status", "Salary", "Currency", "Bank Name", "Account Number", "IBAN", "Join Date"],
    ...rows.map((row) => [row.employeeId, row.employeeName, row.position, row.department, row.manager, row.employmentStatus, String(row.salary), row.currency, row.bankName, row.accountNumber, row.iban, row.joinDate]),
  ];
}

function navTitle(activeNav: string): string {
  return NAV_ITEMS.find((item) => item.id === activeNav)?.label ?? "TeamFrame";
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState("profile");
  const [controlState, setControlState] = useState<ControlState>({
    scenarioId: "DEFAULT_VIEW",
    selectedPositionId: "1-001",
    selectedEmployeeId: "e-001",
    positionEdits: [],
    employeeSearch: "",
    financeSearch: "",
    financeSortBy: "name",
    financeSortDirection: "asc",
    completedActions: [],
    uploadedDocuments: [],
    onboardingOverrides: [],
  });
  const [drafts, setDrafts] = useState<Record<string, ActionDraft>>({});

  const uiState = useMemo(() => computeUIState(SEED, controlState), [controlState]);
  const complianceCount = uiState.complianceView.filter((item) => item.status !== "compliant").length;
  const documentCount = uiState.documentsRepository.reduce((sum, item) => sum + item.missingCount + item.expiredCount, 0);

  const openProfile = (employeeId: string, positionId: string) => {
    setControlState((prev) => ({ ...prev, selectedEmployeeId: employeeId, selectedPositionId: positionId, scenarioId: "DEFAULT_VIEW" }));
    setActiveNav("profile");
  };

  const openProfileByEmployeeId = (employeeId: string) => {
    const employee = SEED.employees.find((item) => item.id === employeeId);
    if (!employee) return;
    openProfile(employee.id, employee.positionId);
  };

  const completeAction = (action: ActionWorkflow, draft: ActionDraft) => {
    if (!draft.completedBy.trim()) {
      window.alert("Completed by is required.");
      return;
    }
    if (action.requiresUpload && !draft.fileName.trim()) {
      window.alert("Upload file is required for this action.");
      return;
    }
    const now = new Date().toISOString();
    const completed: CompletedActionRecord = {
      actionId: action.id,
      employeeId: action.employeeId,
      positionId: action.positionId,
      actionLabel: action.label,
      actionDetail: action.detail,
      requiredCategory: action.requiredCategory,
      completedAt: now,
      completedBy: draft.completedBy.trim(),
      evidence: draft.evidence.trim(),
      uploadedFileName: draft.fileName.trim(),
    };
    setControlState((prev) => {
      const completedActions = [...prev.completedActions.filter((item) => item.actionId !== action.id), completed];
      const uploadedDocuments = [...prev.uploadedDocuments];
      if (draft.fileName.trim() && action.requiredCategory) {
        const doc: EmployeeDocument = {
          id: `upl-${Date.now()}-${action.id}`,
          employeeId: action.employeeId,
          category: action.requiredCategory,
          fileName: draft.fileName.trim(),
          uploadedAt: now,
          uploadedBy: draft.completedBy.trim(),
          status: "valid",
        };
        uploadedDocuments.push(doc);
      }
      const onboardingOverrides = [...prev.onboardingOverrides];
      if (action.id.startsWith("act-onboarding-")) {
        onboardingOverrides.push({ employeeId: action.employeeId, status: "complete", progress: 100, updatedAt: now });
      }
      return { ...prev, completedActions, uploadedDocuments, onboardingOverrides };
    });
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[action.id];
      return next;
    });
  };

  const exportCsv = () => {
    const csv = financeMatrix(uiState.financeRows).map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    download("teamframe-finance-report.csv", csv, "text/csv;charset=utf-8;");
  };

  const exportExcel = () => {
    const tsv = financeMatrix(uiState.financeRows).map((row) => row.join("\t")).join("\n");
    download("teamframe-finance-report.xls", tsv, "application/vnd.ms-excel");
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif", overflow: "hidden" }}>
      <aside style={{ width: 220, borderRight: "1px solid rgba(255,255,255,0.08)", background: "#13161f", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 800 }}>TeamFrame V2</div>
          <div style={{ color: "#64748b", fontSize: 10 }}>Employee-Centric HR Operations</div>
        </div>
        <nav style={{ flex: 1, paddingTop: 8 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.id;
            const badge = item.badge === "risk" ? uiState.risks.length : item.badge === "actions" ? uiState.pendingActions.length : item.badge === "compliance" ? complianceCount : item.badge === "documents" ? documentCount : 0;
            return (
              <button key={item.id} onClick={() => setActiveNav(item.id)} style={{ width: "100%", textAlign: "left", border: "none", borderLeft: `2px solid ${active ? "#6366f1" : "transparent"}`, background: active ? "rgba(99,102,241,0.16)" : "none", color: active ? "#a5b4fc" : "#64748b", fontSize: 12, fontWeight: active ? 700 : 500, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <span>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && badge > 0 && <span style={{ fontSize: 9, borderRadius: 8, padding: "1px 6px", background: "rgba(99,102,241,0.8)", color: "#fff", fontWeight: 800 }}>{badge}</span>}
              </button>
            );
          })}
        </nav>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "12px 14px", background: "rgba(0,0,0,0.15)" }}>
          <Row label="Positions" value={`${uiState.stats.totalPositions}`} />
          <Row label="Filled" value={`${uiState.stats.filledPositions}`} />
          <Row label="Vacant" value={`${uiState.stats.vacantPositions}`} />
          <Row label="On Leave" value={`${uiState.stats.onLeaveCount}`} />
          <Row label="Offboarding" value={`${uiState.stats.offboardingCount}`} />
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#13161f", display: "flex", alignItems: "center", gap: 8, padding: "0 14px" }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 800 }}>{navTitle(activeNav)}</h1>
            <div style={{ color: "#64748b", fontSize: 10 }}>Seed Data + Scenario + Compute Engine = UI State</div>
          </div>
          {Object.entries(SCENARIO_LABELS).map(([id, label]) => (
            <button key={id} onClick={() => setControlState((prev) => ({ ...prev, scenarioId: id }))} style={{ borderRadius: 6, border: `1px solid ${controlState.scenarioId === id ? "rgba(99,102,241,0.45)" : "rgba(255,255,255,0.12)"}`, background: controlState.scenarioId === id ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.03)", color: controlState.scenarioId === id ? "#a5b4fc" : "#64748b", fontSize: 9, fontWeight: 700, padding: "4px 7px", cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </header>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <section style={{ flex: 1, overflow: "auto", padding: 14 }}>
            {activeNav === "profile" && <ProfileView profile={uiState.selectedProfile} />}
            {activeNav === "org" && <OrgView uiState={uiState} onSelect={(positionId, employeeId) => {
              setControlState((prev) => ({ ...prev, selectedPositionId: positionId, selectedEmployeeId: employeeId, scenarioId: "DEFAULT_VIEW" }));
              if (employeeId) setActiveNav("profile");
            }} />}
            {activeNav === "employees" && <DirectoryView rows={uiState.employeeDirectory} search={controlState.employeeSearch} onSearchChange={(value) => setControlState((prev) => ({ ...prev, employeeSearch: value }))} onOpenProfile={openProfile} />}
            {activeNav === "risk" && <RiskView uiState={uiState} onOpenProfile={openProfile} />}
            {activeNav === "actions" && <ActionsView pending={uiState.pendingActions} history={uiState.completedActionHistory} drafts={drafts} onDraftChange={(actionId, draft) => setDrafts((prev) => ({ ...prev, [actionId]: draft }))} onComplete={completeAction} onOpenProfile={openProfile} />}
            {activeNav === "compliance" && <ComplianceView items={uiState.complianceView} onOpenProfile={openProfile} />}
            {activeNav === "documents" && <DocumentsView rows={uiState.documentsRepository} onOpenProfile={openProfileByEmployeeId} />}
            {activeNav === "reports" && <FinanceView rows={uiState.financeRows} search={controlState.financeSearch} sortBy={controlState.financeSortBy} sortDirection={controlState.financeSortDirection} onSearch={(value) => setControlState((prev) => ({ ...prev, financeSearch: value }))} onSort={(column) => setControlState((prev) => ({ ...prev, financeSortBy: column, financeSortDirection: prev.financeSortBy === column && prev.financeSortDirection === "asc" ? "desc" : "asc" }))} onCsv={exportCsv} onExcel={exportExcel} onPrint={() => window.print()} />}
            {activeNav === "settings" && <div style={{ color: "#64748b", paddingTop: 40 }}>Settings placeholder.</div>}
          </section>
          <aside style={{ width: 300, borderLeft: "1px solid rgba(255,255,255,0.08)", background: "#13161f", padding: 14, overflow: "auto" }}>
            <Card title="Quick Preview">
              {uiState.selectedProfile ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
                    <Avatar initials={uiState.selectedProfile.employee.avatarInitials} color={uiState.selectedProfile.employee.avatarColor} size={40} />
                    <div>
                      <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{uiState.selectedProfile.employee.name}</div>
                      <div style={{ color: "#64748b", fontSize: 10 }}>{uiState.selectedProfile.employee.employeeCode}</div>
                    </div>
                  </div>
                  <Row label="Pending Actions" value={`${uiState.selectedProfile.pendingActions.length}`} />
                  <Row label="Missing Docs" value={`${uiState.selectedProfile.complianceSummary.missing}`} />
                  <Row label="Expired Docs" value={`${uiState.selectedProfile.complianceSummary.expired}`} />
                  <Row label="Onboarding" value={`${uiState.selectedProfile.onboarding.progress}%`} />
                  <button onClick={() => setActiveNav("profile")} style={{ ...buttonPrimary, width: "100%", marginTop: 8, fontSize: 10 }}>Open Full Profile</button>
                </>
              ) : (
                <div style={{ color: "#64748b", fontSize: 10 }}>Select an employee to preview details.</div>
              )}
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
