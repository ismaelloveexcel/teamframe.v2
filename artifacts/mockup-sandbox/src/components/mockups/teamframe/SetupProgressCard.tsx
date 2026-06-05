import { useEffect, useState } from "react";

type Step = {
  id: "structure" | "assign" | "evidence";
  label: string;
  done: boolean;
};

type SetupProgressCardProps = {
  positionTitle: string;
  hasAssignment: boolean;
  hasEvidence: boolean;
  compliancePct: number;
  onCompleteEvidence: () => void;
  onDismiss: () => void;
};

export function SetupProgressCard({
  positionTitle,
  hasAssignment,
  hasEvidence,
  compliancePct,
  onCompleteEvidence,
  onDismiss,
}: SetupProgressCardProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  const steps: Step[] = [
    { id: "structure", label: "Structure", done: true },
    { id: "assign",    label: "Assignment", done: hasAssignment },
    { id: "evidence",  label: "Evidence",   done: hasEvidence },
  ];

  const nextStep = steps.find((s) => !s.done);
  const allDone = !nextStep;

  if (allDone) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        right: 24,
        width: 300,
        background: "#0F172A",
        border: "1px solid #1E293B",
        borderRadius: 14,
        padding: "16px 18px",
        zIndex: 90,
        opacity: visible ? 1 : 0,
        transform: `translateY(${visible ? "0px" : "12px"})`,
        transition: "opacity 0.3s ease, transform 0.3s ease",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        boxShadow: "0 20px 48px rgba(2,6,23,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#F8FAFC", marginBottom: 2 }}>
            Setup Progress
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#64748B",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 200,
            }}
          >
            {positionTitle}
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            color: "#475569",
            cursor: "pointer",
            fontSize: 16,
            padding: "0 0 0 8px",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Steps */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
        {steps.map((step, i) => (
          <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: step.done
                    ? "linear-gradient(135deg,#059669,#047857)"
                    : "rgba(255,255,255,0.06)",
                  border: step.done ? "none" : "1.5px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {step.done ? (
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.3)",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: step.done ? 600 : 400,
                  color: step.done ? "#6EE7B7" : "#64748B",
                  letterSpacing: "0.02em",
                }}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  height: 1,
                  flex: 1,
                  background: step.done ? "#059669" : "rgba(255,255,255,0.08)",
                  marginBottom: 18,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Evidence progress bar */}
      {nextStep?.id === "evidence" && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 11, color: "#94A3B8" }}>Evidence completion</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#CBD5E1" }}>
              {compliancePct}%
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.07)",
              borderRadius: 99,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${compliancePct}%`,
                background: compliancePct === 100 ? "#22C55E" : "#3B82F6",
                borderRadius: 99,
                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
              }}
            />
          </div>
        </div>
      )}

      {/* CTA */}
      {nextStep && (
        <button
          type="button"
          onClick={onCompleteEvidence}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #2563EB, #1D4ED8)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 9,
            padding: "9px 0",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
            letterSpacing: "0.01em",
          }}
        >
          Complete Evidence →
        </button>
      )}
    </div>
  );
}
