import { Router, type IRouter } from "express";
import { OrganizationAccessControl } from "../access/organization-access";
import { asyncHandler } from "../lib/async-handler";
import { badRequest, unauthorized } from "../lib/http-error";
import type { ActorContext } from "../lib/request-context";
import { MembershipRepository, OrganizationRepository } from "../persistence/repositories";
import { buildOperationalMetricsService } from "../services/operational-metrics-service";
import { buildOutboxReliabilityService } from "../services/outbox-reliability-service";
import { buildProjectionIntegrityService } from "../services/projection-integrity-service";
import { buildQuarantineService } from "../services/quarantine-service";
import { buildReplayService } from "../services/replay-service";

function actorFromReq(req: { actor?: ActorContext }): ActorContext {
  if (!req.actor) {
    unauthorized("Missing request actor context");
  }
  return req.actor;
}

function parseOrganizationId(params: Record<string, unknown>): string {
  const raw = params.organizationId;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    badRequest("organizationId is required");
  }
  return raw;
}

const access = new OrganizationAccessControl(new OrganizationRepository(), new MembershipRepository());
const replay = buildReplayService();
const quarantine = buildQuarantineService();
const outbox = buildOutboxReliabilityService();
const projections = buildProjectionIntegrityService();
const metrics = buildOperationalMetricsService();

const router: IRouter = Router();

router.get(
  "/ops/:organizationId/replay/compare",
  asyncHandler(async (req, res) => {
    const actor = actorFromReq(req);
    const organizationId = parseOrganizationId(req.params as Record<string, unknown>);
    await access.requireMembership(organizationId, actor.userId, "admin");
    const result = await replay.compareReplayWithLive(organizationId);
    res.json(result);
  }),
);

router.post(
  "/ops/:organizationId/quarantine/detect",
  asyncHandler(async (req, res) => {
    const actor = actorFromReq(req);
    const organizationId = parseOrganizationId(req.params as Record<string, unknown>);
    await access.requireMembership(organizationId, actor.userId, "admin");
    const result = await quarantine.detectAndQuarantine(organizationId, actor.userId);
    res.json(result);
  }),
);

router.post(
  "/ops/:organizationId/quarantine/recover",
  asyncHandler(async (req, res) => {
    const actor = actorFromReq(req);
    const organizationId = parseOrganizationId(req.params as Record<string, unknown>);
    await access.requireMembership(organizationId, actor.userId, "admin");
    const body = req.body as Record<string, unknown>;
    if (typeof body.aggregateType !== "string" || typeof body.aggregateId !== "string") {
      badRequest("aggregateType and aggregateId are required");
    }
    const repairMode = body.repairMode === "none" ? "none" : "schema_adapter";
    const result = await quarantine.recoverStream({
      organizationId,
      actorUserId: actor.userId,
      aggregateType: body.aggregateType as
        | "position"
        | "assignment"
        | "document"
        | "compensation"
        | "offboarding"
        | "employee"
        | "system",
      aggregateId: body.aggregateId,
      repairMode,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    res.json(result);
  }),
);

router.post(
  "/ops/:organizationId/outbox/process",
  asyncHandler(async (req, res) => {
    const actor = actorFromReq(req);
    const organizationId = parseOrganizationId(req.params as Record<string, unknown>);
    await access.requireMembership(organizationId, actor.userId, "admin");
    const body = req.body as Record<string, unknown>;
    const consumerKey =
      typeof body.consumerKey === "string" && body.consumerKey.trim().length > 0
        ? body.consumerKey
        : "ops-diagnostic-consumer";
    const stats = await outbox.processDueEvents({
      consumerKey,
      maxBatchSize: typeof body.maxBatchSize === "number" ? body.maxBatchSize : undefined,
      maxAttempts: typeof body.maxAttempts === "number" ? body.maxAttempts : undefined,
      handler: async () => {},
    });
    const health = await outbox.getHealth(organizationId);
    res.json({ stats, health });
  }),
);

router.post(
  "/ops/:organizationId/projections/check",
  asyncHandler(async (req, res) => {
    const actor = actorFromReq(req);
    const organizationId = parseOrganizationId(req.params as Record<string, unknown>);
    await access.requireMembership(organizationId, actor.userId, "admin");
    const body = req.body as Record<string, unknown>;
    const result = await projections.checkAndRepair({
      organizationId,
      autoRepair: body.autoRepair === true,
    });
    res.json(result);
  }),
);

router.get(
  "/ops/:organizationId/metrics",
  asyncHandler(async (req, res) => {
    const actor = actorFromReq(req);
    const organizationId = parseOrganizationId(req.params as Record<string, unknown>);
    await access.requireMembership(organizationId, actor.userId, "member");
    const snapshot = await metrics.getMetrics(organizationId);
    res.json(snapshot);
  }),
);

export default router;
