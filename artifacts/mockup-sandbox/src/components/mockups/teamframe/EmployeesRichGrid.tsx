import { useState } from "react";
import { SEED, Employee } from "../../../teamframe/data/seed";

function Avatar({ initials, color, size = 48 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: "#fff", flexShrink: 0,
      border: "2px solid rgba(255,255,255,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}>{initials}</div>
  );
}

function StatusDot({ status }: { status: "active" | "on_leave" | "offboarding" }) {
  const colors: Record<string, string> = { active: "#22c55e", on_leave: "#f59e0b", offboarding: "#ef4444" };
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: colors[status] ?? "#6b7280", boxShadow: `0 0 6px ${colors[status]}`,
    }} />
  );
}

export function EmployeesRichGrid() {
  const [hovered, setHovered] = useState<string | null>(null);
  const employees = SEED.employees;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f1117", color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, sans-serif", padding: 20,
    }}>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        {employees.length} employees · Rich visual grid
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14,
      }}>
        {employees.map((emp) => {
          const pos = SEED.positions.find((p) => p.id === emp.positionId);
          const isHovered = hovered === emp.id;
          return (
            <div
              key={emp.id}
              onMouseEnter={() => setHovered(emp.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: 16, borderRadius: 14,
                background: isHovered ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${isHovered ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.06)"}`,
                transition: "all 0.2s ease", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <Avatar initials={emp.avatarInitials} color={emp.avatarColor} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 2 }}>{emp.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{pos?.title} · {pos?.department}</div>
                </div>
                <StatusDot status={emp.status} />
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px",
                fontSize: 11, color: "#64748b",
              }}>
                <div>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "#475569", marginBottom: 2 }}>Location</div>
                  <div style={{ color: "#94a3b8" }}>{emp.location}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "#475569", marginBottom: 2 }}>Start Date</div>
                  <div style={{ color: "#94a3b8" }}>{emp.startDate}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "#475569", marginBottom: 2 }}>Phone</div>
                  <div style={{ color: "#94a3b8" }}>{emp.phone}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, color: "#475569", marginBottom: 2 }}>Email</div>
                  <div style={{ color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.email}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
