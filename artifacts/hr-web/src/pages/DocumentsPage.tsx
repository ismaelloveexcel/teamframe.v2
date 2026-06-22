import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Plus, Sparkles } from "lucide-react";
import {
  createTemplate,
  generateDocument,
  getDocument,
  listDocuments,
  listTemplates,
  type TemplateInput,
} from "../api/documents";
import { listEmployees } from "../api/employees";
import type { Document, Template } from "../api/schemas";
import { fullName, formatDate } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Button, Card, CardHeader, Field, Input, Select, Textarea } from "../components/ui";
import { DataTable, type Column } from "../components/DataTable";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorBanner, QueryState } from "../components/states";

function downloadText(name: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9.-]+/gi, "_")}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DocumentsPage() {
  const [tab, setTab] = useState<"documents" | "templates">("documents");
  const [genOpen, setGenOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Generate documents from templates and download them."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setTplOpen(true)}>
              <Plus className="h-4 w-4" /> New template
            </Button>
            <Button onClick={() => setGenOpen(true)}>
              <Sparkles className="h-4 w-4" /> Generate
            </Button>
          </div>
        }
      />

      <div className="mb-5 flex gap-1 border-b border-tf-border">
        {(["documents", "templates"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
              tab === t ? "border-accent text-accent-strong" : "border-transparent text-tf-muted hover:text-tf-text"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "documents" ? <DocumentsList /> : <TemplatesList />}

      {genOpen && <GenerateModal onClose={() => setGenOpen(false)} />}
      {tplOpen && <TemplateModal onClose={() => setTplOpen(false)} />}
    </div>
  );
}

function DocumentsList() {
  const docs = useQuery({ queryKey: ["documents"], queryFn: () => listDocuments() });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });

  const empName = useMemo(() => {
    const map = new Map<string, string>();
    employees.data?.data.forEach((e) => map.set(e.id, fullName(e)));
    return (id: string | null) => (id ? map.get(id) ?? id : "—");
  }, [employees.data]);

  const download = useMutation({
    mutationFn: (id: string) => getDocument(id),
    onSuccess: (doc) => downloadText(doc.name, doc.content ?? "(no content)"),
  });

  const columns: Column<Document>[] = [
    { key: "name", header: "Name", render: (d) => <span className="font-medium text-slate-900">{d.name}</span> },
    { key: "emp", header: "Employee", render: (d) => empName(d.employeeId) },
    { key: "created", header: "Created", render: (d) => formatDate(d.createdAt) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (d) => (
        <Button variant="secondary" size="sm" onClick={() => download.mutate(d.id)} disabled={download.isPending}>
          <Download className="h-4 w-4" /> Download
        </Button>
      ),
    },
  ];

  return (
    <Card className="overflow-hidden">
      <QueryState
        isLoading={docs.isLoading}
        isError={docs.isError}
        error={docs.error}
        data={docs.data}
        refetch={docs.refetch}
        isEmpty={(d) => d.data.length === 0}
        empty={<EmptyState icon={<FileText className="h-10 w-10" />} title="No documents" description="Generate one from a template." />}
      >
        {(data) => <DataTable columns={columns} rows={data.data} rowKey={(d) => d.id} />}
      </QueryState>
      {download.isError && (
        <div className="px-4 py-2">
          <ErrorBanner error={download.error} />
        </div>
      )}
    </Card>
  );
}

function TemplatesList() {
  const templates = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const columns: Column<Template>[] = [
    { key: "name", header: "Name", render: (t) => <span className="font-medium text-slate-900">{t.name}</span> },
    { key: "created", header: "Created", render: (t) => formatDate(t.createdAt) },
  ];
  return (
    <Card className="overflow-hidden">
      <QueryState
        isLoading={templates.isLoading}
        isError={templates.isError}
        error={templates.error}
        data={templates.data}
        refetch={templates.refetch}
        isEmpty={(d) => d.data.length === 0}
        empty={<EmptyState title="No templates" description="Create a template to generate documents." />}
      >
        {(data) => <DataTable columns={columns} rows={data.data} rowKey={(t) => t.id} />}
      </QueryState>
    </Card>
  );
}

function TemplateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TemplateInput>({ name: "", body: "" });
  const mutation = useMutation({
    mutationFn: () => createTemplate(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
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
      size="lg"
      title="New template"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="tpl-form" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="tpl-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </Field>
        <Field label="Body" required hint="Use {{placeholders}} to substitute data at generation.">
          <Textarea
            className="min-h-40"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            required
          />
        </Field>
      </form>
    </Modal>
  );
}

function GenerateModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const templates = useQuery({ queryKey: ["templates"], queryFn: listTemplates });
  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const [templateId, setTemplateId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [dataJson, setDataJson] = useState("{}");
  const [jsonError, setJsonError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => {
      let data: Record<string, unknown> = {};
      try {
        data = dataJson.trim() ? JSON.parse(dataJson) : {};
      } catch {
        throw new Error("Data must be valid JSON.");
      }
      return generateDocument(templateId, {
        data,
        name: name || undefined,
        employeeId: employeeId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onClose();
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    try {
      if (dataJson.trim()) JSON.parse(dataJson);
      setJsonError(null);
    } catch {
      setJsonError("Data must be valid JSON.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Generate document"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="gen-form" type="submit" disabled={mutation.isPending || !templateId}>
            {mutation.isPending ? "Generating…" : "Generate"}
          </Button>
        </>
      }
    >
      <form id="gen-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Template" required>
          <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
            <option value="">Select a template…</option>
            {templates.data?.data.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Employee (optional)">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">None</option>
            {employees.data?.data.map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </Select>
        </Field>
        <Field label="Document name (optional)">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Data (JSON)" hint="Values substituted into the template placeholders.">
          <Textarea value={dataJson} onChange={(e) => setDataJson(e.target.value)} className="font-mono text-xs" />
        </Field>
        {jsonError && <p className="text-sm text-red-600">{jsonError}</p>}
      </form>
    </Modal>
  );
}
