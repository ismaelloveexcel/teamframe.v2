import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, UserPlus } from "lucide-react";
import {
  assignPosition,
  getEmployee,
  inviteEmployee,
  listAssignments,
} from "../api/employees";
import { listPositions } from "../api/positions";
import { listCompensation } from "../api/compensation";
import { listLeave } from "../api/leave";
import { listDocuments } from "../api/documents";
import { listOffboarding } from "../api/offboarding";
import type { Employee, Position } from "../api/schemas";
import { cn, formatDate, formatMinorUnits, fullName, todayISO } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Card, CardHeader, Field, Select, statusTone } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import {
  EmptyState,
  ErrorBanner,
  ErrorState,
  QueryState,
  Skeleton,
  TableSkeleton,
} from "../components/states";

const TABS = [
  "Profile",
  "Position history",
  "Compensation",
  "Leave",
  "Documents",
  "Offboarding",
] as const;
type Tab = (typeof TABS)[number];

export function EmployeeDetailPage() {
  const { id = "" } = useParams();
  const [tab, setTab] = useState<Tab>("Profile");
  const employee = useQuery({
    queryKey: ["employee", id],
    queryFn: () => getEmployee(id),
  });

  return (
    <div>
      <Link
        to="/employees"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Back to employees
      </Link>

      {employee.isLoading ? (
        <Skeleton className="h-8 w-64" />
      ) : employee.isError || !employee.data ? (
        <ErrorState error={employee.error} onRetry={employee.refetch} />
      ) : (
        <>
          <PageHeader
            title={fullName(employee.data)}
            description={`Employee #${employee.data.employeeNo}`}
            actions={
              <div className="flex items-center gap-2">
                <Badge tone={statusTone(employee.data.status)}>
                  {employee.data.status}
                </Badge>
                <InviteButton employeeId={id} linked={!!employee.data.userId} />
              </div>
            }
          />

          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-700",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Profile" && <ProfileTab employee={employee.data} />}
          {tab === "Position history" && <PositionTab employeeId={id} />}
          {tab === "Compensation" && <CompensationTab employeeId={id} />}
          {tab === "Leave" && <LeaveTab employeeId={id} />}
          {tab === "Documents" && <DocumentsTab employeeId={id} />}
          {tab === "Offboarding" && <OffboardingTab employeeId={id} />}
        </>
      )}
    </div>
  );
}

function InviteButton({ employeeId, linked }: { employeeId: string; linked: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => inviteEmployee(employeeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employee", employeeId] }),
  });
  if (linked) return <Badge tone="green">Account linked</Badge>;
  return (
    <Button variant="secondary" size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
      <UserPlus className="h-4 w-4" />
      {mutation.isPending ? "Inviting…" : "Invite"}
    </Button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-3 last:border-0 sm:flex-row sm:justify-between">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900 sm:text-right">{value || "—"}</dd>
    </div>
  );
}

function ProfileTab({ employee }: { employee: Employee }) {
  return (
    <Card className="p-5">
      <dl>
        <Row label="Full name" value={fullName(employee)} />
        <Row label="Employee number" value={employee.employeeNo} />
        <Row label="Company email" value={employee.companyEmail} />
        <Row label="Personal email" value={employee.personalEmail} />
        <Row label="Mobile" value={employee.mobileNumber} />
        <Row label="Nationality" value={employee.nationality} />
        <Row label="Date of birth" value={formatDate(employee.dateOfBirth)} />
        <Row label="Join date" value={formatDate(employee.joinDate)} />
        <Row label="Date of exit" value={formatDate(employee.dateOfExit)} />
        <Row label="Address" value={employee.address} />
      </dl>
    </Card>
  );
}

function PositionTab({ employeeId }: { employeeId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const assignments = useQuery({
    queryKey: ["assignments", employeeId],
    queryFn: () => listAssignments(employeeId),
  });
  const positions = useQuery({ queryKey: ["positions"], queryFn: () => listPositions() });

  const posTitle = (positionId: string) =>
    positions.data?.data.find((p) => p.id === positionId)?.title ?? positionId;

  const columns: Column<{ id: string; positionId: string; startDate: string; endDate: string | null }>[] = [
    { key: "position", header: "Position", render: (a) => posTitle(a.positionId) },
    { key: "start", header: "Start", render: (a) => formatDate(a.startDate) },
    { key: "end", header: "End", render: (a) => formatDate(a.endDate) },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Position history"
        action={<Button size="sm" onClick={() => setOpen(true)}>Assign position</Button>}
      />
      <QueryState
        isLoading={assignments.isLoading}
        isError={assignments.isError}
        error={assignments.error}
        data={assignments.data}
        refetch={assignments.refetch}
        loading={<TableSkeleton cols={3} />}
        isEmpty={(d) => d.data.length === 0}
        empty={<EmptyState title="No assignments yet" description="Assign this employee to a position." />}
      >
        {(data) => <DataTable columns={columns} rows={data.data} rowKey={(a) => a.id} />}
      </QueryState>

      <AssignModal
        open={open}
        onClose={() => setOpen(false)}
        employeeId={employeeId}
        positions={positions.data?.data ?? []}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ["assignments", employeeId] });
          queryClient.invalidateQueries({ queryKey: ["orgchart"] });
        }}
      />
    </Card>
  );
}

function AssignModal({
  open,
  onClose,
  employeeId,
  positions,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  employeeId: string;
  positions: Position[];
  onAssigned: () => void;
}) {
  const [positionId, setPositionId] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const mutation = useMutation({
    mutationFn: () => assignPosition(employeeId, positionId, startDate),
    onSuccess: () => {
      onAssigned();
      onClose();
    },
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign position"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="assign" type="submit" disabled={mutation.isPending || !positionId}>
            {mutation.isPending ? "Assigning…" : "Assign"}
          </Button>
        </>
      }
    >
      <form id="assign" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Position" required>
          <Select value={positionId} onChange={(e) => setPositionId(e.target.value)} required>
            <option value="">Select a position…</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.department ? ` · ${p.department}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Start date" required>
          <input
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}

function CompensationTab({ employeeId }: { employeeId: string }) {
  const comp = useQuery({
    queryKey: ["compensation", employeeId],
    queryFn: () => listCompensation(employeeId),
  });
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Compensation" description="Salary fields are visible to admins only." />
      <QueryState
        isLoading={comp.isLoading}
        isError={comp.isError}
        error={comp.error}
        data={comp.data}
        refetch={comp.refetch}
        loading={<TableSkeleton cols={3} />}
        isEmpty={(d) => d.data.length === 0}
        empty={<EmptyState title="No compensation records" />}
      >
        {(data) => (
          <div className="divide-y divide-slate-100">
            {data.data.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-slate-900">
                    {c.amount != null ? formatMinorUnits(c.amount, c.currency) : "Salary hidden"}
                  </p>
                  <p className="text-slate-500">Effective {formatDate(c.effectiveDate)}</p>
                </div>
                <span className="text-slate-500">{c.bankName ?? "—"}</span>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </Card>
  );
}

function LeaveTab({ employeeId }: { employeeId: string }) {
  const leave = useQuery({
    queryKey: ["leave", employeeId],
    queryFn: () => listLeave(employeeId),
  });
  const columns: Column<{ id: string; type: string; startDate: string; endDate: string; days: number; status: string }>[] = [
    { key: "type", header: "Type", render: (l) => <span className="capitalize">{l.type}</span> },
    { key: "from", header: "From", render: (l) => formatDate(l.startDate) },
    { key: "to", header: "To", render: (l) => formatDate(l.endDate) },
    { key: "days", header: "Days", render: (l) => l.days },
    { key: "status", header: "Status", render: (l) => <Badge tone={statusTone(l.status)}>{l.status}</Badge> },
  ];
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Leave" />
      <QueryState
        isLoading={leave.isLoading}
        isError={leave.isError}
        error={leave.error}
        data={leave.data}
        refetch={leave.refetch}
        loading={<TableSkeleton cols={5} />}
        isEmpty={(d) => d.data.length === 0}
        empty={<EmptyState title="No leave records" />}
      >
        {(data) => <DataTable columns={columns} rows={data.data} rowKey={(l) => l.id} />}
      </QueryState>
    </Card>
  );
}

function DocumentsTab({ employeeId }: { employeeId: string }) {
  const docs = useQuery({
    queryKey: ["documents", employeeId],
    queryFn: () => listDocuments(employeeId),
  });
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Documents" />
      <QueryState
        isLoading={docs.isLoading}
        isError={docs.isError}
        error={docs.error}
        data={docs.data}
        refetch={docs.refetch}
        loading={<TableSkeleton cols={2} />}
        isEmpty={(d) => d.data.length === 0}
        empty={<EmptyState title="No documents" description="Generate documents from the Documents page." />}
      >
        {(data) => (
          <div className="divide-y divide-slate-100">
            {data.data.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium text-slate-900">{d.name}</span>
                <span className="text-slate-500">{formatDate(d.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </Card>
  );
}

function OffboardingTab({ employeeId }: { employeeId: string }) {
  const off = useQuery({ queryKey: ["offboarding"], queryFn: () => listOffboarding() });
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Offboarding" description="End-of-service records are read-only." />
      <QueryState
        isLoading={off.isLoading}
        isError={off.isError}
        error={off.error}
        data={off.data}
        refetch={off.refetch}
        loading={<TableSkeleton cols={3} />}
        isEmpty={(d) => d.data.filter((o) => o.employeeId === employeeId).length === 0}
        empty={<EmptyState title="No offboarding record" description="Create one from the Offboarding page." />}
      >
        {(data) => {
          const rows = data.data.filter((o) => o.employeeId === employeeId);
          return (
            <div className="divide-y divide-slate-100">
              {rows.map((o) => (
                <div key={o.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">Exit {formatDate(o.exitDate)}</p>
                    <p className="text-slate-500">{o.reason ?? "No reason recorded"}</p>
                  </div>
                  <span className="font-medium text-slate-900">
                    {formatMinorUnits(o.gratuityAmount)}
                  </span>
                </div>
              ))}
            </div>
          );
        }}
      </QueryState>
    </Card>
  );
}
