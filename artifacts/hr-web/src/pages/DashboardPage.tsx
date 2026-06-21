import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Briefcase,
  ScrollText,
  CalendarDays,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { listEmployees } from "../api/employees";
import { listPositions } from "../api/positions";
import { listPolicies } from "../api/policies";
import { listLeave } from "../api/leave";
import { PageHeader } from "../components/PageHeader";
import { Card } from "../components/ui";
import { Skeleton } from "../components/states";

function StatCard({
  label,
  value,
  to,
  icon: Icon,
  loading,
  accent,
}: {
  label: string;
  value: number | string;
  to: string;
  icon: typeof Users;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <Link to={to} className="group block">
      <Card className="flex items-start gap-4 p-5 transition-all hover:border-accent/30 hover:shadow-md hover:shadow-accent/5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            accent
              ? "bg-accent text-white shadow-sm shadow-accent/30"
              : "bg-tf-panel text-tf-muted"
          }`}
        >
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-tf-subtle">
            {label}
          </p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-14" />
          ) : (
            <p className="mt-1 text-2xl font-semibold tracking-tight text-tf-text">
              {value}
            </p>
          )}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-tf-subtle opacity-0 transition-opacity group-hover:opacity-100" />
      </Card>
    </Link>
  );
}

function QuickLink({
  to,
  label,
  description,
}: {
  to: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-xl border border-tf-border bg-white px-4 py-3 text-sm transition-all hover:border-accent/30 hover:bg-accent-soft/30"
    >
      <div>
        <p className="font-medium text-tf-text">{label}</p>
        <p className="text-xs text-tf-muted">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-tf-subtle transition-colors group-hover:text-accent" />
    </Link>
  );
}

export function DashboardPage() {
  const { actor, isAdmin } = useAuth();

  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
    enabled: isAdmin,
  });
  const positions = useQuery({
    queryKey: ["positions"],
    queryFn: () => listPositions(),
    enabled: isAdmin,
  });
  const policies = useQuery({ queryKey: ["policies"], queryFn: listPolicies });
  const leave = useQuery({
    queryKey: ["leave"],
    queryFn: () => listLeave(),
    enabled: isAdmin,
  });

  const firstName = actor?.email?.split("@")[0] ?? "there";

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Good morning, ${firstName}`}
        description="Here's what's happening across your workspace today."
      />

      {/* Stat cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total employees"
            to="/employees"
            icon={Users}
            loading={employees.isLoading}
            value={employees.data?.total ?? employees.data?.data.length ?? 0}
            accent
          />
          <StatCard
            label="Open positions"
            to="/positions"
            icon={Briefcase}
            loading={positions.isLoading}
            value={positions.data?.total ?? positions.data?.data.length ?? 0}
          />
          <StatCard
            label="Leave requests"
            to="/leave"
            icon={CalendarDays}
            loading={leave.isLoading}
            value={leave.data?.total ?? leave.data?.data.length ?? 0}
          />
          <StatCard
            label="Active policies"
            to="/policies"
            icon={ScrollText}
            loading={policies.isLoading}
            value={policies.data?.total ?? policies.data?.data.length ?? 0}
          />
        </div>
      )}

      {!isAdmin && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Active policies"
            to="/policies"
            icon={ScrollText}
            loading={policies.isLoading}
            value={policies.data?.total ?? policies.data?.data.length ?? 0}
            accent
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {isAdmin && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-tf-muted uppercase tracking-wide">
              Quick actions
            </h2>
            <div className="space-y-2">
              <QuickLink
                to="/employees"
                label="Manage employees"
                description="View profiles, contracts, and history"
              />
              <QuickLink
                to="/leave"
                label="Review leave requests"
                description="Approve or reject pending requests"
              />
              <QuickLink
                to="/documents"
                label="Generate documents"
                description="Contracts, offer letters, and HR templates"
              />
              <QuickLink
                to="/reports/finance"
                label="Finance report"
                description="Payroll and compensation overview"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-tf-muted uppercase tracking-wide">
            Platform status
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-tf-border bg-white px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tf-success-soft">
                <ShieldCheck className="h-4 w-4 text-tf-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-tf-text">RLS security active</p>
                <p className="text-xs text-tf-muted">Row-level isolation enforced per tenant</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-tf-border bg-white px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft">
                <TrendingUp className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-tf-text">Workspace ready</p>
                <p className="text-xs text-tf-muted">All modules operational</p>
              </div>
            </div>
            {!isAdmin && (
              <QuickLink
                to="/org"
                label="View org chart"
                description="See your team structure"
              />
            )}
            <QuickLink
              to="/policies"
              label="Company policies"
              description="Review and acknowledge active policies"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
