import { useState } from "react";
import { SEED, Employee } from "../../../teamframe/data/seed";

function Avatar({ initials, color, size = 32 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 600, color: "#fff", flexShrink: 0,
      border: "1.5px solid rgba(255,255,255,0.12)",
    }}>{initials}</div>
  );
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active: { label: "Active", color: "#22c55e", bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.15)" },
  on_leave: { label: "On Leave", color: "#f59e0b", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.15)" },
  offboarding: { label: "Offboarding", color: "#ef4444", bg: "rgba(239,68,68,0.06)", border: "rgba(239,68,68,0.15)" },
};

export function EmployeesStatusGrouped() {
  const [open, setOpen] = useState<Record<string, boolean>>({ active: true, on_leave: true, offboarding: true });
  const grouped: Record<string, Employee[]> = {
    active: SEED.employees.filter((e) => e.status === "active"),
    on_leave: SEED.employees.filter((e) => e.status === "on_leave"),
    offboarding: SEED.employees.filter((e) => e.status === "offboarding"),
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0f1117", color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, sans-serif", padding: 20,
    }}>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        {SEED.employees.length} employees · Grouped by status
      </div>
      {Object.entries(grouped).map(([status, group]) => {
        const meta = STATUS_META[status] ?? STATUS_META.active;
        const isOpen = open[status] ?? true;
        return (
          <div key={status} style={{
            marginBottom: 14, borderRadius: 12,
            border: `1px solid ${meta.border}`, overflow: "hidden",
          }}>
            <button
              onClick={() => setOpen((prev) => ({ ...prev, [status]: !prev[status] }))}
              style={{
                width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: meta.bg, border: "none", cursor: "pointer", color: "#e2e8f0",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: meta.color, display: "inline-block" }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>{meta.label}</span>
                <span style={{
                  padding: "2px 8px", borderRadius: 10, background: "rgba(255,255,255,0.06)",
                  color: "#64748b", fontSize: 10, fontWeight: 700,
                }}>{group.length}</span>
              </div>
              <span style={{ fontSize: 14, color: "#64748b", transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▲</span>
            </button>
            {isOpen && (
              <div style={{ padding: "8px 16px 12px" }}>
                {group.map((emp, i) => {
                  const pos = SEED.positions.find((p) => p.id === emp.positionId);
                  return (
                    <div key={emp.id} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "8px 0", borderBottom: i < group.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}>
                      <Avatar initials={emp.avatarInitials} color={emp.avatarColor} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: "#e2e8f0" }}>{emp.name}</div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>{pos?.title} · {pos?.department}</div>
                      </div>
                      <div style={{ textAlign: "right", fontSize: 10, color: "#64748b" }}>
                        <div>{emp.location}</div>
                        <div>{emp.startDate}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
