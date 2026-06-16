import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { companiesTable, db } from "@workspace/db";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import {
  generateExitReport,
  generateFinanceReport,
  getReport,
  listReports,
} from "../services/hr-report-service.js";
import { renderReportHtml } from "../services/hr-report-render.js";

const router: IRouter = Router();

router.use("/reports", requireSessionAuth, requireRole("admin", "super_admin"));

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

// Generate the Finance/payroll handoff for a period cutoff (FROZEN).
router.post(
  "/reports/finance",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { periodCutoff } = req.body ?? {};
    if (!periodCutoff) badRequest("periodCutoff (ISO date) is required");
    const row = await generateFinanceReport(companyOf(req), actor.userId, String(periodCutoff));
    res.status(201).json(row);
  }),
);

// Generate the exit report for an employee (FROZEN at exit_date).
router.post(
  "/reports/exit",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { employeeId } = req.body ?? {};
    if (!employeeId) badRequest("employeeId is required");
    const row = await generateExitReport(companyOf(req), actor.userId, String(employeeId));
    res.status(201).json(row);
  }),
);

router.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const kind = req.query.kind === "finance" || req.query.kind === "exit" ? req.query.kind : undefined;
    res.json(await listReports(companyOf(req), kind));
  }),
);

router.get(
  "/reports/:id",
  asyncHandler(async (req, res) => {
    const row = await getReport(companyOf(req), String(req.params.id));
    if (!row) notFound("Report not found");
    res.json(row);
  }),
);

// Render a stored report to a polished, self-contained HTML document.
// Content-negotiated: `?format=html` or an Accept: text/html header returns the
// rendered document; otherwise the JSON row (default). PURE VIEW over the
// FROZEN content — no recomputation, no mutation.
router.get(
  "/reports/:id/render",
  asyncHandler(async (req, res) => {
    const companyId = companyOf(req);
    const row = await getReport(companyId, String(req.params.id));
    if (!row) notFound("Report not found");

    const wantsJson =
      req.query.format === "json" ||
      (req.query.format !== "html" && req.accepts(["html", "json"]) === "json");
    if (wantsJson) {
      res.json(row);
      return;
    }

    // Letterhead enrichment from the company row (presentation chrome only —
    // not part of the frozen financial content).
    const [company] = await db
      .select({ name: companiesTable.name, jurisdiction: companiesTable.jurisdiction })
      .from(companiesTable)
      .where(eq(companiesTable.id, companyId));

    const html = renderReportHtml(row!, {
      companyName: company?.name ?? null,
      jurisdiction: company?.jurisdiction ?? null,
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  }),
);

export default router;
