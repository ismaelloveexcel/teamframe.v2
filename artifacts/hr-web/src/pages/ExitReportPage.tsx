import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";
import { generateExitReport, getReport, listReports } from "../api/reports";
import { listEmployees } from "../api/employees";
import type { Report } from "../api/schemas";
import { formatDate, fullName } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Button, Card, CardHeader, Field, Select } from "../components/ui";
import { EmptyState, ErrorBanner, QueryState } from "../components/states";
import { ReportViewer } from "./ReportViewer";

export function ExitReportPage() {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [selected, setSelected] = useState<Report | null>(null);

  const employees = useQuery({ queryKey: ["employees"], queryFn: () => listEmployees() });
  const history = useQuery({
    queryKey: ["reports", "exit"],
    queryFn: () => listReports("exit"),
  });

  const empName = useMemo(() => {
    const map = new Map<string, string>();
    employees.data?.data.forEach((e) => map.set(e.id, fullName(e)));
    return (id: string | null) => (id ? map.get(id) ?? id : "—");
  }, [employees.data]);

  const generate = useMutation({
    mutationFn: () => generateExitReport({ employeeId }),
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ["reports", "exit"] });
      setSelected(report);
    },
  });

  const open = useMutation({
    mutationFn: (id: string) => getReport(id),
    onSuccess: (report) => setSelected(report),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    generate.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Exit report"
        description="Generate a frozen exit document for an employee, then view, print, or download it."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <form className="space-y-4" onSubmit={onSubmit}>
              <ErrorBanner error={generate.error} />
              <Field label="Employee" required>
                <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required>
                  <option value="">Select employee…</option>
                  {employees.data?.data.map((e) => (
                    <option key={e.id} value={e.id}>{fullName(e)}</option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" className="w-full" disabled={generate.isPending || !employeeId}>
                {generate.isPending ? "Generating…" : "Generate report"}
              </Button>
            </form>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="History" />
            <QueryState
              isLoading={history.isLoading}
              isError={history.isError}
              error={history.error}
              data={history.data}
              refetch={history.refetch}
              isEmpty={(d) => d.data.length === 0}
              empty={<EmptyState icon={<FileBarChart className="h-8 w-8" />} title="No reports yet" />}
            >
              {(data) => (
                <ul className="divide-y divide-slate-100">
                  {data.data.map((r) => (
                    <li key={r.id}>
                      <button
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                          selected?.id === r.id ? "bg-slate-50 font-medium" : ""
                        }`}
                        onClick={() => open.mutate(r.id)}
                      >
                        <span>{empName(r.subjectId)}</span>
                        <span className="text-slate-400">{formatDate(r.generatedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </QueryState>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <ReportViewer report={selected} />
          ) : (
            <Card>
              <EmptyState
                icon={<FileBarChart className="h-10 w-10" />}
                title="No report selected"
                description="Generate a new report or pick one from the history."
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
