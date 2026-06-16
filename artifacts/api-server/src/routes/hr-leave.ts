import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import {
  allowedLeaveTypes,
  createLeave,
  getLeave,
  listLeave,
  listLeaveBalances,
  setLeaveBalance,
  updateLeave,
} from "../services/hr-leave-service.js";

const router: IRouter = Router();

router.use("/leave", requireSessionAuth, requireRole("admin", "super_admin"));
router.use("/leave-balances", requireSessionAuth, requireRole("admin", "super_admin"));

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

// Expose the leave-type set for the caller's company jurisdiction. Response is
// a string array of codes (unchanged shape consumed by hr-web).
router.get(
  "/leave/types",
  asyncHandler(async (req, res) => {
    const types = await allowedLeaveTypes(companyOf(req));
    res.json(types.map((t) => t.code));
  }),
);

router.post(
  "/leave",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { employeeId, type, startDate, endDate, days } = req.body ?? {};
    if (!employeeId || !type || !startDate || !endDate || days == null) {
      badRequest("employeeId, type, startDate, endDate and days are required");
    }
    const row = await createLeave(companyOf(req), actor.userId, req.body);
    res.status(201).json(row);
  }),
);

router.get(
  "/leave",
  asyncHandler(async (req, res) => {
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
    res.json(await listLeave(companyOf(req), employeeId));
  }),
);

router.get(
  "/leave/:id",
  asyncHandler(async (req, res) => {
    const row = await getLeave(companyOf(req), String(req.params.id));
    if (!row) notFound("Leave not found");
    res.json(row);
  }),
);

router.patch(
  "/leave/:id",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const row = await updateLeave(companyOf(req), actor.userId, String(req.params.id), req.body);
    if (!row) notFound("Leave not found");
    res.json(row);
  }),
);

// ── Leave balances ──────────────────────────────────────────────────────
router.get(
  "/leave-balances",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
    res.json(await listLeaveBalances(companyOf(req), employeeId));
  }),
);

router.put(
  "/leave-balances",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { employeeId, type, balanceDays } = req.body ?? {};
    if (!employeeId || !type || balanceDays == null) {
      badRequest("employeeId, type and balanceDays are required");
    }
    const row = await setLeaveBalance(companyOf(req), actor.userId, req.body);
    res.status(201).json(row);
  }),
);

export default router;
