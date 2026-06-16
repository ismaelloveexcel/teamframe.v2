import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus } from "lucide-react";
import {
  acknowledgePolicy,
  createPolicy,
  listAcknowledgements,
  listPolicies,
  type PolicyInput,
} from "../api/policies";
import { listEmployees } from "../api/employees";
import type { Policy } from "../api/schemas";
import { useAuth } from "../auth/AuthProvider";
import { formatDate } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Textarea } from "../components/ui";
import { Modal } from "../components/Modal";
import { EmptyState, ErrorBanner, QueryState } from "../components/states";

export function PoliciesPage() {
  const { isAdmin } = useAuth();
  const [creating, setCreating] = useState(false);
  const [acking, setAcking] = useState<Policy | null>(null);
  const query = useQuery({ queryKey: ["policies"], queryFn: listPolicies });

  return (
    <div>
      <PageHeader
        title="Policies"
        description={isAdmin ? "Publish and track policy acknowledgements." : "Review and acknowledge company policies."}
        actions={
          isAdmin ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New policy
            </Button>
          ) : undefined
        }
      />
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        data={query.data}
        refetch={query.refetch}
        isEmpty={(d) => d.data.length === 0}
        empty={
          <Card>
            <EmptyState
              title="No policies yet"
              action={isAdmin ? <Button onClick={() => setCreating(true)}>New policy</Button> : undefined}
            />
          </Card>
        }
      >
        {(data) => (
          <div className="space-y-4">
            {data.data.map((p) => (
              <PolicyCard
                key={p.id}
                policy={p}
                isAdmin={isAdmin}
                onAcknowledge={() => setAcking(p)}
              />
            ))}
          </div>
        )}
      </QueryState>

      {creating && <PolicyModal onClose={() => setCreating(false)} />}
      {acking && (
        <AcknowledgeModal policy={acking} isAdmin={isAdmin} onClose={() => setAcking(null)} />
      )}
    </div>
  );
}

function PolicyCard({
  policy,
  isAdmin,
  onAcknowledge,
}: {
  policy: Policy;
  isAdmin: boolean;
  onAcknowledge: () => void;
}) {
  const [showAcks, setShowAcks] = useState(false);
  const acks = useQuery({
    queryKey: ["policy-acks", policy.id],
    queryFn: () => listAcknowledgements(policy.id),
    enabled: isAdmin && showAcks,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {policy.title}
            <Badge tone="neutral">v{policy.version}</Badge>
          </span>
        }
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="secondary" size="sm" onClick={() => setShowAcks((s) => !s)}>
                {showAcks ? "Hide" : "Acknowledgements"}
              </Button>
            )}
            <Button size="sm" onClick={onAcknowledge}>
              <Check className="h-4 w-4" /> Acknowledge
            </Button>
          </div>
        }
      />
      <div className="whitespace-pre-wrap px-5 py-4 text-sm text-slate-700">{policy.body}</div>
      {isAdmin && showAcks && (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <QueryState
            isLoading={acks.isLoading}
            isError={acks.isError}
            error={acks.error}
            data={acks.data}
            refetch={acks.refetch}
            loading={<p className="text-sm text-slate-500">Loading…</p>}
            isEmpty={(d) => d.data.length === 0}
            empty={<p className="text-sm text-slate-500">No acknowledgements yet.</p>}
          >
            {(data) => (
              <ul className="space-y-1 text-sm text-slate-600">
                {data.data.map((a) => (
                  <li key={a.id} className="flex justify-between">
                    <span>{a.employeeId}</span>
                    <span className="text-slate-400">
                      v{a.version} · {formatDate(a.acknowledgedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </QueryState>
        </div>
      )}
    </Card>
  );
}

function PolicyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<PolicyInput>({ title: "", body: "" });
  const mutation = useMutation({
    mutationFn: () => createPolicy(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
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
      title="New policy"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button form="policy-form" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Publishing…" : "Publish"}
          </Button>
        </>
      }
    >
      <form id="policy-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Title" required>
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        </Field>
        <Field label="Body" required>
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

function AcknowledgeModal({
  policy,
  isAdmin,
  onClose,
}: {
  policy: Policy;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const employees = useQuery({
    queryKey: ["employees"],
    queryFn: () => listEmployees(),
    enabled: isAdmin,
  });
  const mutation = useMutation({
    mutationFn: () => acknowledgePolicy(policy.id, isAdmin ? employeeId : undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy-acks", policy.id] });
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
      title={`Acknowledge: ${policy.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            form="ack-form"
            type="submit"
            disabled={mutation.isPending || (isAdmin && !employeeId)}
          >
            {mutation.isPending ? "Recording…" : "Acknowledge"}
          </Button>
        </>
      }
    >
      <form id="ack-form" className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        {isAdmin ? (
          <Field label="Employee" required hint="Record acknowledgement on behalf of an employee.">
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
              <option value="">Select employee…</option>
              {employees.data?.data.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-sm text-slate-600">
            By acknowledging, you confirm you have read and understood
            <span className="font-medium"> {policy.title}</span> (version {policy.version}).
          </p>
        )}
      </form>
    </Modal>
  );
}
