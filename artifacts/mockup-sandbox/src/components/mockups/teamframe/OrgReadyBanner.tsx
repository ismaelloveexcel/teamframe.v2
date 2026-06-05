import { useEffect, useState } from "react";
import { COLOR, GRADIENT, RADIUS, TEXT, SPACE, Z } from "./design-tokens";
import { PrimaryButton } from "./PrimaryButton";
import { DarkToast } from "./DarkToast";

type OrgReadyBannerProps = {
  positionCount: number;
  filledCount: number;
  onAssignPerson: () => void;
  onDismiss: () => void;
};

export function OrgReadyBanner({
  positionCount,
  filledCount,
  onAssignPerson,
  onDismiss,
}: OrgReadyBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const isFirstPosition = positionCount === 1 && filledCount === 0;
  const isFirstAssignment = filledCount === 1;

  if (!isFirstPosition && !isFirstAssignment) return null;

  const isSuccess = isFirstAssignment;

  return (
    <DarkToast visible={visible} position="bottom-center" aria-label="Org ready notification">
      <div
        style={{
          padding: `${SPACE[3]}px ${SPACE[5]}px`,
          display: "flex",
          alignItems: "center",
          gap: SPACE[3],
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: RADIUS.sm,
            background: isSuccess ? GRADIENT.success : GRADIENT.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: isSuccess
              ? `0 0 16px ${COLOR.glowSuccess}`
              : `0 0 16px ${COLOR.glowBrand}`,
          }}
        >
          {isSuccess ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3.5 9.5l4 4 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="6" y="2" width="6" height="5" rx="1.5" fill="white" opacity="0.9" />
              <rect x="2" y="11" width="5" height="5" rx="1.5" fill="white" opacity="0.7" />
              <rect x="6.5" y="11" width="5" height="5" rx="1.5" fill="white" opacity="0.7" />
              <rect x="11" y="11" width="5" height="5" rx="1.5" fill="white" opacity="0.7" />
              <line x1="9" y1="7" x2="9" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="4.5" y1="9" x2="13.5" y2="9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="4.5" y1="9" x2="4.5" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="13.5" y1="9" x2="13.5" y2="11" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            </svg>
          )}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: TEXT.sm, fontWeight: 700, color: COLOR.textInverse, marginBottom: 2, letterSpacing: "-0.01em" }}>
            {isSuccess ? "Position filled — org chart is live." : "Your org chart is live."}
          </div>
          <div style={{ fontSize: TEXT.micro, color: COLOR.textMuted, lineHeight: 1.4 }}>
            {isSuccess
              ? `${filledCount} of ${positionCount} position${positionCount > 1 ? "s" : ""} filled.`
              : "Now assign a person to this position to get started."}
          </div>
        </div>

        {/* Action */}
        {!isSuccess && (
          <PrimaryButton size="sm" onClick={onAssignPerson}>
            Assign person
          </PrimaryButton>
        )}

        {/* Dismiss */}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: COLOR.textSecondary,
            padding: SPACE[1],
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderRadius: RADIUS.sm,
            fontSize: TEXT.md,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </DarkToast>
  );
}
