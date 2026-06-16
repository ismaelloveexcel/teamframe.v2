import { apiBaseUrl, getList, getValidated, postValidated } from "../lib/api-client";
import { getToken } from "../lib/token";
import { reportSchema, type Report } from "./schemas";

export function listReports(kind?: "finance" | "exit") {
  return getList("/reports", reportSchema, kind ? { kind } : undefined);
}

export function getReport(id: string): Promise<Report> {
  return getValidated(`/reports/${id}`, reportSchema);
}

export type FinanceReportInput = { periodCutoff: string };

export function generateFinanceReport(input: FinanceReportInput): Promise<Report> {
  return postValidated("/reports/finance", input, reportSchema);
}

export type ExitReportInput = { employeeId: string };

export function generateExitReport(input: ExitReportInput): Promise<Report> {
  return postValidated("/reports/exit", input, reportSchema);
}

/**
 * Fetch the rendered HTML for a report. This endpoint (GET /reports/:id/render)
 * lives on feat/report-ux-polish and may be absent on main — callers fall back
 * to rendering the frozen JSON `content` when it 404s.
 */
export async function fetchReportRender(id: string): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/reports/${id}/render`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) {
    throw new Error(`render unavailable (${res.status})`);
  }
  return res.text();
}
