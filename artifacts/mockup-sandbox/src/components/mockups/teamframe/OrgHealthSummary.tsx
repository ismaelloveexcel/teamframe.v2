import { COLOR, RADIUS, SHADOW, TEXT, SPACE, FOCUS_RING } from "./design-tokens";

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

/**
 * Narrative priority: lead with the most urgent signal.
 * Order: compliance → blocked → overdue → vacancies → staffing ratio
 */
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

  if (complianceAlerts > 0) {
    lines.push(`${complianceAlerts} compliance item${complianceAlerts === 1 ? "" : "s"} require${complianceAlerts === 1 ? "s" : ""} attention.`);
  }
  if (blockedActions > 0) {
    lines.push(`${blockedActions} action${blockedActions === 1 ? " is" : "s are"} blocked.`);
  }
  if (overdueActions > 0) {
    lines.push(`${overdueActions} action${overdueActions === 1 ? " is" : "s are"} overdue.`);
  }
  if (vacant > 0) {
    lines.push(`${vacant} position${vacant === 1 ? " is" : "s are"} vacant.`);
  }
  if (pct === 100) {
    lines.push(`All ${total} positions are filled.`);
  } else {
    lines.push(`Organization is ${pct}% staffed.`);
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

const TONE_COLORS = {
  neutral: { bg: COLOR.rowBg,       border: COLOR.borderDefault, value: COLOR.textPrimary,   label: COLOR.textSecondary },
  success: { bg: "#F0FDF4",         border: "#BBF7D0",           value: COLOR.success,        label: "#6EE7B7"           },
  warning: { bg: COLOR.warningLight, border: COLOR.warningBorder, value: COLOR.warning,       label: COLOR.warning        },
  danger:  { bg: COLOR.dangerLight,  border: COLOR.dangerBorder,  value: COLOR.danger,        label: COLOR.danger         },
} as const;

function MetricCard({ label, value, tone, sublabel, clickable, onClick }: MetricCardProps) {
  const c = TONE_COLORS[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: RADIUS.md,
        padding: `${SPACE[2]+2}px ${SPACE[3]}px`,
        textAlign: "left",
        cursor: clickable ? "pointer" : "default",
        transition: "box-shadow 0.12s",
        flex: "1 1 100px",
        minWidth: 90,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
      onMouseEnter={(e) => { if (clickable) (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW.md; }}
      onMouseLeave={(e) => { if (clickable) (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
      onFocus={(e) => { (e.currentTarget as HTMLButtonElement).style.outline = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = FOCUS_RING; }}
      onBlur={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
    >
      <div style={{ fontSize: TEXT.lg, fontWeight: 800, color: c.value, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: SPACE[1] }}>
        {value}
      </div>
      <div style={{ fontSize: TEXT.micro, fontWeight: 600, color: c.label }}>{label}</div>
      {sublabel && <div style={{ fontSize: TEXT.micro - 1, color: c.label, opacity: 0.75, marginTop: 2 }}>{sublabel}</div>}
      {clickable && <div style={{ fontSize: TEXT.micro - 1, color: c.label, opacity: 0.6, marginTop: SPACE[1] }}>View details →</div>}
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

  const narrative = healthNarrative(totalPositions, filledPositions, vacantPositions, openActions, overdueActions, blockedActions, complianceAlerts);
  const urgentActions = overdueActions + blockedActions;
  const pct = Math.round((filledPositions / totalPositions) * 100);
  const allClear = vacantPositions === 0 && urgentActions === 0 && complianceAlerts === 0;

  const dotColor = allClear ? COLOR.success : (urgentActions > 0 || complianceAlerts > 0) ? "#F59E0B" : COLOR.brand;

  return (
    <div
      style={{
        background: COLOR.cardBg,
        border: `1px solid ${COLOR.borderSubtle}`,
        borderRadius: RADIUS.lg,
        padding: `${SPACE[4]}px ${SPACE[5]}px`,
        marginBottom: SPACE[3],
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE[3] }}>
        <div style={{ display: "flex", alignItems: "center", gap: SPACE[2] }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: TEXT.sm, fontWeight: 700, color: COLOR.textPrimary, letterSpacing: "-0.01em" }}>
            Organization Status
          </span>
        </div>
        {/* Coverage bar */}
        <div style={{ display: "flex", alignItems: "center", gap: SPACE[2] }}>
          <div style={{ width: 80, height: 4, background: COLOR.borderDefault, borderRadius: RADIUS.pill, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${pct}%`,
              background: pct === 100 ? COLOR.success : pct >= 80 ? COLOR.brand : "#F59E0B",
              borderRadius: RADIUS.pill,
              transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
            }} />
          </div>
          <span style={{ fontSize: TEXT.micro, fontWeight: 700, color: COLOR.textSecondary }}>{pct}% staffed</span>
        </div>
      </div>

      {/* Narrative */}
      <div style={{ marginBottom: SPACE[3]+2 }}>
        {narrative.map((line, i) => (
          <p key={i} style={{ margin: 0, fontSize: TEXT.sm, color: i === 0 ? COLOR.textPrimary : COLOR.textSecondary, fontWeight: i === 0 ? 600 : 400, lineHeight: 1.6 }}>
            {line}
          </p>
        ))}
        {allClear && (
          <p style={{ margin: 0, fontSize: TEXT.sm, color: COLOR.success, fontWeight: 500, lineHeight: 1.6 }}>
            No issues detected. Your org is operating cleanly.
          </p>
        )}
      </div>

      {/* Metric cards */}
      <div style={{ display: "flex", gap: SPACE[2], flexWrap: "wrap" }}>
        <MetricCard label="filled" value={filledPositions} tone={filledPositions === totalPositions ? "success" : "neutral"} sublabel={`of ${totalPositions}`} />
        {vacantPositions > 0 && <MetricCard label="vacant" value={vacantPositions} tone={vacantPositions >= 2 ? "warning" : "neutral"} clickable onClick={onClickVacancies} />}
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
        {openActions > 0 && urgentActions === 0 && <MetricCard label="open actions" value={openActions} tone="neutral" clickable onClick={onClickActions} />}
        {complianceAlerts > 0 && <MetricCard label="compliance gaps" value={complianceAlerts} tone="warning" clickable onClick={onClickCompliance} />}
      </div>
    </div>
  );
}
