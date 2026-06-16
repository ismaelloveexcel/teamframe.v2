import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizationsRouter from "./organizations";
import opsRouter from "./ops";
import authRouter from "./auth";
import { requireActorContext } from "../middlewares/actor-context";

const router: IRouter = Router();

// Auth routes (no actor context required — they establish identity)
router.use(healthRouter);
router.use(authRouter);

// Legacy routes (header-trusted actor context for backward compat)
router.use(requireActorContext);
router.use(organizationsRouter);
router.use(opsRouter);

export default router;
