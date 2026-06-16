import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import { getOrgChart } from "../services/hr-orgchart-service.js";

const router: IRouter = Router();

router.use("/orgchart", requireSessionAuth, requireRole("admin", "super_admin", "employee"));

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

router.get(
  "/orgchart",
  asyncHandler(async (req, res) => {
    res.json(await getOrgChart(companyOf(req)));
  }),
);

export default router;
