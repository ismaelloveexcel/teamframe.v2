import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import {
  createPosition,
  listPositions,
  updatePosition,
  type CreatePositionInput,
} from "../api/positions";
import type { Position } from "../api/schemas";
import { usePaginatedList } from "../lib/usePaginatedList";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Field, Input, Select, Textarea, statusTone } from "../components/ui";
import { DataTable, Pagination, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorBanner, PageCard, QueryState } from "../components/states";

function matches(p: Position, q: string): boolean {
  return (
    p.title.toLowerCase().includes(q) ||
    (p.department ?? "").toLowerCase().includes(q) ||
    (p.grade ?? "").toLowerCase().includes(q)
  );
}

export function PositionsPage() {
  const [editing, setEditing] = useState<Position | null>(null);
  const [creating, setCreating] = useState(false);
  const query = useQuery({ queryKey: ["positions"], queryFn: () => listPositions() });

  return (
    <div>
      <PageHeader
        title="Positions"
        description="Define the roles in your organization."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New position
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
              title="No positions yet"
              action={<Button onClick={() => setCreating(true)}>New position</Button>}
            />
          }
        >
          {(data) => <PositionsTable rows={data.data} onEdit={setEditing} />}
        </QueryState>
      </PageCard>

      {creating && (
        <PositionModal mode="create" onClose={() => setCreating(false)} positions={query.data?.data ?? []} />
      )}
      {editing && (
        <PositionModal
          mode="edit"
          position={editing}
          onClose={() => setEditing(null)}
          positions={query.data?.data ?? []}
        />
      )}
    </div>
  );
}

function PositionsTable({
  rows,
  onEdit,
}: {
  rows: Position[];
  onEdit: (p: Position) => void;
}) {
  const { query, setQuery, page, setPage, pageCount, total, pageItems } =
    usePaginatedList(rows, matches);

  const columns: Column<Position>[] = [
    { key: "title", header: "Title", render: (p) => <span className="font-medium text-slate-900">{p.title}</span> },
    { key: "dept", header: "Department", render: (p) => p.department ?? "—" },
    { key: "grade", header: "Grade", render: (p) => p.grade ?? "—" },
    { key: "location", header: "Location", render: (p) => p.location ?? "—" },
    { key: "status", header: "Status", render: (p) => <Badge tone={statusTone(p.status)}>{p.status}</Badge> },
  ];

  return (
    <>
      <div className="border-b border-slate-100 p-3">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search positions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      {pageItems.length === 0 ? (
        <EmptyState title="No matches" />
      ) : (
        <>
          <DataTable columns={columns} rows={pageItems} rowKey={(p) => p.id} onRowClick={onEdit} />
          <Pagination page={page} pageCount={pageCount} total={total} onPage={setPage} />
        </>
      )}
    </>
  );
}

function PositionModal({
  mode,
  position,
  positions,
  onClose,
}: {
  mode: "create" | "edit";
  position?: Position;
  positions: Position[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreatePositionInput>({
    title: position?.title ?? "",
    department: position?.department ?? "",
    grade: position?.grade ?? "",
    location: position?.location ?? "",
    employmentType: position?.employmentType ?? "",
    lineManagerId: position?.lineManagerId ?? "",
    jobDescription: position?.jobDescription ?? "",
    budgeted: position?.budgeted ?? true,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const payload: CreatePositionInput = {
        ...form,
        department: form.department || null,
        grade: form.grade || null,
        location: form.location || null,
        employmentType: form.employmentType || null,
        lineManagerId: form.lineManagerId || null,
        jobDescription: form.jobDescription || null,
      };
      return mode === "create"
        ? createPosition(payload)
        : updatePosition(position!.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["orgchart"] });
      onClose();
    },
  });

  const set = <K extends keyof CreatePositionInput>(k: K, v: CreatePositionInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const managerOptions = positions.filter((p) => p.id !== position?.id);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={mode === "create" ? "New position" : "Edit position"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="position-form" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="position-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Title" required>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Department">
            <Input value={form.department ?? ""} onChange={(e) => set("department", e.target.value)} />
          </Field>
          <Field label="Grade">
            <Input value={form.grade ?? ""} onChange={(e) => set("grade", e.target.value)} />
          </Field>
          <Field label="Location">
            <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Employment type">
            <Input value={form.employmentType ?? ""} onChange={(e) => set("employmentType", e.target.value)} />
          </Field>
        </div>
        <Field label="Reports to (line manager position)">
          <Select
            value={form.lineManagerId ?? ""}
            onChange={(e) => set("lineManagerId", e.target.value)}
          >
            <option value="">None (top of tree)</option>
            {managerOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </Select>
        </Field>
        <Field label="Job description">
          <Textarea
            value={form.jobDescription ?? ""}
            onChange={(e) => set("jobDescription", e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}
