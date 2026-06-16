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
 * (GET /reports/:id/render, on feat/report-ux-polish); if unavailable it falls
 * back to a structured render of the frozen JSON content.
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
            {report.kind === "finance" ? "Finance report" : "Exit report"}
            <Badge tone="blue">frozen</Badge>
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
  const lines = content.lines as
    | Array<Record<string, unknown>>
    | undefined;
  const totals = content.totals as Record<string, unknown> | undefined;

  return (
    <div className="space-y-4">
      <p className="no-print rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
        Server-rendered HTML view is unavailable on this backend; showing the
        frozen report content.
      </p>

      {lines && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                {Object.keys(lines[0] ?? {}).map((k) => (
                  <th key={k} className="px-3 py-2 font-medium">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-3 py-2 text-slate-700">
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
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="mb-2 font-medium text-slate-700">Totals</p>
          <dl className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {Object.entries(totals).map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-medium text-slate-900">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Raw content</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-slate-900 p-3 text-slate-100">
          {JSON.stringify(report.content, null, 2)}
        </pre>
      </details>
    </div>
  );
}
