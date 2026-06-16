import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import {
  createOffboarding,
  getOffboarding,
  listOffboarding,
  previewOffboarding,
} from "../services/hr-offboarding-service.js";

const router: IRouter = Router();

router.use("/offboarding", requireSessionAuth, requireRole("admin", "super_admin"));

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

// Preview gratuity without persisting — routed through the company's
// compliance provider (UAE -> EOSG numbers identical to before; generic ->
// { gratuityAmount: null, calculationMethod: "manual" }).
router.post(
  "/offboarding/preview",
  asyncHandler(async (req, res) => {
    const { basicMonthlyPay, joinDate, exitDate } = req.body ?? {};
    if (basicMonthlyPay == null || !joinDate || !exitDate) {
      badRequest("basicMonthlyPay, joinDate and exitDate are required");
    }
    res.json(await previewOffboarding(companyOf(req), { basicMonthlyPay, joinDate, exitDate }));
  }),
);

router.post(
  "/offboarding",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { employeeId, exitDate, eosg } = req.body ?? {};
    if (!employeeId || !exitDate || !eosg) {
      badRequest("employeeId, exitDate and eosg{basicMonthlyPay,joinDate,exitDate} are required");
    }
    const row = await createOffboarding(companyOf(req), actor.userId, req.body);
    res.status(201).json(row);
  }),
);

router.get(
  "/offboarding",
  asyncHandler(async (req, res) => {
    res.json(await listOffboarding(companyOf(req)));
  }),
);

router.get(
  "/offboarding/:id",
  asyncHandler(async (req, res) => {
    const row = await getOffboarding(companyOf(req), String(req.params.id));
    if (!row) notFound("Offboarding record not found");
    res.json(row);
  }),
);

export default router;
