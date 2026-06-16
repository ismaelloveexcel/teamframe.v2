import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import {
  createCompensation,
  deleteCompensation,
  listCompensation,
  type CompensationInput,
} from "../api/compensation";
import { listEmployees } from "../api/employees";
import type { Compensation } from "../api/schemas";
import { useAuth } from "../auth/AuthProvider";
import { formatDate, formatMinorUnits, fullName, todayISO } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Field, Input, Select } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorBanner, PageCard, QueryState } from "../components/states";

export function CompensationPage() {
  const { isAdmin } = useAuth();
  const [creating, setCreating] = useState(false);
  const comp = useQuery({ queryKey: ["compensation"], queryFn: () => listCompensation() });
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
    enabled: isAdmin,
  });

  const empName = useMemo(() => {
    const map = new Map<string, string>();
    employees.data?.data.forEach((e) => map.set(e.id, fullName(e)));
    return (id: string) => map.get(id) ?? id;
  }, [employees.data]);

  return (
    <div>
      <PageHeader
        title="Compensation"
        description={
          isAdmin
            ? "Salary and bank details across your organization."
            : "Your compensation record. Salary fields are managed by HR."
        }
        actions={
          isAdmin ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Add record
            </Button>
          ) : undefined
        }
      />
      <PageCard>
        <QueryState
          isLoading={comp.isLoading}
          isError={comp.isError}
          error={comp.error}
          data={comp.data}
          refetch={comp.refetch}
          isEmpty={(d) => d.data.length === 0}
          empty={<EmptyState title="No compensation records" />}
        >
          {(data) => <CompTable rows={data.data} isAdmin={isAdmin} empName={empName} />}
        </QueryState>
      </PageCard>

      {creating && isAdmin && (
        <CompModal
          onClose={() => setCreating(false)}
          employees={employees.data?.data ?? []}
        />
      )}
    </div>
  );
}

function CompTable({
  rows,
  isAdmin,
  empName,
}: {
  rows: Compensation[];
  isAdmin: boolean;
  empName: (id: string) => string;
}) {
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => deleteCompensation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compensation"] }),
  });

  const columns: Column<Compensation>[] = [
    ...(isAdmin
      ? [
          {
            key: "emp",
            header: "Employee",
            render: (c: Compensation) => (
              <span className="font-medium text-slate-900">{empName(c.employeeId)}</span>
            ),
          },
        ]
      : []),
    {
      key: "amount",
      header: "Amount",
      render: (c: Compensation) =>
        c.amount != null ? (
          formatMinorUnits(c.amount, c.currency)
        ) : (
          <Badge tone="neutral">hidden</Badge>
        ),
    },
    { key: "currency", header: "Currency", render: (c) => c.currency ?? "—" },
    { key: "effective", header: "Effective", render: (c) => formatDate(c.effectiveDate) },
    { key: "bank", header: "Bank", render: (c) => c.bankName ?? "—" },
    ...(isAdmin
      ? [
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (c: Compensation) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm("Delete this compensation record?")) del.mutate(c.id);
                }}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            ),
          },
        ]
      : []),
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} />;
}

function CompModal({
  onClose,
  employees,
}: {
  onClose: () => void;
  employees: { id: string; firstName: string; lastName: string }[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{
    employeeId: string;
    currency: string;
    amountMajor: string;
    effectiveDate: string;
    bankName: string;
    iban: string;
  }>({
    employeeId: "",
    currency: "AED",
    amountMajor: "",
    effectiveDate: todayISO(),
    bankName: "",
    iban: "",
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CompensationInput = {
        employeeId: form.employeeId,
        currency: form.currency,
        // Convert major units entered by the admin into the minor units the
        // backend stores. We never compute salary — just unit conversion of the
        // entered figure.
        amount: form.amountMajor ? Math.round(parseFloat(form.amountMajor) * 100) : undefined,
        effectiveDate: form.effectiveDate || null,
        bankName: form.bankName || null,
        iban: form.iban || null,
      };
      return createCompensation(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compensation"] });
      onClose();
    },
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Add compensation"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="comp-form" type="submit" disabled={mutation.isPending || !form.employeeId}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="comp-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Employee" required>
          <Select value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)} required>
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (major units)" hint="e.g. 12000.00">
            <Input
              type="number"
              step="0.01"
              value={form.amountMajor}
              onChange={(e) => set("amountMajor", e.target.value)}
            />
          </Field>
          <Field label="Currency" required>
            <Input value={form.currency} onChange={(e) => set("currency", e.target.value)} required />
          </Field>
        </div>
        <Field label="Effective date">
          <Input type="date" value={form.effectiveDate} onChange={(e) => set("effectiveDate", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bank name">
            <Input value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
          </Field>
          <Field label="IBAN">
            <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
