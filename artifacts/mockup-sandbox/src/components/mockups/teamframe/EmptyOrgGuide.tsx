import { COLOR, RADIUS, TEXT, SPACE } from "./design-tokens";
import { PrimaryButton } from "./PrimaryButton";

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
        padding: `${SPACE[12]}px ${SPACE[8]}px`,
        textAlign: "center",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      {/* Illustration */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: RADIUS.lg,
          background: `linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)`,
          border: `1.5px solid ${COLOR.brandLight}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: SPACE[6],
        }}
      >
        <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
          <rect x="13" y="3" width="8" height="7" rx="2.5" fill={COLOR.accent} />
          <rect x="4" y="18" width="8" height="7" rx="2.5" fill="#93C5FD" />
          <rect x="13" y="18" width="8" height="7" rx="2.5" fill="#93C5FD" />
          <rect x="22" y="18" width="8" height="7" rx="2.5" fill="#93C5FD" />
          <line x1="17" y1="10" x2="17" y2="18" stroke={COLOR.brandLight} strokeWidth="1.5" />
          <line x1="8" y1="14" x2="26" y2="14" stroke={COLOR.brandLight} strokeWidth="1.5" />
          <line x1="8" y1="14" x2="8" y2="18" stroke={COLOR.brandLight} strokeWidth="1.5" />
          <line x1="26" y1="14" x2="26" y2="18" stroke={COLOR.brandLight} strokeWidth="1.5" />
        </svg>
      </div>

      {/* Headline */}
      <h2
        style={{
          fontSize: TEXT.md,
          fontWeight: 800,
          color: COLOR.textPrimary,
          marginBottom: SPACE[2],
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}
      >
        Build your org chart
      </h2>

      {/* Subtext */}
      <p
        style={{
          fontSize: TEXT.base,
          color: COLOR.textSecondary,
          lineHeight: 1.6,
          maxWidth: 320,
          marginBottom: SPACE[8],
        }}
      >
        Start by creating your first position. TeamFrame will help you map your team
        structure, track assignments, and keep compliance up to date.
      </p>

      {/* Primary CTA */}
      <PrimaryButton
        variant="primary"
        size="lg"
        onClick={onCreatePosition}
        disabled={disabled}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 1.5v12M1.5 7.5h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Create first position
      </PrimaryButton>

      {/* Hint */}
      <p
        style={{
          fontSize: TEXT.micro,
          color: COLOR.textMuted,
          marginTop: SPACE[5],
          lineHeight: 1.5,
        }}
      >
        You can also add a team first from the{" "}
        <span style={{ color: COLOR.textSecondary, fontWeight: 600 }}>Team</span> section.
      </p>
    </div>
  );
}
