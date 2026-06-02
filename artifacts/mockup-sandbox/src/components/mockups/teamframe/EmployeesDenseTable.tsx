import { SEED, Employee } from "../../../teamframe/data/seed";

function Avatar({ initials, color, size = 24 }: { initials: string; color: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 600, color: "#fff", flexShrink: 0,
      border: "1.5px solid rgba(255,255,255,0.1)",
    }}>{initials}</div>
  );
}

function StatusPill({ status }: { status: "active" | "on_leave" | "offboarding" }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "Active" },
    on_leave: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", label: "On Leave" },
    offboarding: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "Offboarding" },
  };
  const c = cfg[status] ?? cfg.active;
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 10, background: c.bg, color: c.color,
      fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

export function EmployeesDenseTable() {
  const employees = SEED.employees;

  return (
    <div style={{
      minHeight: "100vh", background: "#0f1117", color: "#e2e8f0",
      fontFamily: "'Inter', system-ui, sans-serif", padding: 20,
    }}>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16 }}>
        {employees.length} employees · Dense data-grid view
      </div>
      <div style={{
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10, overflow: "hidden",
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "44px 1fr 160px 160px 160px 140px 120px 100px",
          padding: "10px 16px", background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          <span />
          <span>Name</span>
          <span>Position</span>
          <span>Department</span>
          <span>Location</span>
          <span>Start Date</span>
          <span>Email</span>
          <span>Status</span>
        </div>
        {employees.map((emp, i) => {
          const pos = SEED.positions.find((p) => p.id === emp.positionId);
          return (
            <div key={emp.id} style={{
              display: "grid", gridTemplateColumns: "44px 1fr 160px 160px 160px 140px 120px 100px",
              padding: "8px 16px", alignItems: "center",
              borderBottom: i < employees.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              fontSize: 12,
            }}>
              <Avatar initials={emp.avatarInitials} color={emp.avatarColor} size={28} />
              <div>
                <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{emp.name}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{emp.id}</div>
              </div>
              <span style={{ color: "#94a3b8" }}>{pos?.title ?? "-"}</span>
              <span style={{ color: "#94a3b8" }}>{pos?.department ?? "-"}</span>
              <span style={{ color: "#94a3b8" }}>{emp.location}</span>
              <span style={{ color: "#94a3b8" }}>{emp.startDate}</span>
              <span style={{ color: "#94a3b8", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis" }}>{emp.email}</span>
              <StatusPill status={emp.status} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
