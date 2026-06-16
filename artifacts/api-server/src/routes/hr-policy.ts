import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import {
  acknowledgePolicy,
  createPolicy,
  getPolicy,
  listAcknowledgements,
  listPolicies,
  updatePolicy,
} from "../services/hr-policy-service.js";

const router: IRouter = Router();

router.use("/policies", requireSessionAuth);

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

router.post(
  "/policies",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { title, body } = req.body ?? {};
    if (!title || !body) badRequest("title and body are required");
    const row = await createPolicy(companyOf(req), actor.userId, req.body);
    res.status(201).json(row);
  }),
);

router.get(
  "/policies",
  asyncHandler(async (req, res) => {
    res.json(await listPolicies(companyOf(req)));
  }),
);

router.get(
  "/policies/:id",
  asyncHandler(async (req, res) => {
    const row = await getPolicy(companyOf(req), String(req.params.id));
    if (!row) notFound("Policy not found");
    res.json(row);
  }),
);

router.patch(
  "/policies/:id",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const row = await updatePolicy(companyOf(req), actor.userId, String(req.params.id), req.body);
    if (!row) notFound("Policy not found");
    res.json(row);
  }),
);

// Record an acknowledgement (any authed role acks for an employee).
router.post(
  "/policies/:id/acknowledge",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { employeeId } = req.body ?? {};
    if (!employeeId) badRequest("employeeId is required");
    const row = await acknowledgePolicy(companyOf(req), actor.userId, String(req.params.id), employeeId);
    if (!row) notFound("Policy not found");
    res.status(201).json(row);
  }),
);

router.get(
  "/policies/:id/acknowledgements",
  requireRole("admin", "super_admin"),
  asyncHandler(async (req, res) => {
    res.json(await listAcknowledgements(companyOf(req), String(req.params.id)));
  }),
);

export default router;
