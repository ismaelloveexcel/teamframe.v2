import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
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
  { to: "/org", label: "Org chart", icon: Network },
  { to: "/compensation", label: "Compensation", icon: Wallet },
  { to: "/leave", label: "Leave", icon: CalendarDays, adminOnly: true },
  { to: "/policies", label: "Policies", icon: ScrollText },
  { to: "/documents", label: "Documents", icon: FileText, adminOnly: true },
  { to: "/offboarding", label: "Offboarding", icon: UserMinus, adminOnly: true },
  { to: "/reports/finance", label: "Finance report", icon: FileBarChart, adminOnly: true },
  { to: "/reports/exit", label: "Exit report", icon: FileBarChart, adminOnly: true },
];

export function AppShell() {
  const { actor, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((i) => !i.adminOnly || isAdmin);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 transform border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-5">
          <Building2 className="h-5 w-5 text-slate-900" />
          <span className="font-semibold text-slate-900">TeamFrame HR</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{actor?.email}</p>
              <div className="flex justify-end">
                <Badge tone={isAdmin ? "blue" : "neutral"}>
                  {actor?.role ?? "—"}
                </Badge>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
