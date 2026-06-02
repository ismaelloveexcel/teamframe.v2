import { useState, useMemo } from "react";
import { SEED, Position } from "../../../teamframe/data/seed";
import {
  ControlState,
  UIState,
  OrgNode,
  Signal,
  Action,
  PositionEdit,
  RiskItem,
  SCENARIOS,
  computeUIState,
} from "../../../teamframe/engine/compute";

const SCENARIO_LABELS: Record<string, string> = {
  DEFAULT_VIEW: "Default View",
  VACANT_POSITION_FOCUS: "Vacant Position",
  ON_LEAVE_EMPLOYEE_FOCUS: "On Leave Focus",
  OFFBOARDING_EMPLOYEE_FOCUS: "Offboarding Focus",
  MISSING_COMPLIANCE_FOCUS: "Compliance Issue",
  FULL_ORGANIZATION_VIEW: "Full Org View",
};

const NAV_ITEMS = [
  { id: "org", label: "Org Chart", icon: "⬡" },
  { id: "risk", label: "Risk Heatmap", icon: "🔥", badge: true },
  { id: "positions", label: "Positions", icon: "◈" },
  { id: "employees", label: "Employees", icon: "◉" },
  { id: "signals", label: "Signals", icon: "△", badge: true },
  { id: "actions", label: "Actions", icon: "⚡", badge: true },
  { id: "compliance", label: "Compliance", icon: "✓" },
  { id: "reports", label: "Reports", icon: "≡" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function Avatar({ initials, color, size = 36 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, fontWeight: 600, color: "#fff", flexShrink: 0,
        border: "2px solid rgba(255,255,255,0.15)",
      }}
    >
      {initials}
    </div>
  );
}

function StatusDot({ status }: { status: "active" | "on_leave" | "offboarding" | "vacant" }) {
  const colors: Record<string, string> = {
    active: "#22c55e",
    on_leave: "#f59e0b",
    offboarding: "#ef4444",
    vacant: "#6b7280",
  };
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: colors[status] ?? "#6b7280", flexShrink: 0,
    }} />
  );
}

function SignalBadge({ level }: { level: "critical" | "warning" | "info" }) {
  const cfg = {
    critical: { bg: "rgba(239,68,68,0.2)", color: "#ef4444", icon: "●" },
    warning: { bg: "rgba(245,158,11,0.2)", color: "#f59e0b", icon: "▲" },
    info: { bg: "rgba(99,102,241,0.2)", color: "#818cf8", icon: "ℹ" },
  };
  const { bg, color, icon } = cfg[level];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 12, background: bg, color, fontSize: 11, fontWeight: 600,
    }}>
      {icon} {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function OrgNodeCard({
  node,
  selectedPositionId,
  onSelect,
}: {
  node: OrgNode;
  selectedPositionId: string;
  onSelect: (id: string) => void;
}) {
  const emp = node.employee;
  const isSelected = node.position.id === selectedPositionId;
  const isVacant = !emp;
  const isOffboarding = emp?.status === "offboarding";
  const isOnLeave = emp?.status === "on_leave";

  let borderColor = "rgba(255,255,255,0.08)";
  if (isSelected) borderColor = "#6366f1";
  else if (isOffboarding || node.signalLevel === "critical") borderColor = "rgba(239,68,68,0.5)";
  else if (node.signalLevel === "warning") borderColor = "rgba(245,158,11,0.4)";
  else if (isOnLeave || isVacant) borderColor = "rgba(245,158,11,0.35)";

  return (
    <button
      onClick={() => onSelect(node.position.id)}
      style={{
        background: isSelected ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${borderColor}`,
        borderRadius: 10, padding: "10px 13px",
        cursor: "pointer", textAlign: "left", width: 148,
        transition: "all 0.15s ease",
        outline: "none",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {emp ? (
          <Avatar initials={emp.avatarInitials} color={emp.avatarColor} size={28} />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)", border: "1.5px dashed rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, color: "#6b7280",
          }}>?</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#fff", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {emp?.name ?? "Vacant"}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.3, marginBottom: 4 }}>
        {node.position.title}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace" }}>{node.position.id}</span>
        <StatusDot status={isVacant ? "vacant" : (emp?.status ?? "active")} />
      </div>
    </button>
  );
}

function OrgLevel({
  nodes,
  selectedPositionId,
  onSelect,
}: {
  nodes: OrgNode[];
  selectedPositionId: string;
  onSelect: (id: string) => void;
}) {
  if (!nodes.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        {nodes.map((node) => (
          <div key={node.position.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <OrgNodeCard node={node} selectedPositionId={selectedPositionId} onSelect={onSelect} />
            {node.children.length > 0 && (
              <>
                <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
                <OrgLevel nodes={node.children} selectedPositionId={selectedPositionId} onSelect={onSelect} />
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrgTreeView({
  uiState,
  onSelectPosition,
}: {
  uiState: UIState;
  onSelectPosition: (id: string) => void;
}) {
  if (!uiState.orgTree.length) {
    return <div style={{ color: "#6b7280", padding: 32 }}>No org data available</div>;
  }

  const root = uiState.orgTree[0];
  if (!root) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, minWidth: 900 }}>
      <OrgNodeCard
        node={root}
        selectedPositionId={uiState.selectedPosition?.id ?? ""}
        onSelect={onSelectPosition}
      />
      {root.children.length > 0 && (
        <>
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.1)" }} />
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {root.children.map((child) => (
              <div key={child.position.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <OrgNodeCard
                  node={child}
                  selectedPositionId={uiState.selectedPosition?.id ?? ""}
                  onSelect={onSelectPosition}
                />
                {child.children.length > 0 && (
                  <>
                    <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                      {child.children.map((gc) => (
                        <div key={gc.position.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <OrgNodeCard
                            node={gc}
                            selectedPositionId={uiState.selectedPosition?.id ?? ""}
                            onSelect={onSelectPosition}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 20, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
        {[
          { color: "#22c55e", label: "Filled" },
          { color: "#6b7280", label: "Vacant" },
          { color: "#f59e0b", label: "On Leave" },
          { color: "#ef4444", label: "Offboarding" },
          { color: "#f87171", label: "Critical" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskHeatmapView({
  uiState,
  onSelectPosition,
}: {
  uiState: UIState;
  onSelectPosition: (id: string) => void;
}) {
  const rb = uiState.riskBreakdown;
  const maxScore = Math.max(rb.vacancy, rb.offboarding, rb.leave, rb.compliance, rb.overload, rb.single_point, 1);
  const total = uiState.riskScore;
  const riskLevel = total >= 150 ? "critical" : total >= 80 ? "warning" : "healthy";
  const riskColor = riskLevel === "critical" ? "#ef4444" : riskLevel === "warning" ? "#f59e0b" : "#22c55e";
  const riskBg = riskLevel === "critical" ? "rgba(239,68,68,0.12)" : riskLevel === "warning" ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)";

  const bars = [
    { label: "Vacancy", value: rb.vacancy, color: "#f59e0b" },
    { label: "Offboarding", value: rb.offboarding, color: "#ef4444" },
    { label: "On Leave", value: rb.leave, color: "#f59e0b" },
    { label: "Compliance", value: rb.compliance, color: "#f97316" },
    { label: "Overload", value: rb.overload, color: "#8b5cf6" },
    { label: "Single Point", value: rb.single_point, color: "#ec4899" },
  ];

  const categoryMeta: Record<string, { label: string; color: string; icon: string }> = {
    vacancy: { label: "Vacancy", color: "#f59e0b", icon: "◈" },
    offboarding: { label: "Offboarding", color: "#ef4444", icon: "❌" },
    leave: { label: "Leave", color: "#f59e0b", icon: "△" },
    compliance: { label: "Compliance", color: "#f97316", icon: "⚠" },
    overload: { label: "Overload", color: "#8b5cf6", icon: "⚡" },
    single_point: { label: "Single Point", color: "#ec4899", icon: "✶" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Top Score Card */}
      <div style={{
        display: "flex", gap: 16, alignItems: "stretch",
      }}>
        <div style={{
          flex: 1, padding: "20px 24px", borderRadius: 14,
          background: riskBg, border: `1.5px solid ${riskColor}40`,
          display: "flex", alignItems: "center", gap: 20,
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            border: `3px solid ${riskColor}`, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 28, fontWeight: 800, color: riskColor,
          }}>
            {total}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Organization Risk Score
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: riskColor, marginTop: 4 }}>
              {riskLevel === "critical" ? "CRITICAL RISK" : riskLevel === "warning" ? "MODERATE RISK" : "HEALTHY"}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              {uiState.risks.length} active risk items across {uiState.stats.totalPositions} positions
            </div>
          </div>
        </div>
        <div style={{
          width: 340, padding: "20px 24px", borderRadius: 14,
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Risk Breakdown
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bars.map(({ label, value, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 80, fontSize: 10, color: "#94a3b8", fontWeight: 500 }}>{label}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 4, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4, background: color,
                    width: `${(value / maxScore) * 100}%`,
                    transition: "width 0.3s ease",
                  }} />
                </div>
                <span style={{ width: 28, fontSize: 10, fontWeight: 700, color, textAlign: "right" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Heatmap Grid */}
      <div style={{
        padding: "20px 24px", borderRadius: 14,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
          People Risk Map
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10,
        }}>
          {uiState.risks.map((risk) => {
            const meta = categoryMeta[risk.category] ?? categoryMeta.compliance;
            return (
              <div
                key={`${risk.positionId}-${risk.category}`}
                onClick={() => onSelectPosition(risk.positionId)}
                style={{
                  padding: "12px 14px", borderRadius: 10, textAlign: "left",
                  background: risk.level === "critical" ? "rgba(239,68,68,0.08)"
                    : risk.level === "warning" ? "rgba(245,158,11,0.08)"
                    : "rgba(99,102,241,0.08)",
                  border: `1.5px solid ${risk.level === "critical" ? "rgba(239,68,68,0.25)"
                    : risk.level === "warning" ? "rgba(245,158,11,0.25)"
                    : "rgba(99,102,241,0.25)"}`,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, color: meta.color }}>{meta.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {meta.label}
                  </span>
                  <span style={{
                    marginLeft: "auto", fontSize: 10, fontWeight: 800,
                    color: risk.level === "critical" ? "#ef4444" : risk.level === "warning" ? "#f59e0b" : "#818cf8",
                  }}>
                    +{risk.score}
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 2 }}>
                  {risk.positionTitle}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  {risk.message}
                </div>
                <div style={{ fontSize: 9, color: "#64748b", marginTop: 2 }}>
                  {risk.detail}
                </div>
              </div>
            );
          })}
        </div>
        {uiState.risks.length === 0 && (
          <div style={{ color: "#22c55e", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
            ✓ No risks detected — organization is healthy
          </div>
        )}
      </div>
    </div>
  );
}

function PositionForm({
  position,
  onSave,
  onCancel,
}: {
  position: Position;
  onSave: (edit: PositionEdit) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(position.title);
  const [department, setDepartment] = useState(position.department);

  return (
    <div style={{
      padding: "14px 20px",
      borderBottom: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
        Edit Position
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>
          Title
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{
            width: "100%", padding: "8px 10px", fontSize: 12, color: "#e2e8f0",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, outline: "none",
          }}
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 10, color: "#64748b", marginBottom: 4, fontWeight: 600 }}>
          Department
        </label>
        <input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          style={{
            width: "100%", padding: "8px 10px", fontSize: 12, color: "#e2e8f0",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, outline: "none",
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onSave({ id: position.id, title, department })}
          style={{
            flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 600,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
            border: "none", borderRadius: 6, cursor: "pointer",
          }}
        >
          Save Changes
        </button>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 600,
            background: "rgba(255,255,255,0.06)", color: "#94a3b8",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RightPanel({
  uiState,
  onResolveAction,
  onClose,
  onEditPosition,
  isEditing,
  onSaveEdit,
  onCancelEdit,
}: {
  uiState: UIState;
  onResolveAction: (id: string) => void;
  onClose: () => void;
  onEditPosition: () => void;
  isEditing: boolean;
  onSaveEdit: (edit: PositionEdit) => void;
  onCancelEdit: () => void;
}) {
  const emp = uiState.selectedEmployee;
  const pos = uiState.selectedPosition;
  const signals = uiState.signals.filter(
    (s) => s.positionId === pos?.id
  );
  const actions = uiState.actions.filter(
    (a) => a.positionId === pos?.id || a.positionId === "1-001"
  ).slice(0, 4);

  if (!pos) {
    return (
      <div style={{ color: "#6b7280", padding: 24, fontSize: 13 }}>
        Select a position to view details
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.07)",
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {emp ? (
            <Avatar initials={emp.avatarInitials} color={emp.avatarColor} size={44} />
          ) : (
            <div style={{
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)", border: "1.5px dashed rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, color: "#6b7280",
            }}>?</div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>
              {emp?.name ?? "Vacant Position"}
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{pos.title}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
              {emp ? "Employee" : "No employee"} · {pos.id}
            </div>
            {emp?.status === "offboarding" && (
              <div style={{
                marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(239,68,68,0.15)", color: "#ef4444",
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
              }}>
                ● Critical
              </div>
            )}
            {emp?.status === "on_leave" && (
              <div style={{
                marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4,
                background: "rgba(245,158,11,0.15)", color: "#f59e0b",
                padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
              }}>
                ▲ On Leave
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={onEditPosition}
            style={{
              fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,0.1)",
              border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4,
              padding: "4px 10px", cursor: "pointer", fontWeight: 600,
            }}
          >
            Edit
          </button>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#64748b",
            cursor: "pointer", fontSize: 18, padding: "0 4px", lineHeight: 1,
          }}>×</button>
        </div>
      </div>

      {isEditing && pos && (
        <PositionForm
          position={pos}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
        />
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 16px" }}>
        {emp && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {[
              { label: "Reports To", value: SEED.positions.find(p => p.id === pos.reportsToId)?.title ?? "None" },
              { label: "Department", value: pos.department },
              { label: "Location", value: emp.location },
              { label: "Email", value: emp.email },
              { label: "Phone", value: emp.phone },
              { label: "Start Date", value: emp.startDate },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: "flex", justifyContent: "space-between",
                padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: 12,
              }}>
                <span style={{ color: "#64748b" }}>{label}</span>
                <span style={{ color: "#cbd5e1", fontWeight: 500, textAlign: "right", maxWidth: "55%", wordBreak: "break-all" }}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {uiState.directReports.length > 0 && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Direct Reports ({uiState.directReports.length})
            </div>
            {uiState.directReports.slice(0, 4).map(({ position, employee: dr }) => (
              <div key={position.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}>
                {dr ? (
                  <Avatar initials={dr.avatarInitials} color={dr.avatarColor} size={28} />
                ) : (
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(255,255,255,0.06)", border: "1.5px dashed rgba(255,255,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, color: "#6b7280",
                  }}>?</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{position.title}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{position.id}</div>
                </div>
              </div>
            ))}
            {uiState.directReports.length > 4 && (
              <button style={{
                marginTop: 8, fontSize: 11, color: "#818cf8", background: "none",
                border: "none", cursor: "pointer", padding: 0,
              }}>
                View All Reports
              </button>
            )}
          </div>
        )}

        {signals.length > 0 && (
          <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Signals ({signals.length})
            </div>
            {signals.map((sig) => (
              <div key={sig.id} style={{
                padding: "8px 10px", borderRadius: 8, marginBottom: 8,
                background: sig.level === "critical" ? "rgba(239,68,68,0.08)" : sig.level === "warning" ? "rgba(245,158,11,0.08)" : "rgba(99,102,241,0.08)",
                border: `1px solid ${sig.level === "critical" ? "rgba(239,68,68,0.2)" : sig.level === "warning" ? "rgba(245,158,11,0.2)" : "rgba(99,102,241,0.2)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <SignalBadge level={sig.level} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{sig.message}</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{sig.detail}</div>
              </div>
            ))}
          </div>
        )}

        {actions.length > 0 && (
          <div style={{ padding: "14px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Actions ({actions.length})
            </div>
            {actions.map((act) => (
              <div key={act.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderRadius: 8, marginBottom: 6,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: "rgba(99,102,241,0.15)", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: 13, color: "#818cf8",
                  }}>⚡</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0" }}>{act.label}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{act.dueIn}</div>
                  </div>
                </div>
                <button
                  onClick={() => onResolveAction(act.id)}
                  style={{
                    fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4,
                    padding: "3px 8px", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  Resolve
                </button>
              </div>
            ))}
            <button style={{
              marginTop: 4, fontSize: 11, color: "#818cf8", background: "none",
              border: "none", cursor: "pointer", padding: 0,
            }}>
              View All Actions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function JsonInspectorPanel({ seed, controlState, uiState }: {
  seed: typeof SEED;
  controlState: ControlState;
  uiState: UIState;
}) {
  const [tab, setTab] = useState<"seed" | "control" | "ui">("control");
  const data = tab === "seed" ? { positions: seed.positions.length, employees: seed.employees.length, compliance: seed.compliance.length }
    : tab === "control" ? controlState
    : { selectedPosition: uiState.selectedPosition?.id, selectedEmployee: uiState.selectedEmployee?.id, signals: uiState.signals.length, actions: uiState.actions.length };

  return (
    <div style={{
      background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10, overflow: "hidden",
    }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        {(["seed", "control", "ui"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: "8px 0", fontSize: 10, fontWeight: 600,
              background: tab === t ? "rgba(99,102,241,0.2)" : "none",
              color: tab === t ? "#818cf8" : "#64748b",
              border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.06em",
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <pre style={{
        margin: 0, padding: "12px 14px", fontSize: 9.5, color: "#94a3b8",
        overflowX: "auto", maxHeight: 180, overflowY: "auto", lineHeight: 1.6,
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState("org");
  const [controlState, setControlState] = useState<ControlState>({
    scenarioId: "DEFAULT_VIEW",
    selectedPositionId: "1-001",
    selectedEmployeeId: "e-001",
    resolvedActions: [],
    positionEdits: [],
  });
  const [showJson, setShowJson] = useState(false);
  const [editingPosition, setEditingPosition] = useState<string | null>(null);

  const uiState = useMemo(() => computeUIState(SEED, controlState), [controlState]);

  const setScenario = (scenarioId: string) => {
    setControlState((prev) => ({ ...prev, scenarioId }));
  };
  const setSelectedPositionId = (id: string) => {
    const emp = SEED.employees.find((e) => e.positionId === id);
    setControlState((prev) => ({
      ...prev,
      selectedPositionId: id,
      selectedEmployeeId: emp?.id ?? null,
      scenarioId: "DEFAULT_VIEW",
    }));
  };
  const resolveAction = (actionId: string) => {
    setControlState((prev) => ({
      ...prev,
      resolvedActions: [...prev.resolvedActions, actionId],
    }));
  };
  const updatePosition = (edit: PositionEdit) => {
    setControlState((prev) => {
      const existing = prev.positionEdits.find((e) => e.id === edit.id);
      const nextEdits = existing
        ? prev.positionEdits.map((e) => (e.id === edit.id ? edit : e))
        : [...prev.positionEdits, edit];
      return { ...prev, positionEdits: nextEdits };
    });
  };
  const updateEmployee = (empId: string, positionId: string) => {
    setControlState((prev) => ({
      ...prev,
      selectedEmployeeId: empId,
      selectedPositionId: positionId,
    }));
  };

  return (
    <div style={{
      display: "flex", height: "100vh", width: "100vw",
      background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', system-ui, sans-serif",
      overflow: "hidden",
    }}>
      {/* Sidebar */}
      <div style={{
        width: 200, flexShrink: 0, background: "#13161f",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Logo */}
        <div style={{
          padding: "16px 16px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>T</div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>TeamFrame V2</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 0" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            const count = item.id === "signals" ? uiState.signals.length
              : item.id === "actions" ? uiState.actions.length
              : item.id === "risk" ? uiState.risks.length
              : 0;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "9px 16px", textAlign: "left",
                  background: isActive ? "rgba(99,102,241,0.15)" : "none",
                  borderLeft: `2px solid ${isActive ? "#6366f1" : "transparent"}`,
                  color: isActive ? "#818cf8" : "#64748b",
                  cursor: "pointer", fontSize: 12, fontWeight: isActive ? 600 : 400,
                  transition: "all 0.1s ease",
                }}
              >
                <span style={{ fontSize: 13 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && count > 0 && (
                  <span style={{
                    background: item.id === "signals" ? "rgba(239,68,68,0.8)" : "rgba(99,102,241,0.8)",
                    color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10, fontWeight: 700,
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Org Overview */}
        <div style={{
          padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.15)",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Organization Overview
          </div>
          {[
            { label: "Total Positions", value: uiState.stats.totalPositions, color: "#e2e8f0" },
            { label: "Filled Positions", value: `${uiState.stats.filledPositions}`, pct: `${uiState.stats.filledPct}%`, color: "#22c55e" },
            { label: "Vacant Positions", value: `${uiState.stats.vacantPositions}`, pct: `${uiState.stats.vacantPct}%`, color: "#f59e0b" },
            { label: "On Leave", value: `${uiState.stats.onLeaveCount}`, pct: `${uiState.stats.onLeavePct}%`, color: "#f59e0b" },
            { label: "Offboarding", value: `${uiState.stats.offboardingCount}`, pct: `${uiState.stats.offboardingPct}%`, color: "#ef4444" },
          ].map(({ label, value, pct, color }) => (
            <div key={label} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 10, color: "#64748b" }}>{label}</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
                  {pct && <span style={{ fontSize: 9, color: "#475569" }}>{pct}</span>}
                </div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 10, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", marginBottom: 6 }}>Signal Summary</div>
            {[
              { label: "Critical", count: uiState.signalSummary.critical, color: "#ef4444" },
              { label: "High", count: uiState.signalSummary.high, color: "#f59e0b" },
              { label: "Medium", count: uiState.signalSummary.medium, color: "#eab308" },
              { label: "Low", count: uiState.signalSummary.low, color: "#22c55e" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, display: "inline-block" }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>{label}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color }}>{count}</span>
              </div>
            ))}
            <button style={{
              marginTop: 6, width: "100%", padding: "5px 0", fontSize: 10, fontWeight: 600,
              background: "rgba(99,102,241,0.1)", color: "#818cf8",
              border: "1px solid rgba(99,102,241,0.2)", borderRadius: 6, cursor: "pointer",
            }}>
              View All Signals
            </button>
          </div>
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top Header */}
        <div style={{
          height: 52, flexShrink: 0,
          background: "#13161f", borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", padding: "0 20px", gap: 16,
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
              {activeNav === "org" ? "Organization Chart"
                : activeNav === "risk" ? "People Risk Heatmap"
                : activeNav === "signals" ? "Signals"
                : activeNav === "actions" ? "Actions"
                : activeNav === "compliance" ? "Compliance"
                : activeNav === "employees" ? "Employees"
                : activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}
            </h1>
            <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>
              Position-centric · See reporting relationships at a glance
            </div>
          </div>

          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 8, padding: "6px 12px", width: 220,
          }}>
            <span style={{ color: "#64748b", fontSize: 12 }}>🔍</span>
            <span style={{ fontSize: 11, color: "#475569" }}>Search positions or employees...</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              onClick={() => setShowJson(!showJson)}
              style={{
                padding: "5px 12px", fontSize: 10, fontWeight: 600,
                background: showJson ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                color: showJson ? "#818cf8" : "#64748b",
                border: `1px solid ${showJson ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 6, cursor: "pointer",
              }}
            >
              {"{}"} JSON Inspector
            </button>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer",
            }}>SJ</div>
          </div>
        </div>

        {/* Scenario Bar */}
        <div style={{
          height: 40, flexShrink: 0, padding: "0 20px",
          background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 10, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginRight: 4 }}>
            Scenario:
          </span>
          {Object.entries(SCENARIO_LABELS).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setScenario(id)}
              style={{
                padding: "3px 10px", fontSize: 10, fontWeight: 600,
                background: controlState.scenarioId === id ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.04)",
                color: controlState.scenarioId === id ? "#818cf8" : "#64748b",
                border: `1px solid ${controlState.scenarioId === id ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 5, cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.1s ease",
              }}
            >
              {label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button style={{
            padding: "3px 10px", fontSize: 10, fontWeight: 600,
            background: "rgba(255,255,255,0.04)", color: "#64748b",
            border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, cursor: "pointer",
          }}>
            ⊞ Filters
          </button>
          <button style={{
            padding: "3px 10px", fontSize: 10, fontWeight: 600,
            background: "rgba(255,255,255,0.04)", color: "#64748b",
            border: "1px solid rgba(255,255,255,0.07)", borderRadius: 5, cursor: "pointer",
          }}>
            ☰ View Options
          </button>
          <button style={{
            padding: "3px 12px", fontSize: 10, fontWeight: 700,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff",
            border: "none", borderRadius: 5, cursor: "pointer",
          }}>
            + Add Position
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Org / Main Panel */}
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", padding: "28px 24px" }}>
            {activeNav === "org" && (
              <OrgTreeView uiState={uiState} onSelectPosition={setSelectedPositionId} />
            )}
            {activeNav === "risk" && (
              <RiskHeatmapView uiState={uiState} onSelectPosition={setSelectedPositionId} />
            )}
            {activeNav === "signals" && (
              <div>
                <div style={{ marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
                  {uiState.signals.length} active signals across the organization
                </div>
                {uiState.signals.map((sig) => {
                  const pos = SEED.positions.find((p) => p.id === sig.positionId);
                  const emp = SEED.employees.find((e) => e.positionId === sig.positionId);
                  return (
                    <div key={sig.id} style={{
                      padding: "12px 16px", borderRadius: 10, marginBottom: 10,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <SignalBadge level={sig.level} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{sig.message}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{sig.detail}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{pos?.title}</div>
                        <div style={{ fontSize: 10, color: "#475569" }}>{emp?.name ?? "Vacant"}</div>
                      </div>
                      <button
                        onClick={() => resolveAction(sig.id)}
                        style={{
                          fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,0.1)",
                          border: "1px solid rgba(99,102,241,0.3)", borderRadius: 4,
                          padding: "4px 10px", cursor: "pointer", fontWeight: 600,
                        }}
                      >
                        Resolve
                      </button>
                    </div>
                  );
                })}
                {uiState.signals.length === 0 && (
                  <div style={{ color: "#22c55e", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
                    ✓ All signals resolved — organization is healthy
                  </div>
                )}
              </div>
            )}
            {activeNav === "actions" && (
              <div>
                <div style={{ marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
                  {uiState.actions.length} pending actions
                </div>
                {uiState.actions.map((act) => {
                  const pos = SEED.positions.find((p) => p.id === act.positionId);
                  return (
                    <div key={act.id} style={{
                      padding: "14px 16px", borderRadius: 10, marginBottom: 10,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8,
                        background: "rgba(99,102,241,0.15)", display: "flex",
                        alignItems: "center", justifyContent: "center", fontSize: 16, color: "#818cf8",
                      }}>⚡</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{act.label}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{pos?.title} · {pos?.department}</div>
                      </div>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{act.dueIn}</span>
                      <button
                        onClick={() => resolveAction(act.id)}
                        style={{
                          fontSize: 10, color: "#22c55e", background: "rgba(34,197,94,0.1)",
                          border: "1px solid rgba(34,197,94,0.3)", borderRadius: 4,
                          padding: "4px 10px", cursor: "pointer", fontWeight: 600,
                        }}
                      >
                        Complete
                      </button>
                    </div>
                  );
                })}
                {uiState.actions.length === 0 && (
                  <div style={{ color: "#22c55e", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
                    ✓ All actions completed
                  </div>
                )}
              </div>
            )}
            {activeNav === "compliance" && (
              <div>
                <div style={{ marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
                  Compliance status across all positions
                </div>
                {SEED.compliance.map((item) => {
                  const pos = SEED.positions.find((p) => p.id === item.positionId);
                  const statusCfg = item.status === "complete"
                    ? { color: "#22c55e", bg: "rgba(34,197,94,0.1)", label: "Complete" }
                    : item.status === "expired"
                    ? { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "Expired" }
                    : { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "Missing" };
                  return (
                    <div key={item.id} style={{
                      padding: "12px 16px", borderRadius: 10, marginBottom: 8,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{item.type}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{item.description} · {pos?.title}</div>
                      </div>
                      <span style={{
                        padding: "3px 10px", borderRadius: 12,
                        background: statusCfg.bg, color: statusCfg.color,
                        fontSize: 11, fontWeight: 600,
                      }}>
                        {statusCfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {activeNav === "employees" && (
              <div>
                <div style={{ marginBottom: 16, fontSize: 13, color: "#94a3b8" }}>
                  {SEED.employees.length} employees
                </div>
                {SEED.employees.map((emp) => {
                  const pos = SEED.positions.find((p) => p.id === emp.positionId);
                  return (
                    <div key={emp.id} style={{
                      padding: "12px 16px", borderRadius: 10, marginBottom: 8,
                      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", gap: 14,
                    }}>
                      <Avatar initials={emp.avatarInitials} color={emp.avatarColor} size={36} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0", marginBottom: 2 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: "#64748b" }}>{pos?.title} · {pos?.department}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#475569", marginBottom: 3 }}>{emp.location}</div>
                        <StatusDot status={emp.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!["org", "signals", "actions", "compliance", "employees"].includes(activeNav) && (
              <div style={{ color: "#475569", padding: "60px 0", textAlign: "center", fontSize: 13 }}>
                {activeNav.charAt(0).toUpperCase() + activeNav.slice(1)} view — select a section from the sidebar
              </div>
            )}

            {showJson && (
              <div style={{ marginTop: 24 }}>
                <JsonInspectorPanel seed={SEED} controlState={controlState} uiState={uiState} />
              </div>
            )}
          </div>

          {/* Right Detail Panel */}
          <div style={{
            width: 320, flexShrink: 0,
            background: "#13161f", borderLeft: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <RightPanel
              uiState={uiState}
              onResolveAction={resolveAction}
              onClose={() => setControlState((prev) => ({ ...prev, selectedPositionId: "1-001" }))}
              onEditPosition={() => setEditingPosition(uiState.selectedPosition?.id ?? null)}
              isEditing={editingPosition === uiState.selectedPosition?.id}
              onSaveEdit={updatePosition}
              onCancelEdit={() => setEditingPosition(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
