import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  createLeave,
  getLeaveTypes,
  listLeave,
  updateLeave,
  type CreateLeaveInput,
} from "../api/leave";
import { listEmployees } from "../api/employees";
import type { Leave, LeaveType } from "../api/schemas";
import { formatDate, fullName, todayISO } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Field, Input, Select, statusTone } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorBanner, PageCard, QueryState } from "../components/states";

export function LeavePage() {
  const [creating, setCreating] = useState(false);
  const leave = useQuery({ queryKey: ["leave"], queryFn: () => listLeave() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const types = useQuery({ queryKey: ["leave-types"], queryFn: getLeaveTypes });

  const empName = useMemo(() => {
    const map = new Map<string, string>();
    employees.data?.data.forEach((e) => map.set(e.id, fullName(e)));
    return (id: string) => map.get(id) ?? id;
  }, [employees.data]);

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Apply for leave and manage request status."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Apply for leave
          </Button>
        }
      />
      <PageCard>
        <QueryState
          isLoading={leave.isLoading}
          isError={leave.isError}
          error={leave.error}
          data={leave.data}
          refetch={leave.refetch}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState
              title="No leave requests"
              action={<Button onClick={() => setCreating(true)}>Apply for leave</Button>}
            />
          }
        >
          {(data) => <LeaveTable rows={data.data} empName={empName} />}
        </QueryState>
      </PageCard>

      {creating && (
        <LeaveModal
          onClose={() => setCreating(false)}
          employees={employees.data?.data ?? []}
          types={types.data ?? []}
        />
      )}
    </div>
  );
}

const STATUS_OPTIONS = ["pending", "approved", "rejected", "cancelled"];

function LeaveTable({
  rows,
  empName,
}: {
  rows: Leave[];
  empName: (id: string) => string;
}) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateLeave(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave"] }),
  });

  const columns: Column<Leave>[] = [
    { key: "emp", header: "Employee", render: (l) => <span className="font-medium text-slate-900">{empName(l.employeeId)}</span> },
    { key: "type", header: "Type", render: (l) => <span className="capitalize">{l.type}</span> },
    { key: "from", header: "From", render: (l) => formatDate(l.startDate) },
    { key: "to", header: "To", render: (l) => formatDate(l.endDate) },
    { key: "days", header: "Days", render: (l) => l.days },
    {
      key: "status",
      header: "Status",
      render: (l) => (
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(l.status)}>{l.status}</Badge>
          <Select
            className="w-32 py-1 text-xs"
            value={l.status}
            onChange={(e) => update.mutate({ id: l.id, status: e.target.value })}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(l) => l.id} />;
}

function daysBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / (24 * 60 * 60 * 1000)) + 1;
}

function LeaveModal({
  onClose,
  employees,
  types,
}: {
  onClose: () => void;
  employees: { id: string; firstName: string; lastName: string }[];
  types: LeaveType[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employeeId: "",
    type: (types[0] ?? "annual") as LeaveType,
    startDate: todayISO(),
    endDate: todayISO(),
  });

  const days = daysBetween(form.startDate, form.endDate);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreateLeaveInput = {
        employeeId: form.employeeId,
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        days,
      };
      return createLeave(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leave"] });
      onClose();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Apply for leave"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="leave-form" type="submit" disabled={mutation.isPending || !form.employeeId || days <= 0}>
            {mutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        </>
      }
    >
      <form id="leave-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Employee" required>
          <Select
            value={form.employeeId}
            onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
            required
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </Select>
        </Field>
        <Field label="Leave type" required>
          <Select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as LeaveType }))}
          >
            {types.map((t) => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date" required>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              required
            />
          </Field>
          <Field label="End date" required>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              required
            />
          </Field>
        </div>
        <p className="text-sm text-slate-500">Duration: {days} day{days === 1 ? "" : "s"}</p>
      </form>
    </Modal>
  );
}
