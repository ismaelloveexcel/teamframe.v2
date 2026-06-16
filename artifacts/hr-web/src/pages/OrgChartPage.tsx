import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { getOrgChart } from "../api/orgchart";
import type { OrgChartNode } from "../api/schemas";
import { useAuth } from "../auth/AuthProvider";
import { PageHeader } from "../components/PageHeader";
import { Badge, Card } from "../components/ui";
import { EmptyState, QueryState } from "../components/states";

export function OrgChartPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ["orgchart"], queryFn: getOrgChart });

  return (
    <div>
      <PageHeader
        title="Org chart"
        description="The employee-populated reporting structure. Click a person to open their profile."
      />
      <Card className="p-5">
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data}
          refetch={query.refetch}
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState
              title="No org structure yet"
              description="Create positions and assign employees to populate the chart."
            />
          }
        >
          {(nodes) => (
            <div className="space-y-1">
              {nodes.map((n) => (
                <OrgNode
                  key={n.position.id}
                  node={n}
                  depth={0}
                  clickable={isAdmin}
                  onSelect={(id) => navigate(`/employees/${id}`)}
                />
              ))}
            </div>
          )}
        </QueryState>
      </Card>
    </div>
  );
}

function OrgNode({
  node,
  depth,
  clickable,
  onSelect,
}: {
  node: OrgChartNode;
  depth: number;
  clickable: boolean;
  onSelect: (employeeId: string) => void;
}) {
  const emp = node.employee;
  const canClick = clickable && !!emp;
  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 ${
          canClick ? "cursor-pointer hover:border-slate-400 hover:bg-slate-50" : ""
        }`}
        style={{ marginLeft: depth * 24 }}
        onClick={canClick ? () => onSelect(emp!.id) : undefined}
        role={canClick ? "button" : undefined}
        tabIndex={canClick ? 0 : undefined}
        onKeyDown={
          canClick
            ? (e) => {
                if (e.key === "Enter") onSelect(emp!.id);
              }
            : undefined
        }
      >
        {depth > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">
            {node.position.title}
            {node.position.department && (
              <span className="ml-2 text-xs font-normal text-slate-400">
                {node.position.department}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">
            {emp ? `${emp.firstName} ${emp.lastName} · #${emp.employeeNo}` : "Vacant"}
          </p>
        </div>
        {emp ? (
          <Badge tone="green">{emp.status}</Badge>
        ) : (
          <Badge tone="amber">vacant</Badge>
        )}
      </div>
      {node.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((c) => (
            <OrgNode
              key={c.position.id}
              node={c}
              depth={depth + 1}
              clickable={clickable}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
