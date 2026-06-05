type EmptyOrgGuideProps = {
  onCreatePosition: () => void;
  disabled?: boolean;
};

export function EmptyOrgGuide({ onCreatePosition, disabled }: EmptyOrgGuideProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 480,
        padding: "48px 32px",
        textAlign: "center",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)",
          border: "1.5px solid #BFDBFE",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          {/* Chart hierarchy icon */}
          <rect x="13" y="3" width="8" height="7" rx="2.5" fill="#3B82F6" />
          <rect x="4" y="18" width="8" height="7" rx="2.5" fill="#93C5FD" />
          <rect x="13" y="18" width="8" height="7" rx="2.5" fill="#93C5FD" />
          <rect x="22" y="18" width="8" height="7" rx="2.5" fill="#93C5FD" />
          <line x1="17" y1="10" x2="17" y2="18" stroke="#BFDBFE" strokeWidth="1.5" />
          <line x1="8" y1="14" x2="26" y2="14" stroke="#BFDBFE" strokeWidth="1.5" />
          <line x1="8" y1="14" x2="8" y2="18" stroke="#BFDBFE" strokeWidth="1.5" />
          <line x1="26" y1="14" x2="26" y2="18" stroke="#BFDBFE" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Headline */}
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "#0F172A",
          marginBottom: 10,
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        Build your org chart
      </h2>

      {/* Subtext */}
      <p
        style={{
          fontSize: 14,
          color: "#64748B",
          lineHeight: 1.6,
          maxWidth: 320,
          marginBottom: 32,
        }}
      >
        Start by creating your first position. TeamFrame will help you map your team
        structure, track assignments, and keep compliance up to date.
      </p>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onCreatePosition}
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: disabled
            ? "#94A3B8"
            : "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
          color: "#FFFFFF",
          border: "none",
          borderRadius: 10,
          padding: "12px 24px",
          fontSize: 14,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: disabled ? "none" : "0 4px 14px rgba(37,99,235,0.35)",
          transition: "box-shadow 0.15s, opacity 0.15s",
          letterSpacing: "0.01em",
        }}
        onMouseEnter={(e) => {
          if (!disabled)
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 6px 20px rgba(37,99,235,0.45)";
        }}
        onMouseLeave={(e) => {
          if (!disabled)
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 14px rgba(37,99,235,0.35)";
        }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path
            d="M7.5 1.5v12M1.5 7.5h12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Create first position
      </button>

      {/* Hint */}
      <p
        style={{
          fontSize: 12,
          color: "#94A3B8",
          marginTop: 20,
          lineHeight: 1.5,
        }}
      >
        You can also add a team first from the{" "}
        <span style={{ color: "#64748B", fontWeight: 600 }}>Team</span> section.
      </p>
    </div>
  );
}
