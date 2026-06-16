import { Router, type IRouter } from "express";
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

export default router;
