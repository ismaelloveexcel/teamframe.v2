import {
  GitBranch,
  CheckSquare,
  Users,
  ShieldCheck,
  LayoutTemplate,
  Settings,
} from "lucide-react";

export type NavId = "org" | "actions" | "team" | "policies" | "templates" | "administration";

type NavItem = {
  id: NavId;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { id: "org",            label: "Org Chart",      icon: <GitBranch size={16} strokeWidth={2} /> },
  { id: "actions",        label: "Actions",         icon: <CheckSquare size={16} strokeWidth={2} /> },
  { id: "team",           label: "Team",            icon: <Users size={16} strokeWidth={2} /> },
  { id: "policies",       label: "Policies",        icon: <ShieldCheck size={16} strokeWidth={2} /> },
  { id: "templates",      label: "Templates",       icon: <LayoutTemplate size={16} strokeWidth={2} /> },
  { id: "administration", label: "Administration",  icon: <Settings size={16} strokeWidth={2} /> },
];

type HealthBadge = {
  label: string;
  value: number | string;
  urgent?: boolean;
  onClick?: () => void;
};

type AppShellProps = {
  activeNav: NavId;
  onNavChange: (id: NavId) => void;
  health: HealthBadge[];
  statusMessage?: string | null;
  errorMessage?: string | null;
  isDemoMode?: boolean;
  children: React.ReactNode;
};

export function AppShell({
  activeNav,
  onNavChange,
  health,
  statusMessage,
  errorMessage,
  isDemoMode,
  children,
}: AppShellProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F1F5F9",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gridTemplateRows: "auto 1fr",
        gap: 0,
      }}
    >
      {/* Sidebar */}
      <aside
        style={{
          gridRow: "1 / 3",
          background: "#0B1220",
          borderRight: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 12px",
          gap: 2,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "4px 8px 20px",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 0 12px rgba(59,130,246,0.25)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="2" y="2" width="4.5" height="4.5" rx="1.5" fill="white" opacity="0.9" />
              <rect x="8.5" y="2" width="4.5" height="4.5" rx="1.5" fill="white" opacity="0.6" />
              <rect x="2" y="8.5" width="4.5" height="4.5" rx="1.5" fill="white" opacity="0.6" />
              <rect x="8.5" y="8.5" width="4.5" height="4.5" rx="1.5" fill="white" opacity="0.9" />
            </svg>
          </div>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "#F8FAFC",
              letterSpacing: "-0.02em",
            }}
          >
            TeamFrame
          </span>
        </div>

        {/* Nav */}
        {NAV_ITEMS.map((item) => {
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavChange(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 9,
                width: "100%",
                textAlign: "left",
                border: "none",
                borderRadius: 8,
                padding: "8px 10px",
                background: isActive ? "#1E293B" : "transparent",
                color: isActive ? "#E2E8F0" : "#64748B",
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
                boxShadow: isActive ? "inset 1px 0 0 #3B82F6" : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "#111827";
                  (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = "#64748B";
                }
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}

        {/* Demo mode badge */}
        {isDemoMode && (
          <div
            style={{
              marginTop: "auto",
              borderRadius: 8,
              padding: "8px 10px",
              background: "rgba(234,179,8,0.1)",
              border: "1px solid rgba(234,179,8,0.2)",
              fontSize: 11,
              color: "#CA8A04",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M6 1l.9 2.8H10L7.6 5.6l.9 2.8L6 6.8l-2.5 1.6.9-2.8L2 3.8h3.1z"
                fill="currentColor"
              />
            </svg>
            Demo mode
          </div>
        )}
      </aside>

      {/* Top context bar */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Health badges — clickable when onClick provided */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {health.map((badge) => {
            const isUrgent = badge.urgent && Number(badge.value) > 0;
            const isClickable = !!badge.onClick && Number(badge.value) > 0;
            return (
              <button
                key={badge.label}
                type="button"
                onClick={badge.onClick}
                disabled={!isClickable}
                title={isClickable ? `View ${badge.label}` : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: isUrgent ? "#FEF2F2" : "#F8FAFC",
                  border: `1px solid ${isUrgent ? "#FECACA" : "#E2E8F0"}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: isUrgent ? "#DC2626" : "#475569",
                  cursor: isClickable ? "pointer" : "default",
                  transition: "box-shadow 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (isClickable)
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 4px rgba(15,23,42,0.10)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                <span style={{ fontWeight: 700, color: isUrgent ? "#DC2626" : "#0F172A" }}>
                  {badge.value}
                </span>
                <span style={{ fontWeight: 500 }}>{badge.label}</span>
                {isClickable && (
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 9 9"
                    fill="none"
                    style={{ opacity: 0.5, marginLeft: 1 }}
                  >
                    <path
                      d="M2 4.5h5M5 2.5l2 2-2 2"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Status / error message */}
        <div style={{ fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
          {statusMessage && (
            <span style={{ color: "#2563EB", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="6" cy="6" r="5" stroke="#BFDBFE" strokeWidth="2" />
                <path d="M6 1a5 5 0 0 1 5 5" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {statusMessage}
            </span>
          )}
          {!statusMessage && errorMessage && (
            <span
              style={{
                color: isDemoMode ? "#B45309" : "#DC2626",
                maxWidth: 360,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "block",
              }}
            >
              {errorMessage}
            </span>
          )}
        </div>
      </header>

      {/* Main content area */}
      <main
        style={{
          padding: 20,
          overflow: "auto",
          minHeight: 0,
        }}
      >
        {children}
      </main>
    </div>
  );
}
