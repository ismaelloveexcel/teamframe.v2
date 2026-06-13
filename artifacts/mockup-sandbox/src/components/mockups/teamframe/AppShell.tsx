import { useState } from "react";
import {
  GitBranch,
  CheckSquare,
  Users,
  ShieldCheck,
  LayoutTemplate,
  Settings,
  Plus,
} from "lucide-react";
import { COLOR, GRADIENT, RADIUS, TEXT, SPACE, SHADOW, FOCUS_RING } from "./design-tokens";

export type OrgOption = { id: string; name: string };

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
  organizations?: OrgOption[];
  activeOrganizationId?: string | null;
  onSelectOrganization?: (id: string) => void;
  onCreateOrganization?: (name: string) => void;
  children: React.ReactNode;
};

export function AppShell({
  activeNav,
  onNavChange,
  health,
  statusMessage,
  errorMessage,
  isDemoMode,
  organizations,
  activeOrganizationId,
  onSelectOrganization,
  onCreateOrganization,
  children,
}: AppShellProps) {
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");
  const orgList = organizations ?? [];
  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLOR.pageBg,
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
          background: COLOR.sidebarBg,
          borderRight: `1px solid rgba(255,255,255,0.04)`,
          display: "flex",
          flexDirection: "column",
          padding: `${SPACE[5]}px ${SPACE[3]}px`,
          gap: 2,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: `${SPACE[1]}px ${SPACE[2]}px ${SPACE[5]}px`,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: RADIUS.sm,
              background: GRADIENT.logo,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: `0 0 12px ${COLOR.glowBrand}`,
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
              fontSize: TEXT.base,
              fontWeight: 800,
              color: COLOR.textInverse,
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
                borderRadius: RADIUS.sm,
                padding: `${SPACE[2]}px ${SPACE[2]+2}px`,
                background: isActive ? COLOR.navActive : "transparent",
                color: isActive ? "#E2E8F0" : COLOR.textSecondary,
                fontWeight: isActive ? 600 : 500,
                fontSize: TEXT.sm,
                cursor: "pointer",
                transition: "background 0.12s, color 0.12s",
                boxShadow: isActive ? `inset 1px 0 0 ${COLOR.navActiveLine}` : "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = COLOR.navHover;
                  (e.currentTarget as HTMLButtonElement).style.color = "#CBD5E1";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.color = COLOR.textSecondary;
                }
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLButtonElement).style.outline = "none";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = FOCUS_RING;
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = isActive ? `inset 1px 0 0 ${COLOR.navActiveLine}` : "none";
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
              borderRadius: RADIUS.sm,
              padding: `${SPACE[2]}px ${SPACE[2]+2}px`,
              background: "rgba(234,179,8,0.1)",
              border: "1px solid rgba(234,179,8,0.2)",
              fontSize: TEXT.micro,
              color: "#CA8A04",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: SPACE[1]+2,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1l.9 2.8H10L7.6 5.6l.9 2.8L6 6.8l-2.5 1.6.9-2.8L2 3.8h3.1z" fill="currentColor" />
            </svg>
            Demo mode
          </div>
        )}
      </aside>

      {/* Top context bar */}
      <header
        style={{
          background: COLOR.cardBg,
          borderBottom: `1px solid ${COLOR.borderSubtle}`,
          padding: `0 ${SPACE[6]}px`,
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: SPACE[4],
        }}
      >
        {/* Org switcher */}
        {onSelectOrganization && orgList.length > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: SPACE[2], flexShrink: 0 }}>
            {creatingOrg ? (
              <>
                <input
                  autoFocus
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && orgName.trim() && onCreateOrganization) {
                      onCreateOrganization(orgName.trim());
                      setOrgName("");
                      setCreatingOrg(false);
                    }
                    if (e.key === "Escape") {
                      setOrgName("");
                      setCreatingOrg(false);
                    }
                  }}
                  placeholder="New organization name"
                  style={{ fontSize: TEXT.sm, padding: "5px 8px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.borderDefault}` }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (orgName.trim() && onCreateOrganization) {
                      onCreateOrganization(orgName.trim());
                      setOrgName("");
                      setCreatingOrg(false);
                    }
                  }}
                  disabled={!orgName.trim()}
                  style={{ fontSize: TEXT.sm, padding: "5px 8px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.borderDefault}`, background: COLOR.pageBg, cursor: orgName.trim() ? "pointer" : "not-allowed" }}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setOrgName(""); setCreatingOrg(false); }}
                  style={{ fontSize: TEXT.sm, padding: "5px 8px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.borderDefault}`, background: COLOR.cardBg, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <select
                  value={activeOrganizationId ?? ""}
                  onChange={(e) => onSelectOrganization(e.target.value)}
                  title="Switch organization"
                  style={{ fontSize: TEXT.sm, fontWeight: 600, padding: "5px 8px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.borderDefault}`, background: COLOR.pageBg, color: COLOR.textPrimary, maxWidth: 200 }}
                >
                  {orgList.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                {onCreateOrganization ? (
                  <button
                    type="button"
                    onClick={() => setCreatingOrg(true)}
                    title="Create organization"
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: TEXT.sm, fontWeight: 600, padding: "5px 8px", borderRadius: RADIUS.sm, border: `1px solid ${COLOR.borderDefault}`, background: COLOR.cardBg, color: COLOR.textSecondary, cursor: "pointer" }}
                  >
                    <Plus size={13} strokeWidth={2.5} /> New
                  </button>
                ) : null}
              </>
            )}
            <div style={{ width: 1, height: 20, background: COLOR.borderSubtle }} />
          </div>
        ) : null}

        {/* Health badges */}
        <div style={{ display: "flex", alignItems: "center", gap: SPACE[1]+2 }}>
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
                  padding: `${SPACE[1]}px ${SPACE[2]+2}px`,
                  borderRadius: RADIUS.pill,
                  background: isUrgent ? COLOR.dangerLight : COLOR.pageBg,
                  border: `1px solid ${isUrgent ? COLOR.dangerBorder : COLOR.borderDefault}`,
                  fontSize: TEXT.sm,
                  fontWeight: 600,
                  color: isUrgent ? COLOR.danger : COLOR.textSecondary,
                  cursor: isClickable ? "pointer" : "default",
                  transition: "box-shadow 0.12s",
                  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                }}
                onMouseEnter={(e) => {
                  if (isClickable) (e.currentTarget as HTMLButtonElement).style.boxShadow = SHADOW.sm;
                }}
                onMouseLeave={(e) => {
                  if (isClickable) (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.outline = "none";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = FOCUS_RING;
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                <span style={{ fontWeight: 700, color: isUrgent ? COLOR.danger : COLOR.textPrimary }}>
                  {badge.value}
                </span>
                <span style={{ fontWeight: 500 }}>{badge.label}</span>
                {isClickable && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none" style={{ opacity: 0.5, marginLeft: 1 }}>
                    <path d="M2 4.5h5M5 2.5l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {/* Status / error */}
        <div style={{ fontSize: TEXT.sm, fontWeight: 500, flexShrink: 0 }}>
          {statusMessage && (
            <span style={{ color: COLOR.brand, display: "flex", alignItems: "center", gap: SPACE[1]+2 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: "spin 1s linear infinite" }}>
                <circle cx="6" cy="6" r="5" stroke={COLOR.brandLight} strokeWidth="2" />
                <path d="M6 1a5 5 0 0 1 5 5" stroke={COLOR.brand} strokeWidth="2" strokeLinecap="round" />
              </svg>
              {statusMessage}
            </span>
          )}
          {!statusMessage && errorMessage && (
            <span style={{ color: isDemoMode ? COLOR.warning : COLOR.danger, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {errorMessage}
            </span>
          )}
        </div>
      </header>

      {/* Main content area */}
      <main style={{ padding: SPACE[5], overflow: "auto", minHeight: 0 }}>
        {children}
      </main>
    </div>
  );
}
