import { eq } from "drizzle-orm";
import {
  actionStatusEnum,
  actionsTable,
  auditEventsTable,
  db,
  employmentStatusEnum,
  peopleTable,
  personPositionAssignmentsTable,
  policiesTable,
  policyScopeEnum,
  positionsTable,
  positionLifecycleStatusEnum,
  positionOwnershipsTable,
  teamsTable,
  teamOwnershipsTable,
} from "@workspace/db";
import type { ActorContext } from "../lib/request-context";
import { OrganizationAccessControl } from "../access/organization-access";
import { MembershipRepository, OrganizationRepository } from "../persistence/repositories";

const DEMO_IDS = {
  teams: {
    executive: "a1000000-0000-4000-8000-000000000001",
    engineering: "a1000000-0000-4000-8000-000000000002",
    operations: "a1000000-0000-4000-8000-000000000003",
  },
  positions: {
    ceo: "b1000000-0000-4000-8000-000000000001",
    headEngineering: "b1000000-0000-4000-8000-000000000002",
    headOperations: "b1000000-0000-4000-8000-000000000003",
    engineeringManager: "b1000000-0000-4000-8000-000000000004",
    backendEngineer: "b1000000-0000-4000-8000-000000000005",
    operationsSpecialist: "b1000000-0000-4000-8000-000000000006",
  },
  people: {
    ismael: "c1000000-0000-4000-8000-000000000001",
    maria: "c1000000-0000-4000-8000-000000000002",
    ali: "c1000000-0000-4000-8000-000000000003",
    zoya: "c1000000-0000-4000-8000-000000000004",
    ryan: "c1000000-0000-4000-8000-000000000005",
    nora: "c1000000-0000-4000-8000-000000000006",
  },
  assignments: {
    ismael: "c2000000-0000-4000-8000-000000000001",
    maria: "c2000000-0000-4000-8000-000000000002",
    ali: "c2000000-0000-4000-8000-000000000003",
    zoya: "c2000000-0000-4000-8000-000000000004",
    ryan: "c2000000-0000-4000-8000-000000000005",
    nora: "c2000000-0000-4000-8000-000000000006",
  },
  actions: {
    engHandoff: "d1000000-0000-4000-8000-000000000001",
    ownershipGap: "d1000000-0000-4000-8000-000000000002",
    onboardingPack: "d1000000-0000-4000-8000-000000000003",
    policyReview: "d1000000-0000-4000-8000-000000000004",
    closeRole: "d1000000-0000-4000-8000-000000000005",
  },
  policies: {
    operatingRhythm: "e1000000-0000-4000-8000-000000000001",
    incidentOwnership: "e1000000-0000-4000-8000-000000000002",
    opsOnboarding: "e1000000-0000-4000-8000-000000000003",
  },
} as const;

const FIXED_TIMESTAMP = new Date("2026-01-01T00:00:00.000Z");

export class DemoService {
  constructor(private readonly access: OrganizationAccessControl) {}

  async resetOrganization(actor: ActorContext, organizationId: string) {
    await this.access.requireMembership(organizationId, actor.userId, "admin");

    await db.transaction(async (tx) => {
      await tx.delete(auditEventsTable).where(eq(auditEventsTable.organizationId, organizationId));
      await tx.delete(actionsTable).where(eq(actionsTable.organizationId, organizationId));
      await tx.delete(policiesTable).where(eq(policiesTable.organizationId, organizationId));
      await tx
        .delete(teamOwnershipsTable)
        .where(eq(teamOwnershipsTable.organizationId, organizationId));
      await tx
        .delete(positionOwnershipsTable)
        .where(eq(positionOwnershipsTable.organizationId, organizationId));
      await tx
        .delete(personPositionAssignmentsTable)
        .where(eq(personPositionAssignmentsTable.organizationId, organizationId));
      await tx.delete(peopleTable).where(eq(peopleTable.organizationId, organizationId));
      await tx.delete(positionsTable).where(eq(positionsTable.organizationId, organizationId));
      await tx.delete(teamsTable).where(eq(teamsTable.organizationId, organizationId));

      await tx.insert(teamsTable).values([
        {
          id: DEMO_IDS.teams.executive,
          organizationId,
          name: "Executive",
          code: "EXEC",
          parentTeamId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.teams.engineering,
          organizationId,
          name: "Engineering",
          code: "ENG",
          parentTeamId: DEMO_IDS.teams.executive,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.teams.operations,
          organizationId,
          name: "Operations",
          code: "OPS",
          parentTeamId: DEMO_IDS.teams.executive,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);

      await tx.insert(positionsTable).values([
        {
          id: DEMO_IDS.positions.ceo,
          organizationId,
          teamId: DEMO_IDS.teams.executive,
          title: "Chief Executive Officer",
          reportsToPositionId: null,
          lifecycleStatus: positionLifecycleStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.positions.headEngineering,
          organizationId,
          teamId: DEMO_IDS.teams.engineering,
          title: "Head of Engineering",
          reportsToPositionId: DEMO_IDS.positions.ceo,
          lifecycleStatus: positionLifecycleStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.positions.headOperations,
          organizationId,
          teamId: DEMO_IDS.teams.operations,
          title: "Head of Operations",
          reportsToPositionId: DEMO_IDS.positions.ceo,
          lifecycleStatus: positionLifecycleStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.positions.engineeringManager,
          organizationId,
          teamId: DEMO_IDS.teams.engineering,
          title: "Engineering Manager",
          reportsToPositionId: DEMO_IDS.positions.headEngineering,
          lifecycleStatus: positionLifecycleStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.positions.backendEngineer,
          organizationId,
          teamId: DEMO_IDS.teams.engineering,
          title: "Backend Engineer",
          reportsToPositionId: DEMO_IDS.positions.engineeringManager,
          lifecycleStatus: positionLifecycleStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.positions.operationsSpecialist,
          organizationId,
          teamId: DEMO_IDS.teams.operations,
          title: "Operations Specialist",
          reportsToPositionId: DEMO_IDS.positions.headOperations,
          lifecycleStatus: positionLifecycleStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);

      await tx.insert(peopleTable).values([
        {
          id: DEMO_IDS.people.ismael,
          organizationId,
          fullName: "Ismael Sudally",
          email: "ismael@teamframe.demo",
          phone: "+971500000001",
          positionId: null,
          employmentStatus: employmentStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.people.maria,
          organizationId,
          fullName: "Maria Chen",
          email: "maria@teamframe.demo",
          phone: "+971500000002",
          positionId: null,
          employmentStatus: employmentStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.people.ali,
          organizationId,
          fullName: "Ali Farah",
          email: "ali@teamframe.demo",
          phone: "+971500000003",
          positionId: null,
          employmentStatus: employmentStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.people.zoya,
          organizationId,
          fullName: "Zoya Khan",
          email: "zoya@teamframe.demo",
          phone: "+971500000004",
          positionId: null,
          employmentStatus: employmentStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.people.ryan,
          organizationId,
          fullName: "Ryan Thomas",
          email: "ryan@teamframe.demo",
          phone: "+971500000005",
          positionId: null,
          employmentStatus: employmentStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.people.nora,
          organizationId,
          fullName: "Nora Al Mansoori",
          email: "nora@teamframe.demo",
          phone: "+971500000006",
          positionId: null,
          employmentStatus: employmentStatusEnum.enumValues[0],
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);

      await tx.insert(personPositionAssignmentsTable).values([
        {
          id: DEMO_IDS.assignments.ismael,
          organizationId,
          personId: DEMO_IDS.people.ismael,
          positionId: DEMO_IDS.positions.ceo,
          startedAt: FIXED_TIMESTAMP,
          endedAt: null,
          status: "active",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.assignments.maria,
          organizationId,
          personId: DEMO_IDS.people.maria,
          positionId: DEMO_IDS.positions.headEngineering,
          startedAt: FIXED_TIMESTAMP,
          endedAt: null,
          status: "active",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.assignments.ali,
          organizationId,
          personId: DEMO_IDS.people.ali,
          positionId: DEMO_IDS.positions.headOperations,
          startedAt: FIXED_TIMESTAMP,
          endedAt: null,
          status: "active",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.assignments.zoya,
          organizationId,
          personId: DEMO_IDS.people.zoya,
          positionId: DEMO_IDS.positions.engineeringManager,
          startedAt: FIXED_TIMESTAMP,
          endedAt: null,
          status: "active",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.assignments.ryan,
          organizationId,
          personId: DEMO_IDS.people.ryan,
          positionId: DEMO_IDS.positions.backendEngineer,
          startedAt: FIXED_TIMESTAMP,
          endedAt: null,
          status: "active",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.assignments.nora,
          organizationId,
          personId: DEMO_IDS.people.nora,
          positionId: DEMO_IDS.positions.operationsSpecialist,
          startedAt: FIXED_TIMESTAMP,
          endedAt: null,
          status: "active",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);

      await tx.insert(teamOwnershipsTable).values([
        {
          organizationId,
          teamId: DEMO_IDS.teams.engineering,
          ownerPersonId: DEMO_IDS.people.maria,
          ownerPositionId: null,
          responsibilityContext: "Engineering delivery and quality",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          organizationId,
          teamId: DEMO_IDS.teams.operations,
          ownerPersonId: DEMO_IDS.people.ali,
          ownerPositionId: null,
          responsibilityContext: "Operational continuity and onboarding",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);

      await tx.insert(positionOwnershipsTable).values([
        {
          organizationId,
          positionId: DEMO_IDS.positions.engineeringManager,
          ownerPersonId: DEMO_IDS.people.zoya,
          ownerPositionId: null,
          responsibilityContext: "Weekly execution cadence",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          organizationId,
          positionId: DEMO_IDS.positions.operationsSpecialist,
          ownerPersonId: DEMO_IDS.people.nora,
          ownerPositionId: null,
          responsibilityContext: "Operational onboarding checklist",
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);

      await tx.insert(actionsTable).values([
        {
          id: DEMO_IDS.actions.engHandoff,
          organizationId,
          title: "Confirm engineering handoff owner for release train",
          description: "Resolve ambiguity between manager and tech lead ownership.",
          status: actionStatusEnum.enumValues[0],
          dueDate: "2026-01-12",
          blocked: false,
          ownerPersonId: DEMO_IDS.people.zoya,
          ownerPositionId: null,
          teamId: DEMO_IDS.teams.engineering,
          positionId: null,
          personId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.actions.ownershipGap,
          organizationId,
          title: "Assign owner for incident response runbook",
          description: "Incident page has no named accountable owner.",
          status: actionStatusEnum.enumValues[1],
          dueDate: "2026-01-09",
          blocked: true,
          ownerPersonId: DEMO_IDS.people.maria,
          ownerPositionId: null,
          teamId: DEMO_IDS.teams.engineering,
          positionId: null,
          personId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.actions.onboardingPack,
          organizationId,
          title: "Complete operations onboarding packet",
          description: "New operations hire requires role clarity context.",
          status: actionStatusEnum.enumValues[0],
          dueDate: "2026-01-15",
          blocked: false,
          ownerPersonId: DEMO_IDS.people.nora,
          ownerPositionId: null,
          teamId: null,
          positionId: null,
          personId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.actions.policyReview,
          organizationId,
          title: "Review policy ownership with COO",
          description: "Ensure each team policy has explicit accountability.",
          status: actionStatusEnum.enumValues[2],
          dueDate: "2026-01-04",
          blocked: false,
          ownerPersonId: DEMO_IDS.people.ali,
          ownerPositionId: null,
          teamId: DEMO_IDS.teams.operations,
          positionId: null,
          personId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.actions.closeRole,
          organizationId,
          title: "Resolve blocked backend ownership escalation",
          description: "Escalation pending final owner confirmation.",
          status: actionStatusEnum.enumValues[1],
          dueDate: "2026-01-11",
          blocked: true,
          ownerPersonId: DEMO_IDS.people.ryan,
          ownerPositionId: null,
          teamId: null,
          positionId: null,
          personId: DEMO_IDS.people.ryan,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);

      await tx.insert(policiesTable).values([
        {
          id: DEMO_IDS.policies.operatingRhythm,
          organizationId,
          title: "Operating Rhythm Policy",
          body: "Weekly ownership review every Monday at 09:00.",
          scope: policyScopeEnum.enumValues[0],
          teamId: null,
          positionId: null,
          ownerPersonId: DEMO_IDS.people.ismael,
          ownerPositionId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.policies.incidentOwnership,
          organizationId,
          title: "Incident Ownership Protocol",
          body: "Engineering manager is accountable for incident escalation routing.",
          scope: policyScopeEnum.enumValues[1],
          teamId: DEMO_IDS.teams.engineering,
          positionId: null,
          ownerPersonId: DEMO_IDS.people.maria,
          ownerPositionId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
        {
          id: DEMO_IDS.policies.opsOnboarding,
          organizationId,
          title: "Operations Onboarding Checklist",
          body: "Operations specialist must complete ownership map walkthrough in week one.",
          scope: policyScopeEnum.enumValues[2],
          teamId: null,
          positionId: null,
          ownerPersonId: DEMO_IDS.people.ali,
          ownerPositionId: null,
          createdAt: FIXED_TIMESTAMP,
          updatedAt: FIXED_TIMESTAMP,
        },
      ]);
    });

    return {
      organizationId,
      teams: 3,
      positions: 6,
      people: 6,
      actions: 5,
      policies: 3,
    };
  }
}

export function buildDemoService() {
  const organizations = new OrganizationRepository();
  const memberships = new MembershipRepository();
  const access = new OrganizationAccessControl(organizations, memberships);
  return new DemoService(access);
}
