/**
 * TeamFrame design tokens — single source of truth.
 *
 * Constraints (enforced by Phase 5.4 compliance check):
 *   typography: 5 sizes
 *   radius: 4 values
 *   shadow: 3 values
 *
 * Do not inline values anywhere in teamframe/*.tsx.
 * All new visual values must come from this file.
 */

// ─── Typography (5 sizes) ─────────────────────────────────────────────────────
// micro  →  badge labels, status chips, step indicators
// sm     →  secondary text, meta, nav labels, CTAs
// base   →  primary body, row content, panel text
// md     →  panel headings, section titles
// lg     →  display metric values, page headlines

export const TEXT = {
  micro:  11 as const,
  sm:     13 as const,
  base:   14 as const,
  md:     16 as const,
  lg:     22 as const,
} satisfies Record<string, number>;

// ─── Radius (4 values) ────────────────────────────────────────────────────────
// sm   →  buttons, badges, dismiss controls
// md   →  cards, inputs, list rows
// lg   →  panels, side panels, modals
// pill →  progress bars, status pills, health chips

export const RADIUS = {
  sm:   8  as const,
  md:   10 as const,
  lg:   14 as const,
  pill: 999 as const,
} satisfies Record<string, number>;

// ─── Shadows (3 values) ───────────────────────────────────────────────────────
// sm  →  subtle card lift
// md  →  button focus / hover interaction
// lg  →  overlay panel, toast

export const SHADOW = {
  sm: "0 1px 4px rgba(15,23,42,0.07)",
  md: "0 2px 8px rgba(15,23,42,0.10)",
  lg: "0 20px 48px rgba(2,6,23,0.45), 0 0 0 1px rgba(255,255,255,0.04)",
} satisfies Record<string, string>;

// ─── Colors ───────────────────────────────────────────────────────────────────
// Semantic names. Do not reference raw hex values in components.

export const COLOR = {
  // Surfaces
  pageBg:      "#F1F5F9",
  cardBg:      "#FFFFFF",
  sidebarBg:   "#0B1220",
  darkSurface: "#0F172A",
  rowBg:       "#FAFAFA",

  // Text
  textPrimary:   "#0F172A",
  textSecondary: "#64748B",
  textMuted:     "#94A3B8",
  textInverse:   "#F8FAFC",

  // Borders
  borderDefault: "#E2E8F0",
  borderSubtle:  "#E5E7EB",

  // Brand
  brand:      "#2563EB",
  brandDark:  "#1D4ED8",
  brandLight: "#BFDBFE",

  // Semantic status
  success:      "#059669",
  successLight: "#D1FAE5",
  successText:  "#065F46",
  warning:      "#B45309",
  warningLight: "#FFFBEB",
  warningBorder:"#FDE68A",
  danger:       "#DC2626",
  dangerLight:  "#FEF2F2",
  dangerBorder: "#FECACA",
  accent:       "#3B82F6",

  // Nav active state
  navActive:    "#1E293B",
  navActiveLine:"#3B82F6",
  navHover:     "#111827",

  // Transparent overlays
  overlayDark: "rgba(15,23,42,0.35)",
  glowBrand:   "rgba(37,99,235,0.25)",
  glowSuccess: "rgba(5,150,105,0.25)",
} satisfies Record<string, string>;

// ─── Gradients ────────────────────────────────────────────────────────────────

export const GRADIENT = {
  brand:   `linear-gradient(135deg, ${COLOR.brand} 0%, ${COLOR.brandDark} 100%)`,
  success: `linear-gradient(135deg, ${COLOR.success} 0%, #047857 100%)`,
  logo:    `linear-gradient(135deg, ${COLOR.brand} 0%, ${COLOR.brandDark} 100%)`,
} satisfies Record<string, string>;

// ─── Spacing ──────────────────────────────────────────────────────────────────
// Used as raw pixel numbers; compose as needed (e.g. `${SPACE[2]}px ${SPACE[4]}px`)

export const SPACE = {
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  8:  32,
  12: 48,
} satisfies Record<number, number>;

// ─── Focus ────────────────────────────────────────────────────────────────────
// Reuse in every interactive element's :focus-visible or inline focus handler

export const FOCUS_RING = `0 0 0 2px ${COLOR.cardBg}, 0 0 0 4px ${COLOR.brand}`;

// ─── Z-Index ──────────────────────────────────────────────────────────────────

export const Z = {
  base:     0,
  overlay:  50,
  panel:    51,
  toast:    90,
  banner:   100,
} satisfies Record<string, number>;
