import { useEffect, useState } from "react";

const STEPS = [
  { message: "Connecting to your workspace…", duration: 800 },
  { message: "Loading your org structure…", duration: 900 },
  { message: "Preparing your dashboard…", duration: 600 },
];

export function LoadingScreen() {
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let idx = 0;
    function advance() {
      idx += 1;
      if (idx < STEPS.length) {
        setVisible(false);
        setTimeout(() => {
          setStepIndex(idx);
          setVisible(true);
          setTimeout(advance, STEPS[idx]?.duration ?? 800);
        }, 200);
      }
    }
    const t = setTimeout(advance, STEPS[0]?.duration ?? 800);
    return () => clearTimeout(t);
  }, []);

  const message = STEPS[stepIndex]?.message ?? STEPS[0]!.message;
  const progress = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#080E1A",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        gap: 0,
      }}
    >
      {/* Wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 52,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 24px rgba(59,130,246,0.35)",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="3" width="6" height="6" rx="2" fill="white" opacity="0.9" />
            <rect x="11" y="3" width="6" height="6" rx="2" fill="white" opacity="0.6" />
            <rect x="3" y="11" width="6" height="6" rx="2" fill="white" opacity="0.6" />
            <rect x="11" y="11" width="6" height="6" rx="2" fill="white" opacity="0.9" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#F8FAFC",
            letterSpacing: "-0.02em",
          }}
        >
          TeamFrame
        </span>
      </div>

      {/* Progress track */}
      <div
        style={{
          width: 240,
          height: 2,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 99,
          overflow: "hidden",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "linear-gradient(90deg, #3B82F6, #60A5FA)",
            borderRadius: 99,
            transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>

      {/* Status message */}
      <div
        style={{
          fontSize: 13,
          color: "#94A3B8",
          fontWeight: 500,
          letterSpacing: "0.01em",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.2s ease",
          minHeight: 20,
          textAlign: "center",
        }}
      >
        {message}
      </div>
    </div>
  );
}
