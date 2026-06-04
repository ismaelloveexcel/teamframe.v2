import { Router, type IRouter } from "express";
import {
  AssignPositionOwnershipBody,
  AssignPositionOwnershipParams,
  AssignPositionOwnershipResponse,
  AssignTeamOwnershipBody,
  AssignTeamOwnershipParams,
  AssignTeamOwnershipResponse,
  AttachPolicyScopeBody,
  AttachPolicyScopeParams,
  AttachPolicyScopeResponse,
  CreateActionBody,
  CreateActionParams,
  CreateOrganizationBody,
  CreatePersonBody,
  CreatePersonParams,
  CreatePolicyBody,
  CreatePolicyParams,
  CreatePositionBody,
  CreatePositionParams,
  CreateTeamBody,
  CreateTeamParams,
  GetActionParams,
  GetActionResponse,
  GetOrganizationParams,
  GetOrganizationResponse,
  GetPersonParams,
  GetPersonResponse,
  GetPolicyParams,
  GetPolicyResponse,
  GetPositionParams,
  GetPositionResponse,
  GetTeamParams,
  GetTeamResponse,
  ListActionsParams,
  ListActionsResponse,
  ListOrganizationsResponse,
  ListPositionOwnershipsParams,
  ListPositionOwnershipsResponse,
  ListTeamOwnershipsParams,
  ListTeamOwnershipsResponse,
  ResetOrganizationDemoStateParams,
  ResetOrganizationDemoStateResponse,
  ListPeopleParams,
  ListPeopleResponse,
  ListPoliciesParams,
  ListPoliciesResponse,
  ListPositionsParams,
  ListPositionsResponse,
  ListTeamsParams,
  ListTeamsResponse,
  TransitionActionStatusBody,
  TransitionActionStatusParams,
  TransitionActionStatusResponse,
  UpdateActionDetailsBody,
  UpdateActionDetailsParams,
  UpdateActionDetailsResponse,
  UpdatePersonBody,
  UpdatePersonParams,
  UpdatePersonResponse,
  UpdatePolicyDetailsBody,
  UpdatePolicyDetailsParams,
  UpdatePolicyDetailsResponse,
  UpdatePositionBody,
  UpdatePositionParams,
  UpdatePositionResponse,
  UpdateTeamBody,
  UpdateTeamParams,
  UpdateTeamResponse,
} from "@workspace/api-zod";
import type { ActorContext } from "../lib/request-context";
import { asyncHandler } from "../lib/async-handler";
import { unauthorized } from "../lib/http-error";
import { buildOrganizationService } from "../services/organization-service";
import { buildTeamService } from "../services/team-service";
import { buildPositionService } from "../services/position-service";
import { buildPeopleService } from "../services/people-service";
import { buildActionService } from "../services/action-service";
import { buildPolicyService } from "../services/policy-service";
import { buildOwnershipService } from "../services/ownership-service";
import { buildDemoService } from "../services/demo-service";

const organizations = buildOrganizationService();
const teams = buildTeamService();
const positions = buildPositionService();
const people = buildPeopleService();
const actions = buildActionService();
const policies = buildPolicyService();
const ownership = buildOwnershipService();
const demo = buildDemoService();

function actorFromReq(req: { actor?: ActorContext }): ActorContext {
  if (!req.actor) {
    unauthorized("Missing request actor context");
  }
  return req.actor;
}

const router: IRouter = Router();

router.get(
  "/organizations",
  asyncHandler(async (req, res) => {
    const items = await organizations.list(actorFromReq(req));
    res.json(ListOrganizationsResponse.parse({ items }));
  }),
);

router.post(
  "/organizations",
  asyncHandler(async (req, res) => {
    const body = CreateOrganizationBody.parse(req.body);
    const created = await organizations.create(actorFromReq(req), body);
    res.status(201).json(GetOrganizationResponse.parse(created));
  }),
);

router.get(
  "/organizations/:organizationId",
  asyncHandler(async (req, res) => {
    const params = GetOrganizationParams.parse(req.params);
    const organization = await organizations.get(actorFromReq(req), params.organizationId);
    res.json(GetOrganizationResponse.parse(organization));
  }),
);

router.post(
  "/organizations/:organizationId/demo/reset",
  asyncHandler(async (req, res) => {
    const params = ResetOrganizationDemoStateParams.parse(req.params);
    const result = await demo.resetOrganization(actorFromReq(req), params.organizationId);
    res.json(ResetOrganizationDemoStateResponse.parse(result));
  }),
);

router.get(
  "/organizations/:organizationId/teams",
  asyncHandler(async (req, res) => {
    const params = ListTeamsParams.parse(req.params);
    const items = await teams.list(actorFromReq(req), params.organizationId);
    res.json(ListTeamsResponse.parse({ items }));
  }),
);

router.post(
  "/organizations/:organizationId/teams",
  asyncHandler(async (req, res) => {
    const params = CreateTeamParams.parse(req.params);
    const body = CreateTeamBody.parse(req.body);
    const created = await teams.create(actorFromReq(req), params.organizationId, body);
    res.status(201).json(GetTeamResponse.parse(created));
  }),
);

router.get(
  "/organizations/:organizationId/teams/:teamId",
  asyncHandler(async (req, res) => {
    const params = GetTeamParams.parse(req.params);
    const team = await teams.get(actorFromReq(req), params.organizationId, params.teamId);
    res.json(GetTeamResponse.parse(team));
  }),
);

router.patch(
  "/organizations/:organizationId/teams/:teamId",
  asyncHandler(async (req, res) => {
    const params = UpdateTeamParams.parse(req.params);
    const body = UpdateTeamBody.parse(req.body);
    const updated = await teams.update(actorFromReq(req), params.organizationId, params.teamId, body);
    res.json(UpdateTeamResponse.parse(updated));
  }),
);

router.delete(
  "/organizations/:organizationId/teams/:teamId",
  asyncHandler(async (req, res) => {
    const params = GetTeamParams.parse(req.params);
    await teams.delete(actorFromReq(req), params.organizationId, params.teamId);
    res.status(204).send();
  }),
);

router.put(
  "/organizations/:organizationId/teams/:teamId/ownership",
  asyncHandler(async (req, res) => {
    const params = AssignTeamOwnershipParams.parse(req.params);
    const body = AssignTeamOwnershipBody.parse(req.body);
    const ownership = await teams.assignOwnership(actorFromReq(req), params.organizationId, params.teamId, {
      ownerPersonId: body.ownerPersonId ?? null,
      ownerPositionId: body.ownerPositionId ?? null,
      responsibilityContext: body.responsibilityContext,
    });
    res.json(AssignTeamOwnershipResponse.parse(ownership));
  }),
);

router.get(
  "/organizations/:organizationId/positions",
  asyncHandler(async (req, res) => {
    const params = ListPositionsParams.parse(req.params);
    const items = await positions.list(actorFromReq(req), params.organizationId);
    res.json(ListPositionsResponse.parse({ items }));
  }),
);

router.post(
  "/organizations/:organizationId/positions",
  asyncHandler(async (req, res) => {
    const params = CreatePositionParams.parse(req.params);
    const body = CreatePositionBody.parse(req.body);
    const created = await positions.create(actorFromReq(req), params.organizationId, {
      teamId: body.teamId,
      title: body.title,
      reportsToPositionId: body.reportsToPositionId,
      lifecycleStatus: body.lifecycleStatus,
    });
    res.status(201).json(GetPositionResponse.parse(created));
  }),
);

router.get(
  "/organizations/:organizationId/positions/:positionId",
  asyncHandler(async (req, res) => {
    const params = GetPositionParams.parse(req.params);
    const position = await positions.get(actorFromReq(req), params.organizationId, params.positionId);
    res.json(GetPositionResponse.parse(position));
  }),
);

router.patch(
  "/organizations/:organizationId/positions/:positionId",
  asyncHandler(async (req, res) => {
    const params = UpdatePositionParams.parse(req.params);
    const body = UpdatePositionBody.parse(req.body);
    const updated = await positions.update(
      actorFromReq(req),
      params.organizationId,
      params.positionId,
      body,
    );
    res.json(UpdatePositionResponse.parse(updated));
  }),
);

router.delete(
  "/organizations/:organizationId/positions/:positionId",
  asyncHandler(async (req, res) => {
    const params = GetPositionParams.parse(req.params);
    await positions.delete(actorFromReq(req), params.organizationId, params.positionId);
    res.status(204).send();
  }),
);

router.put(
  "/organizations/:organizationId/positions/:positionId/ownership",
  asyncHandler(async (req, res) => {
    const params = AssignPositionOwnershipParams.parse(req.params);
    const body = AssignPositionOwnershipBody.parse(req.body);
    const ownership = await positions.assignOwnership(
      actorFromReq(req),
      params.organizationId,
      params.positionId,
      {
        ownerPersonId: body.ownerPersonId ?? null,
        ownerPositionId: body.ownerPositionId ?? null,
        responsibilityContext: body.responsibilityContext,
      },
    );
    res.json(AssignPositionOwnershipResponse.parse(ownership));
  }),
);

router.get(
  "/organizations/:organizationId/ownership/teams",
  asyncHandler(async (req, res) => {
    const params = ListTeamOwnershipsParams.parse(req.params);
    const items = await ownership.listTeamOwnerships(actorFromReq(req), params.organizationId);
    res.json(ListTeamOwnershipsResponse.parse({ items }));
  }),
);

router.get(
  "/organizations/:organizationId/ownership/positions",
  asyncHandler(async (req, res) => {
    const params = ListPositionOwnershipsParams.parse(req.params);
    const items = await ownership.listPositionOwnerships(actorFromReq(req), params.organizationId);
    res.json(ListPositionOwnershipsResponse.parse({ items }));
  }),
);

router.get(
  "/organizations/:organizationId/people",
  asyncHandler(async (req, res) => {
    const params = ListPeopleParams.parse(req.params);
    const items = await people.list(actorFromReq(req), params.organizationId);
    res.json(ListPeopleResponse.parse({ items }));
  }),
);

router.post(
  "/organizations/:organizationId/people",
  asyncHandler(async (req, res) => {
    const params = CreatePersonParams.parse(req.params);
    const body = CreatePersonBody.parse(req.body);
    const created = await people.create(actorFromReq(req), params.organizationId, body);
    res.status(201).json(GetPersonResponse.parse(created));
  }),
);

router.get(
  "/organizations/:organizationId/people/:personId",
  asyncHandler(async (req, res) => {
    const params = GetPersonParams.parse(req.params);
    const person = await people.get(actorFromReq(req), params.organizationId, params.personId);
    res.json(GetPersonResponse.parse(person));
  }),
);

router.patch(
  "/organizations/:organizationId/people/:personId",
  asyncHandler(async (req, res) => {
    const params = UpdatePersonParams.parse(req.params);
    const body = UpdatePersonBody.parse(req.body);
    const updated = await people.update(actorFromReq(req), params.organizationId, params.personId, body);
    res.json(UpdatePersonResponse.parse(updated));
  }),
);

router.delete(
  "/organizations/:organizationId/people/:personId",
  asyncHandler(async (req, res) => {
    const params = GetPersonParams.parse(req.params);
    await people.delete(actorFromReq(req), params.organizationId, params.personId);
    res.status(204).send();
  }),
);

router.get(
  "/organizations/:organizationId/actions",
  asyncHandler(async (req, res) => {
    const params = ListActionsParams.parse(req.params);
    const items = await actions.list(actorFromReq(req), params.organizationId);
    res.json(ListActionsResponse.parse({ items }));
  }),
);

router.post(
  "/organizations/:organizationId/actions",
  asyncHandler(async (req, res) => {
    const params = CreateActionParams.parse(req.params);
    const body = CreateActionBody.parse(req.body);
    const created = await actions.create(actorFromReq(req), params.organizationId, {
      title: body.title,
      description: body.description,
      dueDate: body.dueDate,
      blocked: body.blocked,
      owner: {
        ownerPersonId: body.owner.ownerPersonId ?? null,
        ownerPositionId: body.owner.ownerPositionId ?? null,
        responsibilityContext: "",
      },
      link: {
        teamId: body.link.teamId ?? null,
        positionId: body.link.positionId ?? null,
        personId: body.link.personId ?? null,
      },
    });
    res.status(201).json(GetActionResponse.parse(created));
  }),
);

router.get(
  "/organizations/:organizationId/actions/:actionId",
  asyncHandler(async (req, res) => {
    const params = GetActionParams.parse(req.params);
    const action = await actions.get(actorFromReq(req), params.organizationId, params.actionId);
    res.json(GetActionResponse.parse(action));
  }),
);

router.patch(
  "/organizations/:organizationId/actions/:actionId/details",
  asyncHandler(async (req, res) => {
    const params = UpdateActionDetailsParams.parse(req.params);
    const body = UpdateActionDetailsBody.parse(req.body);
    const updated = await actions.updateDetails(
      actorFromReq(req),
      params.organizationId,
      params.actionId,
      {
        title: body.title,
        description: body.description ?? undefined,
        dueDate: body.dueDate ?? undefined,
        blocked: body.blocked,
        owner: body.owner
          ? {
              ownerPersonId: body.owner.ownerPersonId ?? null,
              ownerPositionId: body.owner.ownerPositionId ?? null,
              responsibilityContext: "",
            }
          : undefined,
        link: body.link
          ? {
              teamId: body.link.teamId ?? null,
              positionId: body.link.positionId ?? null,
              personId: body.link.personId ?? null,
            }
          : undefined,
      },
    );
    res.json(UpdateActionDetailsResponse.parse(updated));
  }),
);

router.patch(
  "/organizations/:organizationId/actions/:actionId/status",
  asyncHandler(async (req, res) => {
    const params = TransitionActionStatusParams.parse(req.params);
    const body = TransitionActionStatusBody.parse(req.body);
    const updated = await actions.transitionStatus(
      actorFromReq(req),
      params.organizationId,
      params.actionId,
      body.status,
    );
    res.json(TransitionActionStatusResponse.parse(updated));
  }),
);

router.delete(
  "/organizations/:organizationId/actions/:actionId",
  asyncHandler(async (req, res) => {
    const params = GetActionParams.parse(req.params);
    await actions.delete(actorFromReq(req), params.organizationId, params.actionId);
    res.status(204).send();
  }),
);

router.get(
  "/organizations/:organizationId/policies",
  asyncHandler(async (req, res) => {
    const params = ListPoliciesParams.parse(req.params);
    const items = await policies.list(actorFromReq(req), params.organizationId);
    res.json(ListPoliciesResponse.parse({ items }));
  }),
);

router.post(
  "/organizations/:organizationId/policies",
  asyncHandler(async (req, res) => {
    const params = CreatePolicyParams.parse(req.params);
    const body = CreatePolicyBody.parse(req.body);
    const created = await policies.create(actorFromReq(req), params.organizationId, {
      title: body.title,
      body: body.body,
      scope: body.scope,
      teamId: body.teamId,
      positionId: body.positionId,
      owner: {
        ownerPersonId: body.owner.ownerPersonId ?? null,
        ownerPositionId: body.owner.ownerPositionId ?? null,
        responsibilityContext: "",
      },
    });
    res.status(201).json(GetPolicyResponse.parse(created));
  }),
);

router.get(
  "/organizations/:organizationId/policies/:policyId",
  asyncHandler(async (req, res) => {
    const params = GetPolicyParams.parse(req.params);
    const policy = await policies.get(actorFromReq(req), params.organizationId, params.policyId);
    res.json(GetPolicyResponse.parse(policy));
  }),
);

router.patch(
  "/organizations/:organizationId/policies/:policyId/details",
  asyncHandler(async (req, res) => {
    const params = UpdatePolicyDetailsParams.parse(req.params);
    const body = UpdatePolicyDetailsBody.parse(req.body);
    const updated = await policies.updateDetails(
      actorFromReq(req),
      params.organizationId,
      params.policyId,
      {
        title: body.title,
        body: body.body,
        owner: body.owner
          ? {
              ownerPersonId: body.owner.ownerPersonId ?? null,
              ownerPositionId: body.owner.ownerPositionId ?? null,
              responsibilityContext: "",
            }
          : undefined,
      },
    );
    res.json(UpdatePolicyDetailsResponse.parse(updated));
  }),
);

router.put(
  "/organizations/:organizationId/policies/:policyId/scope",
  asyncHandler(async (req, res) => {
    const params = AttachPolicyScopeParams.parse(req.params);
    const body = AttachPolicyScopeBody.parse(req.body);
    const updated = await policies.attachScope(
      actorFromReq(req),
      params.organizationId,
      params.policyId,
      {
        scope: body.scope,
        teamId: body.teamId ?? null,
        positionId: body.positionId ?? null,
      },
    );
    res.json(AttachPolicyScopeResponse.parse(updated));
  }),
);

router.delete(
  "/organizations/:organizationId/policies/:policyId",
  asyncHandler(async (req, res) => {
    const params = GetPolicyParams.parse(req.params);
    await policies.delete(actorFromReq(req), params.organizationId, params.policyId);
    res.status(204).send();
  }),
);

export default router;
