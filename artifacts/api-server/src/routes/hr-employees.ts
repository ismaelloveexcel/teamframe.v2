import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import {
  assign,
  assignmentHistory,
  createEmployee,
  getEmployee,
  invite,
  listEmployees,
  updateEmployee,
} from "../services/hr-employee-service.js";

const router: IRouter = Router();

router.use("/employees", requireSessionAuth, requireRole("admin", "super_admin"));

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

router.post(
  "/employees",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { employeeNo, firstName, lastName } = req.body ?? {};
    if (!employeeNo || !firstName || !lastName) {
      badRequest("employeeNo, firstName and lastName are required");
    }
    const row = await createEmployee(companyOf(req), actor.userId, req.body);
    res.status(201).json(row);
  }),
);

router.get(
  "/employees",
  asyncHandler(async (req, res) => {
    res.json(await listEmployees(companyOf(req)));
  }),
);

router.get(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    const row = await getEmployee(companyOf(req), String(req.params.id));
    if (!row) notFound("Employee not found");
    res.json(row);
  }),
);

router.patch(
  "/employees/:id",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const row = await updateEmployee(companyOf(req), actor.userId, String(req.params.id), req.body);
    if (!row) notFound("Employee not found");
    res.json(row);
  }),
);

router.get(
  "/employees/:id/assignments",
  asyncHandler(async (req, res) => {
    res.json(await assignmentHistory(companyOf(req), String(req.params.id)));
  }),
);

router.post(
  "/employees/:id/assign",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { positionId, startDate } = req.body ?? {};
    if (!positionId || !startDate) badRequest("positionId and startDate are required");
    const row = await assign(companyOf(req), actor.userId, String(req.params.id), positionId, startDate);
    res.status(201).json(row);
  }),
);

router.post(
  "/employees/:id/invite",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const result = await invite(companyOf(req), actor.userId, String(req.params.id));
    if (!result) notFound("Employee not found");
    res.status(201).json(result);
  }),
);

export default router;
