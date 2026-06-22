import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { fetchReportRender } from "../api/reports";
import type { Report } from "../api/schemas";
import { formatDate } from "../lib/utils";
import { Badge, Button, Card, CardHeader } from "../components/ui";

function downloadJson(report: Report) {
  const blob = new Blob([JSON.stringify(report.content, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.kind}-report-${report.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Renders a generated, FROZEN report. Tries the server-rendered HTML
 * (GET /reports/:id/render); if unavailable falls back to structured JSON render.
 */
export function ReportViewer({ report }: { report: Report }) {
  const render = useQuery({
    queryKey: ["report-render", report.id],
    queryFn: () => fetchReportRender(report.id),
    retry: false,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {report.kind === "finance" ? "Finance Report" : "Exit Report"}
            <Badge tone="accent">frozen</Badge>
          </span>
        }
        description={`Generated ${formatDate(report.generatedAt)}${
          report.periodCutoff ? ` · cutoff ${formatDate(report.periodCutoff)}` : ""
        }`}
        action={
          <div className="no-print flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button variant="secondary" size="sm" onClick={() => downloadJson(report)}>
              <Download className="h-4 w-4" /> Download JSON
            </Button>
          </div>
        }
      />
      <div className="p-5">
        {render.isSuccess ? (
          <div
            className="prose prose-sm max-w-none"
            // Server-rendered, trusted report HTML.
            dangerouslySetInnerHTML={{ __html: render.data }}
          />
        ) : (
          <JsonReport report={report} />
        )}
      </div>
    </Card>
  );
}

function JsonReport({ report }: { report: Report }) {
  const content = report.content as Record<string, unknown>;
  const lines = content.lines as Array<Record<string, unknown>> | undefined;
  const totals = content.totals as Record<string, unknown> | undefined;

  return (
    <div className="space-y-5">
      <div className="no-print rounded-xl border border-tf-warning-soft bg-tf-warning-soft px-3.5 py-2.5 text-xs text-tf-warning">
        Server-rendered HTML view is unavailable — showing the frozen report content.
      </div>

      {lines && lines.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-tf-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-tf-border bg-tf-bg text-left text-xs font-medium uppercase tracking-wide text-tf-subtle">
                {Object.keys(lines[0] ?? {}).map((k) => (
                  <th key={k} className="px-4 py-3">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-tf-border-soft">
              {lines.map((row, i) => (
                <tr key={i} className="hover:bg-tf-panel/50 transition-colors">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-4 py-3 text-tf-text">
                      {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totals && (
        <div className="rounded-xl border border-tf-border bg-tf-panel p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-tf-muted">
            Totals
          </p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(totals).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white px-3 py-2.5 shadow-sm ring-1 ring-tf-border">
                <dt className="text-xs text-tf-muted">{k}</dt>
                <dd className="mt-0.5 font-semibold text-tf-text">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-tf-muted hover:text-tf-text transition-colors">
          Raw content
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-900 p-4 text-slate-100 text-xs leading-relaxed">
          {JSON.stringify(report.content, null, 2)}
        </pre>
      </details>
    </div>
  );
}
