import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  createOffboarding,
  listOffboarding,
  previewOffboarding,
  type EosgInputs,
} from "../api/offboarding";
import { listEmployees } from "../api/employees";
import type { EosgResult, Offboarding } from "../api/schemas";
import { formatDate, formatMinorUnits, fullName, todayISO } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Field, Input, Select } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorBanner, PageCard, QueryState } from "../components/states";

export function OffboardingPage() {
  const [creating, setCreating] = useState(false);
  const off = useQuery({ queryKey: ["offboarding"], queryFn: () => listOffboarding() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  const empName = useMemo(() => {
    const map = new Map<string, string>();
    employees.data?.data.forEach((e) => map.set(e.id, fullName(e)));
    return (id: string) => map.get(id) ?? id;
  }, [employees.data]);

  const columns: Column<Offboarding>[] = [
    { key: "emp", header: "Employee", render: (o) => <span className="font-medium text-slate-900">{empName(o.employeeId)}</span> },
    { key: "exit", header: "Exit date", render: (o) => formatDate(o.exitDate) },
    { key: "reason", header: "Reason", render: (o) => o.reason ?? "—" },
    { key: "gratuity", header: "Gratuity (EOSG)", render: (o) => formatMinorUnits(o.gratuityAmount) },
  ];

  return (
    <div>
      <PageHeader
        title="Offboarding"
        description="End-of-service gratuity is computed by the backend and frozen on the record."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New offboarding
          </Button>
        }
      />
      <PageCard>
        <QueryState
          isLoading={off.isLoading}
          isError={off.isError}
          error={off.error}
          data={off.data}
          refetch={off.refetch}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState
              title="No offboarding records"
              action={<Button onClick={() => setCreating(true)}>New offboarding</Button>}
            />
          }
        >
          {(data) => <DataTable columns={columns} rows={data.data} rowKey={(o) => o.id} />}
        </QueryState>
      </PageCard>

      {creating && (
        <OffboardingModal onClose={() => setCreating(false)} employees={employees.data?.data ?? []} />
      )}
    </div>
  );
}

function EosgSummary({ eosg }: { eosg: EosgResult }) {
  const rows: [string, string][] = [
    ["Years of service", eosg.yearsOfService.toFixed(2)],
    ["Daily wage", formatMinorUnits(Math.round(eosg.dailyWage))],
    ["Gratuity amount", formatMinorUnits(eosg.gratuityAmount)],
  ];
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Computed EOSG (read-only)</p>
        {eosg.capApplied && <Badge tone="amber">cap applied</Badge>}
      </div>
      <dl className="space-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-slate-900">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OffboardingModal({
  onClose,
  employees,
}: {
  onClose: () => void;
  employees: { id: string; firstName: string; lastName: string }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    employeeId: "",
    exitDate: todayISO(),
    reason: "",
    basicMonthlyMajor: "",
    joinDate: "",
  });

  const eosgInputs = (): EosgInputs => ({
    basicMonthlyPay: form.basicMonthlyMajor
      ? Math.round(parseFloat(form.basicMonthlyMajor) * 100)
      : 0,
    joinDate: form.joinDate,
    exitDate: form.exitDate,
  });

  const preview = useMutation({
    mutationFn: () => previewOffboarding(eosgInputs()),
  });

  const create = useMutation({
    mutationFn: () =>
      createOffboarding({
        employeeId: form.employeeId,
        exitDate: form.exitDate,
        reason: form.reason || null,
        eosg: eosgInputs(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offboarding"] });
      onClose();
    },
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const canPreview = !!form.joinDate && !!form.exitDate && !!form.basicMonthlyMajor;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="New offboarding"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            form="off-form"
            type="submit"
            disabled={create.isPending || !form.employeeId || !canPreview}
          >
            {create.isPending ? "Saving…" : "Create record"}
          </Button>
        </>
      }
    >
      <form id="off-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={create.error || preview.error} />
        <Field label="Employee" required>
          <Select value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} required>
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Join date" required>
            <Input type="date" value={form.joinDate} onChange={(e) => set("joinDate", e.target.value)} required />
          </Field>
          <Field label="Exit date" required>
            <Input type="date" value={form.exitDate} onChange={(e) => set("exitDate", e.target.value)} required />
          </Field>
        </div>
        <Field label="Basic monthly pay (major units)" required hint="Used by the backend to compute gratuity.">
          <Input
            type="number"
            step="0.01"
            value={form.basicMonthlyMajor}
            onChange={(e) => set("basicMonthlyMajor", e.target.value)}
            required
          />
        </Field>
        <Field label="Reason">
          <Input value={form.reason} onChange={(e) => set("reason", e.target.value)} />
        </Field>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canPreview || preview.isPending}
            onClick={() => preview.mutate()}
          >
            {preview.isPending ? "Computing…" : "Preview EOSG"}
          </Button>
          <span className="text-xs text-slate-400">Gratuity is computed server-side, never in the browser.</span>
        </div>

        {preview.data && <EosgSummary eosg={preview.data} />}
      </form>
    </Modal>
  );
}
