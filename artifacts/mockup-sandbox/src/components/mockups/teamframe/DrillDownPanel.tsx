import { useEffect } from "react";

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
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
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
  vacancies: "Vacant Positions",
  actions: "Actions Requiring Attention",
  compliance: "Compliance Gaps",
};

const PANEL_EMPTY: Record<NonNullable<DrillDownMode>, string> = {
  vacancies: "No vacant positions.",
  actions: "No actions require attention.",
  compliance: "No compliance gaps detected.",
};

export function DrillDownPanel({
  mode,
  onClose,
  vacancies,
  actions,
  compliance,
  onSelectPosition,
}: DrillDownPanelProps) {
  useEffect(() => {
    if (!mode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, onClose]);

  if (!mode) return null;

  const title = PANEL_TITLES[mode];
  const emptyMessage = PANEL_EMPTY[mode];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15,23,42,0.35)",
          zIndex: 50,
        }}
      />

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
          background: "#FFFFFF",
          borderLeft: "1px solid #E5E7EB",
          zIndex: 51,
          display: "flex",
          flexDirection: "column",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          boxShadow: "-8px 0 32px rgba(15,23,42,0.10)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0F172A" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
              {mode === "vacancies" && `${vacancies.length} position${vacancies.length === 1 ? "" : "s"}`}
              {mode === "actions" && `${actions.length} action${actions.length === 1 ? "" : "s"}`}
              {mode === "compliance" && `${compliance.length} position${compliance.length === 1 ? "" : "s"} with gaps`}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
              fontSize: 16,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
          {/* Vacancies */}
          {mode === "vacancies" && (
            vacancies.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94A3B8", padding: "24px 0" }}>{emptyMessage}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vacancies.map((row) => (
                  <button
                    key={row.positionId}
                    type="button"
                    onClick={() => { onSelectPosition(row.positionId); onClose(); }}
                    style={{
                      background: "#FAFAFA",
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "border-color 0.12s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#93C5FD"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                      {row.title}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {row.teamName && (
                        <span style={{ fontSize: 11, color: "#64748B" }}>{row.teamName}</span>
                      )}
                      {row.reportsToTitle && (
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>
                          → {row.reportsToTitle}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 6,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#FFFBEB",
                        border: "1px solid #FDE68A",
                        borderRadius: 6,
                        padding: "2px 7px",
                        fontSize: 10,
                        color: "#92400E",
                        fontWeight: 600,
                      }}
                    >
                      Vacant · {formatVacancyAge(row.vacantSince)}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Actions */}
          {mode === "actions" && (
            actions.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94A3B8", padding: "24px 0" }}>{emptyMessage}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {actions.map((row) => (
                  <div
                    key={row.actionId}
                    style={{
                      background: row.overdue ? "#FEF2F2" : row.blocked ? "#FFFBEB" : "#FAFAFA",
                      border: `1px solid ${row.overdue ? "#FECACA" : row.blocked ? "#FDE68A" : "#E2E8F0"}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", flex: 1 }}>
                        {row.title}
                      </div>
                      {row.overdue && (
                        <span
                          style={{
                            flexShrink: 0,
                            background: "#FEE2E2",
                            color: "#DC2626",
                            borderRadius: 5,
                            padding: "2px 6px",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          Overdue
                        </span>
                      )}
                      {!row.overdue && row.blocked && (
                        <span
                          style={{
                            flexShrink: 0,
                            background: "#FEF3C7",
                            color: "#92400E",
                            borderRadius: 5,
                            padding: "2px 6px",
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          Blocked
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {row.ownerName && (
                        <span style={{ fontSize: 11, color: "#64748B" }}>{row.ownerName}</span>
                      )}
                      {row.positionTitle && (
                        <span style={{ fontSize: 11, color: "#94A3B8" }}>
                          via {row.positionTitle}
                        </span>
                      )}
                      {row.dueDate && (
                        <span
                          style={{
                            fontSize: 11,
                            color: row.overdue ? "#DC2626" : "#64748B",
                            fontWeight: row.overdue ? 600 : 400,
                          }}
                        >
                          {formatDueDate(row.dueDate, row.overdue)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Compliance */}
          {mode === "compliance" && (
            compliance.length === 0 ? (
              <div style={{ fontSize: 13, color: "#94A3B8", padding: "24px 0" }}>{emptyMessage}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {compliance.map((row) => (
                  <button
                    key={row.positionId}
                    type="button"
                    onClick={() => { onSelectPosition(row.positionId); onClose(); }}
                    style={{
                      background: "#FAFAFA",
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "12px 14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "border-color 0.12s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#93C5FD"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E2E8F0"; }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>
                      {row.positionTitle}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6 }}>
                      {row.personName}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {row.missingEmail && (
                        <span
                          style={{
                            background: "#FEF3C7",
                            border: "1px solid #FDE68A",
                            borderRadius: 5,
                            padding: "2px 7px",
                            fontSize: 10,
                            color: "#92400E",
                            fontWeight: 600,
                          }}
                        >
                          Missing email
                        </span>
                      )}
                      {row.missingPhone && (
                        <span
                          style={{
                            background: "#FEF3C7",
                            border: "1px solid #FDE68A",
                            borderRadius: 5,
                            padding: "2px 7px",
                            fontSize: 10,
                            color: "#92400E",
                            fontWeight: 600,
                          }}
                        >
                          Missing phone
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
