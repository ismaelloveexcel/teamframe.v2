import { useEffect, useState } from "react";

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

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: `translateX(-50%) translateY(${visible ? "0px" : "16px"})`,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)",
        zIndex: 100,
        background: "#0F172A",
        border: "1px solid #1E293B",
        borderRadius: 14,
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 20px 48px rgba(2,6,23,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
        maxWidth: 480,
        width: "calc(100vw - 48px)",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: isFirstAssignment
            ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
            : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: isFirstAssignment
            ? "0 0 16px rgba(5,150,105,0.3)"
            : "0 0 16px rgba(59,130,246,0.3)",
        }}
      >
        {isFirstAssignment ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3.5 9.5l4 4 7-7"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "#F8FAFC",
            marginBottom: 2,
            letterSpacing: "-0.01em",
          }}
        >
          {isFirstAssignment ? "Position filled — org chart is live." : "Your org chart is live."}
        </div>
        <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.4 }}>
          {isFirstAssignment
            ? `${filledCount} of ${positionCount} position${positionCount > 1 ? "s" : ""} filled.`
            : "Now assign a person to this position to get started."}
        </div>
      </div>

      {/* Action */}
      {!isFirstAssignment && (
        <button
          type="button"
          onClick={onAssignPerson}
          style={{
            background: "#2563EB",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 8,
            padding: "8px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          Assign person
        </button>
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
          color: "#475569",
          padding: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderRadius: 6,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 2l10 10M12 2L2 12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
