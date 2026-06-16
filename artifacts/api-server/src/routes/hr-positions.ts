import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import {
  createPosition,
  getHierarchy,
  getPosition,
  listPositions,
  updatePosition,
} from "../services/hr-position-service.js";

const router: IRouter = Router();

// Admin-only. Every route is session-authed and role-gated.
router.use("/positions", requireSessionAuth, requireRole("admin", "super_admin"));

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

router.post(
  "/positions",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    if (!req.body?.title) badRequest("title is required");
    const row = await createPosition(companyOf(req), actor.userId, req.body);
    res.status(201).json(row);
  }),
);

router.get(
  "/positions/hierarchy",
  asyncHandler(async (req, res) => {
    res.json(await getHierarchy(companyOf(req)));
  }),
);

router.get(
  "/positions",
  asyncHandler(async (req, res) => {
    res.json(await listPositions(companyOf(req)));
  }),
);

router.get(
  "/positions/:id",
  asyncHandler(async (req, res) => {
    const row = await getPosition(companyOf(req), String(req.params.id));
    if (!row) notFound("Position not found");
    res.json(row);
  }),
);

router.patch(
  "/positions/:id",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const row = await updatePosition(companyOf(req), actor.userId, String(req.params.id), req.body);
    if (!row) notFound("Position not found");
    res.json(row);
  }),
);

export default router;
