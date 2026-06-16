import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizationsRouter from "./organizations";
import opsRouter from "./ops";
import authRouter from "./auth";
import hrPositionsRouter from "./hr-positions";
import hrEmployeesRouter from "./hr-employees";
import hrOrgchartRouter from "./hr-orgchart";
import hrCompensationRouter from "./hr-compensation";
import hrLeaveRouter from "./hr-leave";
import hrPolicyRouter from "./hr-policy";
import hrDocumentRouter from "./hr-document";
import hrOffboardingRouter from "./hr-offboarding";
import { requireActorContext } from "../middlewares/actor-context";

const router: IRouter = Router();

// Auth routes (no actor context required — they establish identity)
router.use(healthRouter);
router.use(authRouter);

// HR v2 routes (session-authed + role-gated internally)
router.use(hrPositionsRouter);
router.use(hrEmployeesRouter);
router.use(hrOrgchartRouter);
router.use(hrCompensationRouter);
router.use(hrLeaveRouter);
router.use(hrPolicyRouter);
router.use(hrDocumentRouter);
router.use(hrOffboardingRouter);

// Legacy routes (header-trusted actor context for backward compat)
router.use(requireActorContext);
router.use(organizationsRouter);
router.use(opsRouter);

export default router;
