import { useEffect } from "react";
import { COLOR, RADIUS, SHADOW, TEXT, SPACE, FOCUS_RING, Z } from "./design-tokens";

export type DrillDownMode = "vacancies" | "actions" | "compliance" | null;

type VacancyRow = {
  positionId: string;
  title: string;
  teamName: string | null;
  reportsToTitle: string | null;
  vacantSince: string | null;
};

type ActionRow = {
  actionId: string;
  title: string;
  ownerName: string | null;
  positionTitle: string | null;
  dueDate: string | null;
  status: string;
  overdue: boolean;
  blocked: boolean;
};

type ComplianceRow = {
  positionId: string;
  positionTitle: string;
  personName: string;
  missingEmail: boolean;
  missingPhone: boolean;
};

type DrillDownPanelProps = {
  mode: DrillDownMode;
  onClose: () => void;
  vacancies: VacancyRow[];
  actions: ActionRow[];
  compliance: ComplianceRow[];
  onSelectPosition: (positionId: string) => void;
};

function formatVacancyAge(since: string | null): string {
  if (!since) return "Unknown";
  const ms = Date.now() - new Date(since).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

function formatDueDate(dueDate: string | null, overdue: boolean): string {
  if (!dueDate) return "No due date";
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return dueDate;
  const formatted = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return overdue ? `${formatted} (overdue)` : formatted;
}

const PANEL_TITLES: Record<NonNullable<DrillDownMode>, string> = {
  vacancies:   "Vacant Positions",
  actions:     "Actions Requiring Attention",
  compliance:  "Compliance Gaps",
};

const PANEL_EMPTY: Record<NonNullable<DrillDownMode>, string> = {
  vacancies:   "No vacant positions.",
  actions:     "No actions require attention.",
  compliance:  "No compliance gaps detected.",
};

function Tag({ children, tone }: { children: string; tone: "warning" | "danger" }) {
  const c = tone === "danger"
    ? { bg: "#FEE2E2", color: COLOR.danger, border: COLOR.dangerBorder }
    : { bg: COLOR.warningLight, color: COLOR.warning, border: COLOR.warningBorder };
  return (
    <span style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: RADIUS.sm, padding: `2px ${SPACE[1]+2}px`, fontSize: TEXT.micro, color: c.color, fontWeight: 700, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {children}
    </span>
  );
}

function ClickableRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ background: COLOR.rowBg, border: `1px solid ${COLOR.borderDefault}`, borderRadius: RADIUS.md, padding: `${SPACE[3]}px ${SPACE[3]+2}px`, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#93C5FD"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = COLOR.borderDefault; }}
      onFocus={(e) => { (e.currentTarget as HTMLButtonElement).style.outline = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = FOCUS_RING; }}
      onBlur={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
    >
      {children}
    </button>
  );
}

export function DrillDownPanel({ mode, onClose, vacancies, actions, compliance, onSelectPosition }: DrillDownPanelProps) {
  useEffect(() => {
    if (!mode) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, onClose]);

  if (!mode) return null;

  const title = PANEL_TITLES[mode];
  const emptyMessage = PANEL_EMPTY[mode];

  const rowCount = mode === "vacancies" ? vacancies.length : mode === "actions" ? actions.length : compliance.length;
  const rowLabel = mode === "compliance" ? `${rowCount} position${rowCount === 1 ? "" : "s"} with gaps` : `${rowCount} ${mode === "vacancies" ? "position" : "action"}${rowCount === 1 ? "" : "s"}`;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: COLOR.overlayDark, zIndex: Z.overlay }} />

      {/* Panel */}
      <div
        role="dialog"
        aria-label={title}
        style={{
          position: "fixed",
          top: 52,
          right: 0,
          width: 400,
          height: "calc(100vh - 52px)",
          background: COLOR.cardBg,
          borderLeft: `1px solid ${COLOR.borderSubtle}`,
          zIndex: Z.panel,
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          boxShadow: `-8px 0 32px ${SHADOW.md}`,
        }}
      >
        {/* Header */}
        <div style={{ padding: `${SPACE[4]}px ${SPACE[5]}px`, borderBottom: `1px solid ${COLOR.pageBg}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: TEXT.base, fontWeight: 800, color: COLOR.textPrimary }}>{title}</div>
            <div style={{ fontSize: TEXT.micro, color: COLOR.textMuted, marginTop: 2 }}>{rowLabel}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: COLOR.pageBg, border: `1px solid ${COLOR.borderDefault}`, borderRadius: RADIUS.sm, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: COLOR.textSecondary, fontSize: TEXT.md, lineHeight: 1 }}
            onFocus={(e) => { (e.currentTarget as HTMLButtonElement).style.outline = "none"; (e.currentTarget as HTMLButtonElement).style.boxShadow = FOCUS_RING; }}
            onBlur={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: `${SPACE[3]}px ${SPACE[5]}px` }}>
          {/* Vacancies */}
          {mode === "vacancies" && (
            vacancies.length === 0 ? (
              <div style={{ fontSize: TEXT.sm, color: COLOR.textMuted, padding: `${SPACE[6]}px 0` }}>{emptyMessage}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
                {vacancies.map((row) => (
                  <ClickableRow key={row.positionId} onClick={() => { onSelectPosition(row.positionId); onClose(); }}>
                    <div style={{ fontSize: TEXT.sm, fontWeight: 700, color: COLOR.textPrimary, marginBottom: SPACE[1] }}>{row.title}</div>
                    <div style={{ display: "flex", gap: SPACE[2]+4, flexWrap: "wrap" }}>
                      {row.teamName && <span style={{ fontSize: TEXT.micro, color: COLOR.textSecondary }}>{row.teamName}</span>}
                      {row.reportsToTitle && <span style={{ fontSize: TEXT.micro, color: COLOR.textMuted }}>→ {row.reportsToTitle}</span>}
                    </div>
                    <div style={{ marginTop: SPACE[1]+2 }}>
                      <Tag tone="warning">{`Vacant · ${formatVacancyAge(row.vacantSince)}`}</Tag>
                    </div>
                  </ClickableRow>
                ))}
              </div>
            )
          )}

          {/* Actions */}
          {mode === "actions" && (
            actions.length === 0 ? (
              <div style={{ fontSize: TEXT.sm, color: COLOR.textMuted, padding: `${SPACE[6]}px 0` }}>{emptyMessage}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
                {actions.map((row) => (
                  <div key={row.actionId} style={{ background: row.overdue ? COLOR.dangerLight : row.blocked ? COLOR.warningLight : COLOR.rowBg, border: `1px solid ${row.overdue ? COLOR.dangerBorder : row.blocked ? COLOR.warningBorder : COLOR.borderDefault}`, borderRadius: RADIUS.md, padding: `${SPACE[3]}px ${SPACE[3]+2}px` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SPACE[2], marginBottom: SPACE[1]+2 }}>
                      <div style={{ fontSize: TEXT.sm, fontWeight: 700, color: COLOR.textPrimary, flex: 1 }}>{row.title}</div>
                      {row.overdue && <Tag tone="danger">Overdue</Tag>}
                      {!row.overdue && row.blocked && <Tag tone="warning">Blocked</Tag>}
                    </div>
                    <div style={{ display: "flex", gap: SPACE[2]+4, flexWrap: "wrap" }}>
                      {row.ownerName && <span style={{ fontSize: TEXT.micro, color: COLOR.textSecondary }}>{row.ownerName}</span>}
                      {row.positionTitle && <span style={{ fontSize: TEXT.micro, color: COLOR.textMuted }}>via {row.positionTitle}</span>}
                      {row.dueDate && <span style={{ fontSize: TEXT.micro, color: row.overdue ? COLOR.danger : COLOR.textSecondary, fontWeight: row.overdue ? 600 : 400 }}>{formatDueDate(row.dueDate, row.overdue)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Compliance */}
          {mode === "compliance" && (
            compliance.length === 0 ? (
              <div style={{ fontSize: TEXT.sm, color: COLOR.textMuted, padding: `${SPACE[6]}px 0` }}>{emptyMessage}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: SPACE[2] }}>
                {compliance.map((row) => (
                  <ClickableRow key={row.positionId} onClick={() => { onSelectPosition(row.positionId); onClose(); }}>
                    <div style={{ fontSize: TEXT.sm, fontWeight: 700, color: COLOR.textPrimary, marginBottom: SPACE[1] }}>{row.positionTitle}</div>
                    <div style={{ fontSize: TEXT.micro, color: COLOR.textSecondary, marginBottom: SPACE[1]+2 }}>{row.personName}</div>
                    <div style={{ display: "flex", gap: SPACE[1]+2, flexWrap: "wrap" }}>
                      {row.missingEmail && <Tag tone="warning">Missing email</Tag>}
                      {row.missingPhone && <Tag tone="warning">Missing phone</Tag>}
                    </div>
                  </ClickableRow>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
