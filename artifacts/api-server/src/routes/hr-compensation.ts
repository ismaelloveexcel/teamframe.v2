import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole, gateFields } from "../middlewares/rbac.js";
import type { HrCompensation } from "@workspace/db";
import {
  createCompensation,
  deleteCompensation,
  getCompensation,
  listCompensation,
  updateCompensation,
} from "../services/hr-compensation-service.js";
import { getEmployeeByUserId } from "../services/hr-employee-service.js";

const router: IRouter = Router();

// Reads allowed for any authed role (field-gated below); writes admin-only.
router.use("/compensation", requireSessionAuth);

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

// Salary/amount/components are ADMIN-ONLY; bank details are visible to all.
function gateComp(req: Parameters<typeof gateFields>[0], row: HrCompensation): Partial<HrCompensation> {
  return gateFields(req, row, {
    amount: ["admin", "super_admin"],
    components: ["admin", "super_admin"],
  });
}

router.post(
  "/compensation",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { employeeId, currency } = req.body ?? {};
    if (!employeeId || !currency) badRequest("employeeId and currency are required");
    const row = await createCompensation(companyOf(req), actor.userId, req.body);
    res.status(201).json(row);
  }),
);

function isAdmin(req: { sessionActor?: { role?: string | null } }): boolean {
  const role = req.sessionActor?.role;
  return role === "admin" || role === "super_admin";
}

router.get(
  "/compensation",
  asyncHandler(async (req, res) => {
    const company = companyOf(req);
    // Employee callers are scoped to their own linked employee record so they
    // can never read coworkers' compensation or bank details.
    let employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
    if (!isAdmin(req)) {
      const self = await getEmployeeByUserId(company, req.sessionActor!.userId);
      if (!self) {
        res.json([]);
        return;
      }
      employeeId = self.id;
    }
    const rows = await listCompensation(company, employeeId);
    res.json(rows.map((r) => gateComp(req, r)));
  }),
);

router.get(
  "/compensation/:id",
  asyncHandler(async (req, res) => {
    const company = companyOf(req);
    const row = await getCompensation(company, String(req.params.id));
    if (!row) notFound("Compensation not found");
    if (!isAdmin(req)) {
      const self = await getEmployeeByUserId(company, req.sessionActor!.userId);
      if (!self || row.employeeId !== self.id) notFound("Compensation not found");
    }
    res.json(gateComp(req, row));
  }),
);

router.patch(
  "/compensation/:id",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const row = await updateCompensation(companyOf(req), actor.userId, String(req.params.id), req.body);
    if (!row) notFound("Compensation not found");
    res.json(row);
  }),
);

router.delete(
  "/compensation/:id",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const ok = await deleteCompensation(companyOf(req), actor.userId, String(req.params.id));
    if (!ok) notFound("Compensation not found");
    res.status(204).end();
  }),
);

export default router;
