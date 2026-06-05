type OrgHealthSummaryProps = {
  totalPositions: number;
  filledPositions: number;
  vacantPositions: number;
  openActions: number;
  overdueActions: number;
  blockedActions: number;
  complianceAlerts: number;
  onClickVacancies: () => void;
  onClickActions: () => void;
  onClickCompliance: () => void;
};

function healthNarrative(
  total: number,
  filled: number,
  vacant: number,
  openActions: number,
  overdueActions: number,
  blockedActions: number,
  complianceAlerts: number,
): string[] {
  if (total === 0) return [];
  const lines: string[] = [];
  const pct = Math.round((filled / total) * 100);
  if (pct === 100) {
    lines.push(`All ${total} positions are filled.`);
  } else {
    lines.push(`Organization is ${pct}% staffed.`);
  }
  if (vacant > 0) {
    lines.push(`${vacant} position${vacant === 1 ? " is" : "s are"} vacant.`);
  }
  const urgentActions = overdueActions + blockedActions;
  if (urgentActions > 0) {
    lines.push(`${urgentActions} action${urgentActions === 1 ? "" : "s"} require attention.`);
  } else if (openActions > 0) {
    lines.push(`${openActions} open action${openActions === 1 ? "" : "s"} in progress.`);
  }
  if (complianceAlerts > 0) {
    lines.push(`${complianceAlerts} compliance item${complianceAlerts === 1 ? "" : "s"} unresolved.`);
  }
  return lines;
}

type MetricCardProps = {
  label: string;
  value: number;
  tone: "neutral" | "warning" | "danger" | "success";
  sublabel?: string;
  clickable?: boolean;
  onClick?: () => void;
};

function MetricCard({ label, value, tone, sublabel, clickable, onClick }: MetricCardProps) {
  const colors = {
    neutral: { bg: "#F8FAFC", border: "#E2E8F0", value: "#0F172A", label: "#64748B" },
    success: { bg: "#F0FDF4", border: "#BBF7D0", value: "#059669", label: "#6EE7B7" },
    warning: { bg: "#FFFBEB", border: "#FDE68A", value: "#B45309", label: "#D97706" },
    danger:  { bg: "#FEF2F2", border: "#FECACA", value: "#DC2626", label: "#EF4444" },
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        textAlign: "left",
        cursor: clickable ? "pointer" : "default",
        transition: "box-shadow 0.12s",
        flex: "1 1 100px",
        minWidth: 90,
      }}
      onMouseEnter={(e) => {
        if (clickable)
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 8px rgba(15,23,42,0.10)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: colors.value,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.label }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 10, color: colors.label, opacity: 0.75, marginTop: 2 }}>
          {sublabel}
        </div>
      )}
      {clickable && (
        <div style={{ fontSize: 10, color: colors.label, opacity: 0.6, marginTop: 4 }}>
          View details →
        </div>
      )}
    </button>
  );
}

export function OrgHealthSummary({
  totalPositions,
  filledPositions,
  vacantPositions,
  openActions,
  overdueActions,
  blockedActions,
  complianceAlerts,
  onClickVacancies,
  onClickActions,
  onClickCompliance,
}: OrgHealthSummaryProps) {
  if (totalPositions === 0) return null;

  const narrative = healthNarrative(
    totalPositions,
    filledPositions,
    vacantPositions,
    openActions,
    overdueActions,
    blockedActions,
    complianceAlerts,
  );
  const urgentActions = overdueActions + blockedActions;
  const pct = Math.round((filledPositions / totalPositions) * 100);
  const allClear = vacantPositions === 0 && urgentActions === 0 && complianceAlerts === 0;

  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 12,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: allClear ? "#22C55E" : urgentActions > 0 || complianceAlerts > 0 ? "#F59E0B" : "#3B82F6",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#0F172A",
              letterSpacing: "-0.01em",
            }}
          >
            Organization Status
          </span>
        </div>
        {/* Coverage bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 80,
              height: 4,
              background: "#E2E8F0",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${pct}%`,
                background: pct === 100 ? "#22C55E" : pct >= 80 ? "#3B82F6" : "#F59E0B",
                borderRadius: 99,
                transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B" }}>{pct}% staffed</span>
        </div>
      </div>

      {/* Narrative */}
      <div style={{ marginBottom: 14 }}>
        {narrative.map((line, i) => (
          <p
            key={i}
            style={{
              margin: 0,
              fontSize: 13,
              color: i === 0 ? "#0F172A" : "#475569",
              fontWeight: i === 0 ? 600 : 400,
              lineHeight: 1.6,
            }}
          >
            {line}
          </p>
        ))}
        {allClear && (
          <p style={{ margin: 0, fontSize: 13, color: "#059669", fontWeight: 500, lineHeight: 1.6 }}>
            No issues detected. Your org is operating cleanly.
          </p>
        )}
      </div>

      {/* Metric cards */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <MetricCard
          label="filled"
          value={filledPositions}
          tone={filledPositions === totalPositions ? "success" : "neutral"}
          sublabel={`of ${totalPositions}`}
        />
        {vacantPositions > 0 && (
          <MetricCard
            label="vacant"
            value={vacantPositions}
            tone={vacantPositions >= 2 ? "warning" : "neutral"}
            clickable
            onClick={onClickVacancies}
          />
        )}
        {urgentActions > 0 && (
          <MetricCard
            label="needs attention"
            value={urgentActions}
            tone="danger"
            sublabel={[overdueActions > 0 ? `${overdueActions} overdue` : "", blockedActions > 0 ? `${blockedActions} blocked` : ""].filter(Boolean).join(" · ")}
            clickable
            onClick={onClickActions}
          />
        )}
        {openActions > 0 && urgentActions === 0 && (
          <MetricCard
            label="open actions"
            value={openActions}
            tone="neutral"
            clickable
            onClick={onClickActions}
          />
        )}
        {complianceAlerts > 0 && (
          <MetricCard
            label="compliance gaps"
            value={complianceAlerts}
            tone="warning"
            clickable
            onClick={onClickCompliance}
          />
        )}
      </div>
    </div>
  );
}
