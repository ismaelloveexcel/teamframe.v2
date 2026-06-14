import { useEffect, useState, type ReactNode } from "react";
import { COLOR, RADIUS, SHADOW, Z } from "./design-tokens";

type DarkToastProps = {
  children: ReactNode;
  visible?: boolean;
  position?: "bottom-center" | "bottom-right";
  "aria-label"?: string;
};

/**
 * Shared dark surface container for OrgReadyBanner, SetupProgressCard, and
 * any future bottom-anchored notification. Handles entry animation and
 * consistent chrome; content is fully slotted.
 */
export function DarkToast({
  children,
  visible = true,
  position = "bottom-right",
  "aria-label": ariaLabel,
}: DarkToastProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const isCenter = position === "bottom-center";

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        bottom: 28,
        ...(isCenter
          ? { left: "50%", transform: `translateX(-50%) translateY(${mounted && visible ? "0px" : "14px"})` }
          : { right: 24, transform: `translateY(${mounted && visible ? "0px" : "14px"})` }),
        opacity: mounted && visible ? 1 : 0,
        transition: "opacity 0.25s cubic-bezier(0.4,0,0.2,1), transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        zIndex: Z.toast,
        background: COLOR.darkSurface,
        border: `1px solid ${COLOR.navActive}`,
        borderRadius: RADIUS.lg,
        boxShadow: SHADOW.lg,
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        ...(isCenter
          ? { maxWidth: 480, width: "calc(100vw - 48px)" }
          : { width: 300 }),
      }}
    >
      {children}
    </div>
  );
}
