import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Briefcase,
  FileText,
  FileBarChart,
  Home,
  LogOut,
  Menu,
  ScrollText,
  Users,
  Wallet,
  CalendarDays,
  UserMinus,
  Network,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { cn } from "../lib/utils";
import { Badge } from "./ui";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: Home },
  { to: "/employees", label: "Employees", icon: Users, adminOnly: true },
  { to: "/positions", label: "Positions", icon: Briefcase, adminOnly: true },
  { to: "/org", label: "Org Chart", icon: Network },
  { to: "/compensation", label: "Compensation", icon: Wallet },
  { to: "/leave", label: "Leave", icon: CalendarDays, adminOnly: true },
  { to: "/policies", label: "Policies", icon: ScrollText },
  { to: "/documents", label: "Documents", icon: FileText, adminOnly: true },
  { to: "/offboarding", label: "Offboarding", icon: UserMinus, adminOnly: true },
  { to: "/reports/finance", label: "Finance Report", icon: FileBarChart, adminOnly: true },
  { to: "/reports/exit", label: "Exit Report", icon: FileBarChart, adminOnly: true },
];

function TfLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
        <span className="text-xs font-bold text-slate-900 tracking-tight">TF</span>
      </div>
      <span className="font-semibold text-tf-text tracking-tight">TeamFrame</span>
    </div>
  );
}

export function AppShell() {
  const { actor, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((i) => !i.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebar = (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-tf-border bg-white transition-transform lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-tf-border px-4">
        <TfLogo />
        <button
          className="rounded-md p-1 text-tf-muted hover:bg-tf-panel lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent-soft text-tf-text"
                  : "text-tf-muted hover:bg-tf-panel hover:text-tf-text",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-accent-dark" : "")} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-tf-border p-3">
        <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-tf-text">{actor?.email}</p>
            <Badge tone={isAdmin ? "accent" : "neutral"} >
              {actor?.role ?? "—"}
            </Badge>
          </div>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-md p-1.5 text-tf-muted hover:bg-tf-panel hover:text-tf-text"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-tf-bg">
      {sidebar}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-tf-border bg-white/95 px-4 backdrop-blur-sm lg:px-6">
          <button
            className="rounded-md p-2 text-tf-muted hover:bg-tf-panel lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
        </header>

        <main className="min-w-0 flex-1 p-5 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
