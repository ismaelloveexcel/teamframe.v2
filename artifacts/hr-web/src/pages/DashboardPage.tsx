import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, Briefcase, ScrollText, CalendarDays } from "lucide-react";
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
}: {
  label: string;
  value: number | string;
  to: string;
  icon: typeof Users;
  loading: boolean;
}) {
  return (
    <Link to={to}>
      <Card className="flex items-center gap-4 p-5 transition-shadow hover:shadow-md">
        <div className="rounded-md bg-slate-100 p-3 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          {loading ? (
            <Skeleton className="mt-1 h-6 w-12" />
          ) : (
            <p className="text-2xl font-semibold text-slate-900">{value}</p>
          )}
        </div>
      </Card>
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

  return (
    <div>
      <PageHeader
        title={`Welcome${actor?.email ? `, ${actor.email}` : ""}`}
        description="Your HR workspace at a glance."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
          <>
            <StatCard
              label="Employees"
              to="/employees"
              icon={Users}
              loading={employees.isLoading}
              value={employees.data?.total ?? employees.data?.data.length ?? 0}
            />
            <StatCard
              label="Positions"
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
          </>
        )}
        <StatCard
          label="Policies"
          to="/policies"
          icon={ScrollText}
          loading={policies.isLoading}
          value={policies.data?.total ?? policies.data?.data.length ?? 0}
        />
      </div>

      {!isAdmin && (
        <Card className="mt-6 p-5">
          <p className="text-sm text-slate-600">
            You are signed in as an employee. You can view the org chart, your
            compensation, and acknowledge company policies from the sidebar.
          </p>
        </Card>
      )}
    </div>
  );
}
