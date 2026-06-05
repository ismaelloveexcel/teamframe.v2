import { useEffect, useState } from "react";
import { COLOR, GRADIENT, RADIUS, TEXT, SPACE } from "./design-tokens";
import { PrimaryButton } from "./PrimaryButton";
import { DarkToast } from "./DarkToast";

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
    { id: "structure", label: "Structure",  done: true },
    { id: "assign",    label: "Assignment", done: hasAssignment },
    { id: "evidence",  label: "Evidence",   done: hasEvidence },
  ];

  const nextStep = steps.find((s) => !s.done);
  if (!nextStep) return null;

  return (
    <DarkToast visible={visible} position="bottom-right" aria-label="Setup progress">
      <div style={{ padding: `${SPACE[4]}px ${SPACE[4]+2}px` }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACE[3] }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: TEXT.sm, fontWeight: 700, color: COLOR.textInverse, marginBottom: 2 }}>
              Setup Progress
            </div>
            <div style={{
              fontSize: TEXT.micro,
              color: COLOR.textSecondary,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 200,
            }}>
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
              color: COLOR.textSecondary,
              cursor: "pointer",
              fontSize: TEXT.md,
              padding: `0 0 0 ${SPACE[2]}px`,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", alignItems: "center", gap: SPACE[1]+2, marginBottom: SPACE[3] }}>
          {steps.map((step, i) => (
            <div key={step.id} style={{ display: "flex", alignItems: "center", gap: SPACE[1]+2, flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SPACE[1], flex: 1 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: step.done ? GRADIENT.success : "rgba(255,255,255,0.06)",
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
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)" }} />
                  )}
                </div>
                <span style={{ fontSize: TEXT.micro, fontWeight: step.done ? 600 : 400, color: step.done ? "#6EE7B7" : COLOR.textSecondary }}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ height: 1, flex: 1, background: step.done ? COLOR.success : "rgba(255,255,255,0.08)", marginBottom: 18 }} />
              )}
            </div>
          ))}
        </div>

        {/* Evidence progress bar */}
        {nextStep.id === "evidence" && (
          <div style={{ marginBottom: SPACE[3] }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE[1]+2 }}>
              <span style={{ fontSize: TEXT.micro, color: COLOR.textMuted }}>Evidence completion</span>
              <span style={{ fontSize: TEXT.micro, fontWeight: 700, color: COLOR.textInverse }}>{compliancePct}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: RADIUS.pill, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${compliancePct}%`,
                background: compliancePct === 100 ? COLOR.success : COLOR.brand,
                borderRadius: RADIUS.pill,
                transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>
          </div>
        )}

        {/* CTA */}
        <PrimaryButton size="md" onClick={onCompleteEvidence} fullWidth>
          Complete Evidence →
        </PrimaryButton>
      </div>
    </DarkToast>
  );
}
