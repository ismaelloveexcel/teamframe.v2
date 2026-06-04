import { Router, type IRouter } from "express";
import healthRouter from "./health";
import organizationsRouter from "./organizations";
import { requireActorContext } from "../middlewares/actor-context";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requireActorContext);
router.use(organizationsRouter);

export default router;
