import type { ButtonHTMLAttributes, ReactNode } from "react";
import { COLOR, RADIUS, TEXT, SHADOW, GRADIENT, FOCUS_RING } from "./design-tokens";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, {
  background: string;
  color: string;
  border: string;
  hoverBackground: string;
  hoverBoxShadow: string;
  disabledBackground: string;
  disabledColor: string;
}> = {
  primary: {
    background: GRADIENT.brand,
    color: "#FFFFFF",
    border: "none",
    hoverBackground: GRADIENT.brand,
    hoverBoxShadow: SHADOW.md,
    disabledBackground: COLOR.borderDefault,
    disabledColor: COLOR.textMuted,
  },
  secondary: {
    background: COLOR.cardBg,
    color: COLOR.textPrimary,
    border: `1px solid ${COLOR.borderDefault}`,
    hoverBackground: COLOR.rowBg,
    hoverBoxShadow: SHADOW.sm,
    disabledBackground: COLOR.rowBg,
    disabledColor: COLOR.textMuted,
  },
  destructive: {
    background: COLOR.dangerLight,
    color: COLOR.danger,
    border: `1px solid ${COLOR.dangerBorder}`,
    hoverBackground: "#FEE2E2",
    hoverBoxShadow: SHADOW.sm,
    disabledBackground: COLOR.rowBg,
    disabledColor: COLOR.textMuted,
  },
  ghost: {
    background: "transparent",
    color: COLOR.textSecondary,
    border: "none",
    hoverBackground: COLOR.borderSubtle,
    hoverBoxShadow: "none",
    disabledBackground: "transparent",
    disabledColor: COLOR.textMuted,
  },
};

const SIZE_STYLES: Record<ButtonSize, {
  padding: string;
  fontSize: number;
  gap: number;
}> = {
  sm: { padding: `${6}px ${12}px`, fontSize: TEXT.sm, gap: 6 },
  md: { padding: `${8}px ${16}px`, fontSize: TEXT.sm, gap: 8 },
  lg: { padding: `${10}px ${20}px`, fontSize: TEXT.base, gap: 8 },
};

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
  fullWidth?: boolean;
};

export function PrimaryButton({
  variant = "primary",
  size = "md",
  children,
  fullWidth = false,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: PrimaryButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        fontWeight: 700,
        border: disabled ? `1px solid ${COLOR.borderDefault}` : v.border === "none" ? "none" : v.border,
        borderRadius: RADIUS.sm,
        background: disabled ? v.disabledBackground : v.background,
        color: disabled ? v.disabledColor : v.color,
        cursor: disabled ? "not-allowed" : "pointer",
        boxShadow: "none",
        transition: "box-shadow 0.12s, background 0.12s",
        width: fullWidth ? "100%" : undefined,
        letterSpacing: "0.01em",
        lineHeight: 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = v.hoverBoxShadow;
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
        }
        onMouseLeave?.(e);
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLButtonElement).style.outline = "none";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = FOCUS_RING;
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
