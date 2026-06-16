import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import {
  createEmployee,
  listEmployees,
  type CreateEmployeeInput,
} from "../api/employees";
import type { Employee } from "../api/schemas";
import { fullName, formatDate } from "../lib/utils";
import { usePaginatedList } from "../lib/usePaginatedList";
import { PageHeader } from "../components/PageHeader";
import { Button, Field, Input, Badge, statusTone } from "../components/ui";
import { DataTable, Pagination, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import {
  EmptyState,
  ErrorBanner,
  PageCard,
  QueryState,
} from "../components/states";

function matches(e: Employee, q: string): boolean {
  return (
    fullName(e).toLowerCase().includes(q) ||
    e.employeeNo.toLowerCase().includes(q) ||
    (e.companyEmail ?? "").toLowerCase().includes(q) ||
    (e.personalEmail ?? "").toLowerCase().includes(q)
  );
}

export function EmployeesPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Manage your people directory."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New employee
          </Button>
        }
      />

      <PageCard>
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          data={query.data}
          refetch={query.refetch}
          isEmpty={(d) => d.data.length === 0}
          empty={
            <EmptyState
              title="No employees yet"
              description="Add your first employee to get started."
              action={<Button onClick={() => setOpen(true)}>New employee</Button>}
            />
          }
        >
          {(data) => (
            <EmployeesTable
              rows={data.data}
              onRowClick={(e) => navigate(`/employees/${e.id}`)}
            />
          )}
        </QueryState>
      </PageCard>

      <CreateEmployeeModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function EmployeesTable({
  rows,
  onRowClick,
}: {
  rows: Employee[];
  onRowClick: (e: Employee) => void;
}) {
  const { query, setQuery, page, setPage, pageCount, total, pageItems } =
    usePaginatedList(rows, matches);

  const columns: Column<Employee>[] = [
    {
      key: "name",
      header: "Name",
      render: (e) => <span className="font-medium text-slate-900">{fullName(e)}</span>,
    },
    { key: "no", header: "Employee #", render: (e) => e.employeeNo },
    { key: "email", header: "Email", render: (e) => e.companyEmail ?? e.personalEmail ?? "—" },
    { key: "join", header: "Join date", render: (e) => formatDate(e.joinDate) },
    {
      key: "status",
      header: "Status",
      render: (e) => <Badge tone={statusTone(e.status)}>{e.status}</Badge>,
    },
  ];

  return (
    <>
      <div className="border-b border-slate-100 p-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search by name, number or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {pageItems.length === 0 ? (
        <EmptyState title="No matches" description="Try a different search term." />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={pageItems}
            rowKey={(e) => e.id}
            onRowClick={onRowClick}
          />
          <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
        </>
      )}
    </>
  );
}

function CreateEmployeeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateEmployeeInput>({
    employeeNo: "",
    firstName: "",
    lastName: "",
    companyEmail: "",
    joinDate: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      createEmployee({
        ...form,
        companyEmail: form.companyEmail || null,
        joinDate: form.joinDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onClose();
      setForm({ employeeNo: "", firstName: "", lastName: "", companyEmail: "", joinDate: "" });
    },
  });

  const set = (k: keyof CreateEmployeeInput) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New employee"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button form="new-employee" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create"}
          </Button>
        </>
      }
    >
      <form id="new-employee" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Employee number" required>
          <Input
            value={form.employeeNo}
            onChange={(e) => set("employeeNo")(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <Input
              value={form.firstName}
              onChange={(e) => set("firstName")(e.target.value)}
              required
            />
          </Field>
          <Field label="Last name" required>
            <Input
              value={form.lastName}
              onChange={(e) => set("lastName")(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Company email">
          <Input
            type="email"
            value={form.companyEmail ?? ""}
            onChange={(e) => set("companyEmail")(e.target.value)}
          />
        </Field>
        <Field label="Join date">
          <Input
            type="date"
            value={form.joinDate ?? ""}
            onChange={(e) => set("joinDate")(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
