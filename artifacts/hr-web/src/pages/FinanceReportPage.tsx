import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileBarChart } from "lucide-react";
import { generateFinanceReport, getReport, listReports } from "../api/reports";
import type { Report } from "../api/schemas";
import { formatDate, todayISO } from "../lib/utils";
import { PageHeader } from "../components/PageHeader";
import { Button, Card, CardHeader, Field, Input } from "../components/ui";
import { EmptyState, ErrorBanner, QueryState } from "../components/states";
import { ReportViewer } from "./ReportViewer";

export function FinanceReportPage() {
  const queryClient = useQueryClient();
  const [periodCutoff, setPeriodCutoff] = useState(todayISO());
  const [selected, setSelected] = useState<Report | null>(null);

  const history = useQuery({
    queryKey: ["reports", "finance"],
    queryFn: () => listReports("finance"),
  });

  const generate = useMutation({
    mutationFn: () => generateFinanceReport({ periodCutoff }),
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ["reports", "finance"] });
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
        title="Finance report"
        description="Generate the payroll handoff for a period cutoff, then view, print, or download it."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card className="p-5">
            <form className="space-y-4" onSubmit={onSubmit}>
              <ErrorBanner error={generate.error} />
              <Field label="Period cutoff" required hint="Include data on or before this date.">
                <Input
                  type="date"
                  value={periodCutoff}
                  onChange={(e) => setPeriodCutoff(e.target.value)}
                  required
                />
              </Field>
              <Button type="submit" className="w-full" disabled={generate.isPending}>
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
                <ul className="divide-y divide-tf-border-soft">
                  {data.data.map((r) => (
                    <li key={r.id}>
                      <button
                        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors hover:bg-tf-panel ${
                          selected?.id === r.id ? "bg-accent-soft/50 font-medium text-accent-strong" : "text-tf-text"
                        }`}
                        onClick={() => open.mutate(r.id)}
                      >
                        <span>Cutoff {formatDate(r.periodCutoff)}</span>
                        <span className="text-tf-subtle text-xs">{formatDate(r.generatedAt)}</span>
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
