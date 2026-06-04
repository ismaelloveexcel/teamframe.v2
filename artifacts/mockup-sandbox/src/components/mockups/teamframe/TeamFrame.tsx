import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  ActionStatus,
  EmploymentStatus,
  PolicyScope,
  PositionLifecycleStatus,
  assignPositionOwnership,
  assignTeamOwnership,
  attachPolicyScope,
  createAction,
  createOrganization,
  createPerson,
  createPolicy,
  createPosition,
  createTeam,
  deleteAction,
  deletePerson,
  deletePolicy,
  deletePosition,
  deleteTeam,
  listActions,
  listOrganizations,
  listPeople,
  listPolicies,
  listPositionOwnerships,
  listPositions,
  listTeamOwnerships,
  listTeams,
  resetOrganizationDemoState,
  setBaseUrl,
  transitionActionStatus,
  type Action,
  type Person,
  type Policy,
  type Position,
  type PositionOwnership,
  type Team,
  type TeamOwnership,
} from "@workspace/api-client-react";

type NavId = "org" | "actions" | "team" | "policies" | "administration";
type OwnerType = "person" | "position";
type LinkType = "team" | "position" | "person";

const NAV_ITEMS: Array<{ id: NavId; label: string }> = [
  { id: "org", label: "Org Map" },
  { id: "actions", label: "Actions" },
  { id: "team", label: "Team" },
  { id: "policies", label: "Policies" },
  { id: "administration", label: "Administration" },
];

const ACTOR = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "operator@teamframe.local",
  name: "TeamFrame Operator",
};

const STYLE = {
  page: {
    minHeight: "100vh",
    background: "#F7F9FC",
    color: "#0F172A",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  } as const,
  shell: {
    maxWidth: 1400,
    margin: "0 auto",
    padding: 20,
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: 16,
  } as const,
  sidebar: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 12,
    height: "fit-content",
  } as const,
  panel: {
    background: "#FFFFFF",
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    padding: 14,
  } as const,
  title: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 10,
  } as const,
  subTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    color: "#64748B",
    letterSpacing: "0.06em",
    fontWeight: 700,
    marginBottom: 8,
  } as const,
};

function formatDateLabel(input: string | null | undefined): string {
  if (!input) return "-";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toISOString().slice(0, 10);
}

function defaultOrgSlug(): string {
  return `teamframe-v1-${Date.now()}`;
}

const API_TIMEOUT_MS = 10_000;
const API_MAX_RETRIES = 1;

function requestOptions(): RequestInit {
  return {
    headers: {
      "x-user-id": ACTOR.userId,
      "x-user-email": ACTOR.email,
      "x-user-name": ACTOR.name,
    },
  };
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500;
  return error instanceof DOMException && error.name === "AbortError";
}

function errorStatus(error: unknown): number | null {
  if (error instanceof ApiError) return error.status;
  if (error && typeof error === "object" && "cause" in error) {
    return errorStatus((error as { cause?: unknown }).cause);
  }
  return null;
}

function describeError(label: string, error: unknown): string {
  if (error instanceof ApiError) {
    return `${label} failed (${error.status}): ${error.message}`;
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return `${label} timed out after ${API_TIMEOUT_MS / 1000}s`;
  }
  if (error instanceof Error) {
    return `${label} failed: ${error.message}`;
  }
  return `${label} failed`;
}

type LocalDemoState = {
  organizationId: string;
  teams: Team[];
  positions: Position[];
  people: Person[];
  actions: Action[];
  policies: Policy[];
  teamOwnerships: TeamOwnership[];
  positionOwnerships: PositionOwnership[];
};

const LOCAL_DEMO_STATE: LocalDemoState = {
  organizationId: "00000000-0000-4000-8000-000000000111",
  teams: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      name: "Executive",
      code: "EXEC",
      parentTeamId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "10000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      name: "Finance",
      code: "FIN",
      parentTeamId: "10000000-0000-4000-8000-000000000001",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "10000000-0000-4000-8000-000000000003",
      organizationId: "00000000-0000-4000-8000-000000000111",
      name: "Operations",
      code: "OPS",
      parentTeamId: "10000000-0000-4000-8000-000000000001",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "10000000-0000-4000-8000-000000000004",
      organizationId: "00000000-0000-4000-8000-000000000111",
      name: "Sales",
      code: "SLS",
      parentTeamId: "10000000-0000-4000-8000-000000000001",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  positions: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000001",
      title: "Chief Executive Officer",
      reportsToPositionId: null,
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000002",
      title: "Head of Finance",
      reportsToPositionId: "20000000-0000-4000-8000-000000000001",
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "20000000-0000-4000-8000-000000000003",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000003",
      title: "Head of Operations",
      reportsToPositionId: "20000000-0000-4000-8000-000000000001",
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "20000000-0000-4000-8000-000000000004",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000004",
      title: "Head of Sales",
      reportsToPositionId: "20000000-0000-4000-8000-000000000001",
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "20000000-0000-4000-8000-000000000005",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000003",
      title: "Operations Manager",
      reportsToPositionId: "20000000-0000-4000-8000-000000000003",
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "20000000-0000-4000-8000-000000000006",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000002",
      title: "Finance Manager",
      reportsToPositionId: "20000000-0000-4000-8000-000000000002",
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "20000000-0000-4000-8000-000000000007",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000004",
      title: "Sales Manager",
      reportsToPositionId: "20000000-0000-4000-8000-000000000004",
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "20000000-0000-4000-8000-000000000008",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000003",
      title: "Operations Specialist",
      reportsToPositionId: "20000000-0000-4000-8000-000000000005",
      lifecycleStatus: PositionLifecycleStatus.filled,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  people: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "Alex Morgan",
      email: "alex@demo.teamframe",
      phone: "+971500000001",
      positionId: "20000000-0000-4000-8000-000000000001",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "Sarah Lee",
      email: "sarah@demo.teamframe",
      phone: "+971500000002",
      positionId: "20000000-0000-4000-8000-000000000002",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000003",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "David Chen",
      email: "david@demo.teamframe",
      phone: "+971500000003",
      positionId: "20000000-0000-4000-8000-000000000003",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000004",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "Michael Scott",
      email: "michael@demo.teamframe",
      phone: "+971500000004",
      positionId: "20000000-0000-4000-8000-000000000004",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000005",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "Lisa Brown",
      email: "lisa@demo.teamframe",
      phone: "+971500000005",
      positionId: "20000000-0000-4000-8000-000000000005",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000006",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "John Kim",
      email: "john@demo.teamframe",
      phone: "+971500000006",
      positionId: "20000000-0000-4000-8000-000000000006",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000007",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "Jim Halpert",
      email: "jim@demo.teamframe",
      phone: "+971500000007",
      positionId: "20000000-0000-4000-8000-000000000007",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "30000000-0000-4000-8000-000000000008",
      organizationId: "00000000-0000-4000-8000-000000000111",
      fullName: "Anna Patel",
      email: "anna@demo.teamframe",
      phone: "+971500000008",
      positionId: "20000000-0000-4000-8000-000000000008",
      employmentStatus: EmploymentStatus.active,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  teamOwnerships: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000002",
      ownerPersonId: "30000000-0000-4000-8000-000000000002",
      ownerPositionId: null,
      responsibilityContext: "Finance controls and payroll accuracy",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "40000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000003",
      ownerPersonId: "30000000-0000-4000-8000-000000000003",
      ownerPositionId: null,
      responsibilityContext: "Operational execution and onboarding readiness",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "40000000-0000-4000-8000-000000000003",
      organizationId: "00000000-0000-4000-8000-000000000111",
      teamId: "10000000-0000-4000-8000-000000000004",
      ownerPersonId: "30000000-0000-4000-8000-000000000004",
      ownerPositionId: null,
      responsibilityContext: "Revenue pipeline accountability",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  positionOwnerships: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      positionId: "20000000-0000-4000-8000-000000000005",
      ownerPersonId: "30000000-0000-4000-8000-000000000005",
      ownerPositionId: null,
      responsibilityContext: "Weekly operations standup cadence",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "50000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      positionId: "20000000-0000-4000-8000-000000000007",
      ownerPersonId: "30000000-0000-4000-8000-000000000007",
      ownerPositionId: null,
      responsibilityContext: "Sales follow-up execution",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  actions: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Finalize Q3 hiring budget sign-off",
      description: "CEO and finance alignment required",
      status: ActionStatus.open,
      dueDate: "2026-01-05",
      blocked: false,
      ownerPersonId: "30000000-0000-4000-8000-000000000002",
      ownerPositionId: null,
      teamId: "10000000-0000-4000-8000-000000000002",
      positionId: null,
      personId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "60000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Resolve onboarding process bottleneck",
      description: "Escalation pending owner confirmation",
      status: ActionStatus.in_progress,
      dueDate: "2026-01-04",
      blocked: true,
      ownerPersonId: "30000000-0000-4000-8000-000000000003",
      ownerPositionId: null,
      teamId: "10000000-0000-4000-8000-000000000003",
      positionId: null,
      personId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "60000000-0000-4000-8000-000000000003",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Create sales territory ownership map",
      description: "Ensure every territory has explicit owner",
      status: ActionStatus.open,
      dueDate: "2030-02-15",
      blocked: false,
      ownerPersonId: "30000000-0000-4000-8000-000000000007",
      ownerPositionId: null,
      teamId: "10000000-0000-4000-8000-000000000004",
      positionId: null,
      personId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "60000000-0000-4000-8000-000000000004",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Audit policy ownership gaps",
      description: "Policy scope-owner mapping review",
      status: ActionStatus.done,
      dueDate: "2026-01-02",
      blocked: false,
      ownerPersonId: "30000000-0000-4000-8000-000000000001",
      ownerPositionId: null,
      teamId: null,
      positionId: "20000000-0000-4000-8000-000000000001",
      personId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "60000000-0000-4000-8000-000000000005",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Close finance reconciliation checklist",
      description: "Owner escalation currently blocked",
      status: ActionStatus.in_progress,
      dueDate: "2030-01-10",
      blocked: true,
      ownerPersonId: "30000000-0000-4000-8000-000000000006",
      ownerPositionId: null,
      teamId: null,
      positionId: "20000000-0000-4000-8000-000000000006",
      personId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  policies: [
    {
      id: "70000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Operating Rhythm",
      body: "Leadership reviews ownership and blockers every Monday 09:00.",
      scope: PolicyScope.organization,
      teamId: null,
      positionId: null,
      ownerPersonId: "30000000-0000-4000-8000-000000000001",
      ownerPositionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "70000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Finance Spend Controls",
      body: "All unplanned spend above threshold requires Head of Finance approval.",
      scope: PolicyScope.team,
      teamId: "10000000-0000-4000-8000-000000000002",
      positionId: null,
      ownerPersonId: "30000000-0000-4000-8000-000000000002",
      ownerPositionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "70000000-0000-4000-8000-000000000003",
      organizationId: "00000000-0000-4000-8000-000000000111",
      title: "Operations Onboarding SLA",
      body: "New hires must complete role ownership map within week one.",
      scope: PolicyScope.position,
      teamId: null,
      positionId: "20000000-0000-4000-8000-000000000005",
      ownerPersonId: "30000000-0000-4000-8000-000000000003",
      ownerPositionId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

function cloneLocalDemoState(): LocalDemoState {
  return {
    organizationId: LOCAL_DEMO_STATE.organizationId,
    teams: LOCAL_DEMO_STATE.teams.map((item) => ({ ...item })),
    positions: LOCAL_DEMO_STATE.positions.map((item) => ({ ...item })),
    people: LOCAL_DEMO_STATE.people.map((item) => ({ ...item })),
    actions: LOCAL_DEMO_STATE.actions.map((item) => ({ ...item })),
    policies: LOCAL_DEMO_STATE.policies.map((item) => ({ ...item })),
    teamOwnerships: LOCAL_DEMO_STATE.teamOwnerships.map((item) => ({ ...item })),
    positionOwnerships: LOCAL_DEMO_STATE.positionOwnerships.map((item) => ({ ...item })),
  };
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState<NavId>("org");
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoResetSummary, setDemoResetSummary] = useState<string>("");
  const [isLocalDemoMode, setIsLocalDemoMode] = useState(false);

  const [teams, setTeams] = useState<Team[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [teamOwnerships, setTeamOwnerships] = useState<TeamOwnership[]>([]);
  const [positionOwnerships, setPositionOwnerships] = useState<PositionOwnership[]>([]);

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamParentId, setNewTeamParentId] = useState<string>("");

  const [newPositionTitle, setNewPositionTitle] = useState("");
  const [newPositionTeamId, setNewPositionTeamId] = useState<string>("");
  const [newPositionReportsToId, setNewPositionReportsToId] = useState<string>("");

  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonEmail, setNewPersonEmail] = useState("");
  const [newPersonPhone, setNewPersonPhone] = useState("");
  const [newPersonPositionId, setNewPersonPositionId] = useState<string>("");
  const [newPersonStatus, setNewPersonStatus] = useState<"active" | "on_leave" | "offboarding">(
    EmploymentStatus.active,
  );

  const [teamOwnershipTargetId, setTeamOwnershipTargetId] = useState<string>("");
  const [teamOwnershipOwnerType, setTeamOwnershipOwnerType] = useState<OwnerType>("person");
  const [teamOwnershipOwnerId, setTeamOwnershipOwnerId] = useState<string>("");
  const [teamOwnershipContext, setTeamOwnershipContext] = useState("");

  const [positionOwnershipTargetId, setPositionOwnershipTargetId] = useState<string>("");
  const [positionOwnershipOwnerType, setPositionOwnershipOwnerType] = useState<OwnerType>("person");
  const [positionOwnershipOwnerId, setPositionOwnershipOwnerId] = useState<string>("");
  const [positionOwnershipContext, setPositionOwnershipContext] = useState("");

  const [newActionTitle, setNewActionTitle] = useState("");
  const [newActionDueDate, setNewActionDueDate] = useState("");
  const [newActionOwnerType, setNewActionOwnerType] = useState<OwnerType>("person");
  const [newActionOwnerId, setNewActionOwnerId] = useState<string>("");
  const [newActionLinkType, setNewActionLinkType] = useState<LinkType>("team");
  const [newActionLinkId, setNewActionLinkId] = useState<string>("");

  const [newPolicyTitle, setNewPolicyTitle] = useState("");
  const [newPolicyBody, setNewPolicyBody] = useState("");
  const [newPolicyScope, setNewPolicyScope] = useState<"organization" | "team" | "position">(
    PolicyScope.organization,
  );
  const [newPolicyTeamId, setNewPolicyTeamId] = useState<string>("");
  const [newPolicyPositionId, setNewPolicyPositionId] = useState<string>("");
  const [newPolicyOwnerType, setNewPolicyOwnerType] = useState<OwnerType>("person");
  const [newPolicyOwnerId, setNewPolicyOwnerId] = useState<string>("");

  const [policyRetargetPolicyId, setPolicyRetargetPolicyId] = useState<string>("");
  const [policyRetargetScope, setPolicyRetargetScope] = useState<"organization" | "team" | "position">(
    PolicyScope.organization,
  );
  const [policyRetargetTeamId, setPolicyRetargetTeamId] = useState<string>("");
  const [policyRetargetPositionId, setPolicyRetargetPositionId] = useState<string>("");

  const teamMap = useMemo(() => new Map(teams.map((item) => [item.id, item])), [teams]);
  const positionMap = useMemo(
    () => new Map(positions.map((item) => [item.id, item])),
    [positions],
  );
  const personMap = useMemo(() => new Map(people.map((item) => [item.id, item])), [people]);
  const teamOwnershipMap = useMemo(
    () => new Map(teamOwnerships.map((item) => [item.teamId, item])),
    [teamOwnerships],
  );
  const positionOwnershipMap = useMemo(
    () => new Map(positionOwnerships.map((item) => [item.positionId, item])),
    [positionOwnerships],
  );

  const positionsByManager = useMemo(() => {
    const map = new Map<string, Position[]>();
    for (const position of positions) {
      const key = position.reportsToPositionId ?? "root";
      const bucket = map.get(key) ?? [];
      bucket.push(position);
      map.set(key, bucket);
    }
    for (const entry of map.values()) {
      entry.sort((a, b) => a.title.localeCompare(b.title));
    }
    return map;
  }, [positions]);

  const peopleByPosition = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const person of people) {
      if (!person.positionId) continue;
      const bucket = map.get(person.positionId) ?? [];
      bucket.push(person);
      map.set(person.positionId, bucket);
    }
    return map;
  }, [people]);

  const overdueActions = useMemo(
    () =>
      actions.filter((item) => {
        if (item.status === ActionStatus.done || !item.dueDate) return false;
        const due = new Date(item.dueDate).getTime();
        if (Number.isNaN(due)) return false;
        return due < Date.now();
      }).length,
    [actions],
  );

  const blockedActions = useMemo(
    () => actions.filter((item) => item.status !== ActionStatus.done && item.blocked).length,
    [actions],
  );

  function applyStateSnapshot(snapshot: Omit<LocalDemoState, "organizationId">) {
    setTeams(snapshot.teams);
    setPositions(snapshot.positions);
    setPeople(snapshot.people);
    setActions(snapshot.actions);
    setPolicies(snapshot.policies);
    setTeamOwnerships(snapshot.teamOwnerships);
    setPositionOwnerships(snapshot.positionOwnerships);
  }

  function loadLocalDemoSnapshot(message: string) {
    const snapshot = cloneLocalDemoState();
    setOrganizationId(snapshot.organizationId);
    applyStateSnapshot(snapshot);
    setIsLocalDemoMode(true);
    setError(message);
    setDemoResetSummary(
      `Local demo snapshot loaded: ${snapshot.teams.length} teams, ${snapshot.positions.length} positions, ${snapshot.people.length} people, ${snapshot.actions.length} actions, ${snapshot.policies.length} policies.`,
    );
  }

  async function executeApiCall<T>(
    label: string,
    operation: (options: RequestInit) => Promise<T>,
    retries = API_MAX_RETRIES,
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= retries) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
      try {
        return await operation({ ...requestOptions(), signal: controller.signal });
      } catch (error) {
        lastError = error;
        if (attempt >= retries || !isRetryableError(error)) {
          break;
        }
      } finally {
        clearTimeout(timeout);
      }
      attempt += 1;
    }

    throw new Error(describeError(label, lastError), { cause: lastError });
  }

  async function bootstrapOrganizationContext(): Promise<string> {
    const orgs = await executeApiCall("Load organizations", (options) => listOrganizations(options));
    let orgId = orgs.items[0]?.id ?? null;

    if (!orgId) {
      const created = await executeApiCall("Create organization", (options) =>
        createOrganization(
          {
            name: "TeamFrame Workspace",
            slug: defaultOrgSlug(),
          },
          options,
        ),
      );
      orgId = created.id;
    }

    return orgId;
  }

  async function loadOrganizationState(targetOrganizationId: string) {
    const [teamData, positionData, peopleData, actionData, policyData, teamOwnerData, positionOwnerData] =
      await Promise.all([
        executeApiCall("Load teams", (options) => listTeams(targetOrganizationId, options)),
        executeApiCall("Load positions", (options) => listPositions(targetOrganizationId, options)),
        executeApiCall("Load people", (options) => listPeople(targetOrganizationId, options)),
        executeApiCall("Load actions", (options) => listActions(targetOrganizationId, options)),
        executeApiCall("Load policies", (options) => listPolicies(targetOrganizationId, options)),
        executeApiCall("Load team ownership", (options) =>
          listTeamOwnerships(targetOrganizationId, options),
        ),
        executeApiCall("Load position ownership", (options) =>
          listPositionOwnerships(targetOrganizationId, options),
        ),
      ]);

    applyStateSnapshot({
      teams: teamData.items,
      positions: positionData.items,
      people: peopleData.items,
      actions: actionData.items,
      policies: policyData.items,
      teamOwnerships: teamOwnerData.items,
      positionOwnerships: positionOwnerData.items,
    });
    setIsLocalDemoMode(false);
  }

  async function recoverOrganizationContext(reason: string) {
    const recoveredOrganizationId = await bootstrapOrganizationContext();
    setOrganizationId(recoveredOrganizationId);
    await loadOrganizationState(recoveredOrganizationId);
    setError(`${reason} Recovery complete. Re-synced organization context.`);
  }

  async function refreshState() {
    if (!organizationId || isLocalDemoMode) return;

    try {
      await loadOrganizationState(organizationId);
    } catch (error) {
      const status = errorStatus(error);
      if (status === 403 || status === 404) {
        await recoverOrganizationContext("Organization context became invalid.");
        return;
      }
      throw error;
    }
  }

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    setBaseUrl(apiBase ? apiBase : null);

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const orgId = await bootstrapOrganizationContext();
        if (cancelled) return;
        setOrganizationId(orgId);
        await loadOrganizationState(orgId);
      } catch (error) {
        if (!cancelled) {
          const reason = error instanceof Error ? error.message : String(error);
          loadLocalDemoSnapshot(
            `API unavailable. Loaded local demo snapshot for visual review. (${reason})`,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runMutation(task: () => Promise<void>) {
    if (isLocalDemoMode) {
      setError("Local demo snapshot is read-only. Start API mode to persist changes.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await task();
      await refreshState();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  function ownerLabel(ownerPersonId?: string | null, ownerPositionId?: string | null): string {
    if (ownerPersonId) {
      const person = personMap.get(ownerPersonId);
      return person ? person.fullName : ownerPersonId;
    }
    if (ownerPositionId) {
      const position = positionMap.get(ownerPositionId);
      return position ? position.title : ownerPositionId;
    }
    return "Unassigned";
  }

  function linkLabel(action: Action): string {
    if (action.teamId) return `Team: ${teamMap.get(action.teamId)?.name ?? action.teamId}`;
    if (action.positionId) {
      return `Position: ${positionMap.get(action.positionId)?.title ?? action.positionId}`;
    }
    if (action.personId) return `Person: ${personMap.get(action.personId)?.fullName ?? action.personId}`;
    return "Unknown link";
  }

  function renderPositionTree(positionId: string, depth: number) {
    const position = positionMap.get(positionId);
    if (!position) return <></>;
    const peopleInPosition = peopleByPosition.get(positionId) ?? [];
    const children = positionsByManager.get(positionId) ?? [];
    const ownership = positionOwnershipMap.get(positionId);

    return (
      <div key={positionId} style={{ marginLeft: depth * 20, marginBottom: 8 }}>
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 8, background: "#F8FAFC" }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{position.title}</div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            Team: {position.teamId ? teamMap.get(position.teamId)?.name ?? position.teamId : "Unassigned"} · Status: {position.lifecycleStatus}
          </div>
          <div style={{ fontSize: 11, color: "#475569" }}>
            People: {peopleInPosition.length ? peopleInPosition.map((person) => person.fullName).join(", ") : "Vacant"}
          </div>
          <div style={{ fontSize: 11, color: "#0F172A" }}>
            Owner: {ownership ? ownerLabel(ownership.ownerPersonId, ownership.ownerPositionId) : "Unassigned"}
          </div>
        </div>
        {children.map((child) => renderPositionTree(child.id, depth + 1))}
      </div>
    );
  }

  const rootPositions = positionsByManager.get("root") ?? [];

  async function handleCreateTeam() {
    if (!organizationId || !newTeamName.trim()) return;
    await runMutation(async () => {
      await executeApiCall("Create team", (options) =>
        createTeam(
          organizationId,
          {
            name: newTeamName.trim(),
            parentTeamId: newTeamParentId || undefined,
          },
          options,
        ),
      );
      setNewTeamName("");
      setNewTeamParentId("");
    });
  }

  async function handleCreatePosition() {
    if (!organizationId || !newPositionTitle.trim()) return;
    await runMutation(async () => {
      await executeApiCall("Create position", (options) =>
        createPosition(
          organizationId,
          {
            title: newPositionTitle.trim(),
            teamId: newPositionTeamId || undefined,
            reportsToPositionId: newPositionReportsToId || undefined,
            lifecycleStatus: PositionLifecycleStatus.vacant,
          },
          options,
        ),
      );
      setNewPositionTitle("");
      setNewPositionTeamId("");
      setNewPositionReportsToId("");
    });
  }

  async function handleCreatePerson() {
    if (!organizationId || !newPersonName.trim()) return;
    await runMutation(async () => {
      await executeApiCall("Create person", (options) =>
        createPerson(
          organizationId,
          {
            fullName: newPersonName.trim(),
            email: newPersonEmail || undefined,
            phone: newPersonPhone || undefined,
            positionId: newPersonPositionId || undefined,
            employmentStatus: newPersonStatus,
          },
          options,
        ),
      );
      setNewPersonName("");
      setNewPersonEmail("");
      setNewPersonPhone("");
      setNewPersonPositionId("");
      setNewPersonStatus(EmploymentStatus.active);
    });
  }

  async function handleAssignTeamOwnership() {
    if (!organizationId || !teamOwnershipTargetId || !teamOwnershipOwnerId) return;
    await runMutation(async () => {
      await executeApiCall("Assign team ownership", (options) =>
        assignTeamOwnership(
          organizationId,
          teamOwnershipTargetId,
          {
            ownerPersonId: teamOwnershipOwnerType === "person" ? teamOwnershipOwnerId : null,
            ownerPositionId: teamOwnershipOwnerType === "position" ? teamOwnershipOwnerId : null,
            responsibilityContext: teamOwnershipContext,
          },
          options,
        ),
      );
      setTeamOwnershipContext("");
    });
  }

  async function handleAssignPositionOwnership() {
    if (!organizationId || !positionOwnershipTargetId || !positionOwnershipOwnerId) return;
    await runMutation(async () => {
      await executeApiCall("Assign position ownership", (options) =>
        assignPositionOwnership(
          organizationId,
          positionOwnershipTargetId,
          {
            ownerPersonId:
              positionOwnershipOwnerType === "person" ? positionOwnershipOwnerId : null,
            ownerPositionId:
              positionOwnershipOwnerType === "position" ? positionOwnershipOwnerId : null,
            responsibilityContext: positionOwnershipContext,
          },
          options,
        ),
      );
      setPositionOwnershipContext("");
    });
  }

  async function handleCreateAction() {
    if (!organizationId || !newActionTitle.trim() || !newActionOwnerId || !newActionLinkId) return;

    await runMutation(async () => {
      await executeApiCall("Create action", (options) =>
        createAction(
          organizationId,
          {
            title: newActionTitle.trim(),
            dueDate: newActionDueDate || undefined,
            owner: {
              ownerPersonId: newActionOwnerType === "person" ? newActionOwnerId : null,
              ownerPositionId: newActionOwnerType === "position" ? newActionOwnerId : null,
            },
            link: {
              teamId: newActionLinkType === "team" ? newActionLinkId : null,
              positionId: newActionLinkType === "position" ? newActionLinkId : null,
              personId: newActionLinkType === "person" ? newActionLinkId : null,
            },
          },
          options,
        ),
      );
      setNewActionTitle("");
      setNewActionDueDate("");
      setNewActionOwnerId("");
      setNewActionLinkId("");
    });
  }

  async function handleTransitionAction(action: Action) {
    if (!organizationId) return;
    const nextStatus =
      action.status === ActionStatus.open
        ? ActionStatus.in_progress
        : action.status === ActionStatus.in_progress
          ? ActionStatus.done
          : null;
    if (!nextStatus) return;

    await runMutation(async () => {
      await executeApiCall("Transition action", (options) =>
        transitionActionStatus(
          organizationId,
          action.id,
          {
            status: nextStatus,
          },
          options,
        ),
      );
    });
  }

  async function handleCreatePolicy() {
    if (!organizationId || !newPolicyTitle.trim() || !newPolicyBody.trim() || !newPolicyOwnerId) return;

    await runMutation(async () => {
      await executeApiCall("Create policy", (options) =>
        createPolicy(
          organizationId,
          {
            title: newPolicyTitle.trim(),
            body: newPolicyBody.trim(),
            scope: newPolicyScope,
            teamId: newPolicyScope === PolicyScope.team ? newPolicyTeamId || undefined : undefined,
            positionId:
              newPolicyScope === PolicyScope.position ? newPolicyPositionId || undefined : undefined,
            owner: {
              ownerPersonId: newPolicyOwnerType === "person" ? newPolicyOwnerId : null,
              ownerPositionId: newPolicyOwnerType === "position" ? newPolicyOwnerId : null,
            },
          },
          options,
        ),
      );

      setNewPolicyTitle("");
      setNewPolicyBody("");
      setNewPolicyTeamId("");
      setNewPolicyPositionId("");
      setNewPolicyOwnerId("");
    });
  }

  async function handleAttachPolicyScope() {
    if (!organizationId || !policyRetargetPolicyId) return;
    await runMutation(async () => {
      await executeApiCall("Attach policy scope", (options) =>
        attachPolicyScope(
          organizationId,
          policyRetargetPolicyId,
          {
            scope: policyRetargetScope,
            teamId: policyRetargetScope === PolicyScope.team ? policyRetargetTeamId || null : null,
            positionId:
              policyRetargetScope === PolicyScope.position
                ? policyRetargetPositionId || null
                : null,
          },
          options,
        ),
      );
    });
  }

  async function handleDeleteEntity(
    type: "team" | "position" | "person" | "action" | "policy",
    id: string,
  ) {
    if (!organizationId) return;
    await runMutation(async () => {
      if (type === "team") {
        await executeApiCall("Delete team", (options) => deleteTeam(organizationId, id, options));
      }
      if (type === "position") {
        await executeApiCall("Delete position", (options) =>
          deletePosition(organizationId, id, options),
        );
      }
      if (type === "person") {
        await executeApiCall("Delete person", (options) => deletePerson(organizationId, id, options));
      }
      if (type === "action") {
        await executeApiCall("Delete action", (options) => deleteAction(organizationId, id, options));
      }
      if (type === "policy") {
        await executeApiCall("Delete policy", (options) => deletePolicy(organizationId, id, options));
      }
    });
  }

  async function handleResetDemoState() {
    if (!organizationId) return;

    if (isLocalDemoMode) {
      loadLocalDemoSnapshot("Local demo snapshot reset for visual review.");
      return;
    }

    await runMutation(async () => {
      const result = await executeApiCall("Reset demo state", (options) =>
        resetOrganizationDemoState(organizationId, options),
      );
      setDemoResetSummary(
        `Reset complete: ${result.teams} teams, ${result.positions} positions, ${result.people} people, ${result.actions} actions, ${result.policies} policies.`,
      );
    });
  }

  async function handleInvalidOrgRecoveryCheck() {
    if (isLocalDemoMode) {
      setError("Invalid-org recovery check is available in API mode. Local demo snapshot is already isolated.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await loadOrganizationState("00000000-0000-4000-8000-000000000000");
      setError("Recovery check did not trigger as expected.");
    } catch (_error) {
      await recoverOrganizationContext("Invalid organization context detected.");
    } finally {
      setBusy(false);
    }
  }

  function downloadPayrollCsv() {
    const rows = people.map((person) => {
      const position = person.positionId ? positionMap.get(person.positionId) : null;
      const team = position?.teamId ? teamMap.get(position.teamId) : null;
      return [
        person.id,
        person.fullName,
        position?.title ?? "",
        team?.name ?? "",
        person.email ?? "",
        person.phone ?? "",
      ];
    });

    const csv = [
      ["Person ID", "Full Name", "Position", "Team", "Email", "Phone"],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "teamframe-payroll-export.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  if (loading) {
    return (
      <div style={STYLE.page}>
        <div style={{ padding: 24 }}>Loading TeamFrame workspace…</div>
      </div>
    );
  }

  return (
    <div style={STYLE.page}>
      <div style={STYLE.shell}>
        <aside style={STYLE.sidebar}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>TeamFrame V1</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "1px solid #E5E7EB",
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 6,
                background: activeNav === item.id ? "#EEF2FF" : "#FFFFFF",
                color: activeNav === item.id ? "#312E81" : "#0F172A",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </aside>

        <main style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <section style={STYLE.panel}>
            <div style={STYLE.title}>Organizational Operations Workspace</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 10 }}>
              <div style={{ ...STYLE.panel, padding: 10 }}>
                <div style={STYLE.subTitle}>Teams</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{teams.length}</div>
              </div>
              <div style={{ ...STYLE.panel, padding: 10 }}>
                <div style={STYLE.subTitle}>Positions</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{positions.length}</div>
              </div>
              <div style={{ ...STYLE.panel, padding: 10 }}>
                <div style={STYLE.subTitle}>People</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{people.length}</div>
              </div>
              <div style={{ ...STYLE.panel, padding: 10 }}>
                <div style={STYLE.subTitle}>Open Actions</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {actions.filter((item) => item.status !== ActionStatus.done).length}
                </div>
              </div>
              <div style={{ ...STYLE.panel, padding: 10 }}>
                <div style={STYLE.subTitle}>Overdue</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: overdueActions ? "#B91C1C" : "#0F172A" }}>{overdueActions}</div>
              </div>
              <div style={{ ...STYLE.panel, padding: 10 }}>
                <div style={STYLE.subTitle}>Blocked</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: blockedActions ? "#B45309" : "#0F172A" }}>{blockedActions}</div>
              </div>
            </div>
            {error ? (
              <div style={{ marginTop: 10, color: "#B91C1C", fontSize: 12 }}>{error}</div>
            ) : null}
            {busy ? <div style={{ marginTop: 10, color: "#475569", fontSize: 12 }}>Saving…</div> : null}
            <div style={{ marginTop: 8, fontSize: 11, color: isLocalDemoMode ? "#92400E" : "#0F766E" }}>
              Data source: {isLocalDemoMode ? "Local demo snapshot (read-only)" : "Live API state"}
            </div>
          </section>

          {activeNav === "org" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Org Map to Teams to Owners to Actions</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={STYLE.panel}>
                  <div style={STYLE.subTitle}>Create Team</div>
                  <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name" style={{ width: "100%", marginBottom: 6 }} />
                  <select value={newTeamParentId} onChange={(e) => setNewTeamParentId(e.target.value)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value="">No parent</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <button onClick={() => void handleCreateTeam()}>Add Team</button>
                </div>

                <div style={STYLE.panel}>
                  <div style={STYLE.subTitle}>Create Position</div>
                  <input value={newPositionTitle} onChange={(e) => setNewPositionTitle(e.target.value)} placeholder="Position title" style={{ width: "100%", marginBottom: 6 }} />
                  <select value={newPositionTeamId} onChange={(e) => setNewPositionTeamId(e.target.value)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value="">No team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <select value={newPositionReportsToId} onChange={(e) => setNewPositionReportsToId(e.target.value)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value="">No manager</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                  <button onClick={() => void handleCreatePosition()}>Add Position</button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div style={STYLE.panel}>
                  <div style={STYLE.subTitle}>Create Person</div>
                  <input value={newPersonName} onChange={(e) => setNewPersonName(e.target.value)} placeholder="Full name" style={{ width: "100%", marginBottom: 6 }} />
                  <input value={newPersonEmail} onChange={(e) => setNewPersonEmail(e.target.value)} placeholder="Email" style={{ width: "100%", marginBottom: 6 }} />
                  <input value={newPersonPhone} onChange={(e) => setNewPersonPhone(e.target.value)} placeholder="Phone" style={{ width: "100%", marginBottom: 6 }} />
                  <select value={newPersonPositionId} onChange={(e) => setNewPersonPositionId(e.target.value)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value="">No position</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                  <select value={newPersonStatus} onChange={(e) => setNewPersonStatus(e.target.value as typeof newPersonStatus)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value={EmploymentStatus.active}>Active</option>
                    <option value={EmploymentStatus.on_leave}>On leave</option>
                    <option value={EmploymentStatus.offboarding}>Offboarding</option>
                  </select>
                  <button onClick={() => void handleCreatePerson()}>Add Person</button>
                </div>

                <div style={STYLE.panel}>
                  <div style={STYLE.subTitle}>Assign Team Ownership</div>
                  <select value={teamOwnershipTargetId} onChange={(e) => setTeamOwnershipTargetId(e.target.value)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value="">Select team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <select value={teamOwnershipOwnerType} onChange={(e) => setTeamOwnershipOwnerType(e.target.value as OwnerType)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value="person">Owner by person</option>
                    <option value="position">Owner by position</option>
                  </select>
                  <select value={teamOwnershipOwnerId} onChange={(e) => setTeamOwnershipOwnerId(e.target.value)} style={{ width: "100%", marginBottom: 6 }}>
                    <option value="">Select owner</option>
                    {(teamOwnershipOwnerType === "person" ? people : positions).map((item) => (
                      <option key={item.id} value={item.id}>{"fullName" in item ? item.fullName : item.title}</option>
                    ))}
                  </select>
                  <input value={teamOwnershipContext} onChange={(e) => setTeamOwnershipContext(e.target.value)} placeholder="Responsibility context" style={{ width: "100%", marginBottom: 6 }} />
                  <button onClick={() => void handleAssignTeamOwnership()}>Assign Team Owner</button>
                </div>
              </div>

              <div style={{ ...STYLE.panel, marginBottom: 12 }}>
                <div style={STYLE.subTitle}>Assign Position Ownership</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
                  <select value={positionOwnershipTargetId} onChange={(e) => setPositionOwnershipTargetId(e.target.value)}>
                    <option value="">Select position</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                  <select value={positionOwnershipOwnerType} onChange={(e) => setPositionOwnershipOwnerType(e.target.value as OwnerType)}>
                    <option value="person">Owner by person</option>
                    <option value="position">Owner by position</option>
                  </select>
                  <select value={positionOwnershipOwnerId} onChange={(e) => setPositionOwnershipOwnerId(e.target.value)}>
                    <option value="">Select owner</option>
                    {(positionOwnershipOwnerType === "person" ? people : positions).map((item) => (
                      <option key={item.id} value={item.id}>{"fullName" in item ? item.fullName : item.title}</option>
                    ))}
                  </select>
                  <input value={positionOwnershipContext} onChange={(e) => setPositionOwnershipContext(e.target.value)} placeholder="Responsibility context" />
                </div>
                <button style={{ marginTop: 8 }} onClick={() => void handleAssignPositionOwnership()}>Assign Position Owner</button>
              </div>

              <div style={STYLE.panel}>
                <div style={STYLE.subTitle}>Org Structure</div>
                {rootPositions.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#64748B" }}>No positions yet.</div>
                ) : (
                  rootPositions.map((position) => renderPositionTree(position.id, 0))
                )}
              </div>
            </section>
          )}

          {activeNav === "actions" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Actions (execution layer)</div>

              <div style={{ ...STYLE.panel, marginBottom: 12 }}>
                <div style={STYLE.subTitle}>Create Action</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8 }}>
                  <input value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)} placeholder="Action title" />
                  <input type="date" value={newActionDueDate} onChange={(e) => setNewActionDueDate(e.target.value)} />
                  <select value={newActionOwnerType} onChange={(e) => setNewActionOwnerType(e.target.value as OwnerType)}>
                    <option value="person">Owner person</option>
                    <option value="position">Owner position</option>
                  </select>
                  <select value={newActionOwnerId} onChange={(e) => setNewActionOwnerId(e.target.value)}>
                    <option value="">Select owner</option>
                    {(newActionOwnerType === "person" ? people : positions).map((item) => (
                      <option key={item.id} value={item.id}>{"fullName" in item ? item.fullName : item.title}</option>
                    ))}
                  </select>
                  <select value={newActionLinkType} onChange={(e) => setNewActionLinkType(e.target.value as LinkType)}>
                    <option value="team">Link team</option>
                    <option value="position">Link position</option>
                    <option value="person">Link person</option>
                  </select>
                  <select value={newActionLinkId} onChange={(e) => setNewActionLinkId(e.target.value)}>
                    <option value="">Select link target</option>
                    {(newActionLinkType === "team" ? teams : newActionLinkType === "position" ? positions : people).map((item) => (
                      <option key={item.id} value={item.id}>{"fullName" in item ? item.fullName : "title" in item ? item.title : item.name}</option>
                    ))}
                  </select>
                </div>
                <button style={{ marginTop: 8 }} onClick={() => void handleCreateAction()}>Create Action</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {actions.map((item) => (
                  <div key={item.id} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 10, background: "#F8FAFC" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.title}</div>
                        <div style={{ fontSize: 12, color: "#475569" }}>{linkLabel(item)}</div>
                        <div style={{ fontSize: 12, color: "#475569" }}>
                          Owner: {ownerLabel(item.ownerPersonId, item.ownerPositionId)} · Due: {formatDateLabel(item.dueDate)}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", border: "1px solid #CBD5E1", borderRadius: 999, padding: "3px 8px" }}>
                          {item.status}
                        </span>
                        {item.status !== ActionStatus.done ? (
                          <button onClick={() => void handleTransitionAction(item)}>
                            {item.status === ActionStatus.open ? "Start" : "Mark Done"}
                          </button>
                        ) : null}
                        <button onClick={() => void handleDeleteEntity("action", item.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
                {actions.length === 0 ? <div style={{ fontSize: 12, color: "#64748B" }}>No actions yet.</div> : null}
              </div>
            </section>
          )}

          {activeNav === "team" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Team Directory (structural capability)</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #E5E7EB" }}>
                    <th style={{ padding: 6 }}>Name</th>
                    <th style={{ padding: 6 }}>Position</th>
                    <th style={{ padding: 6 }}>Team</th>
                    <th style={{ padding: 6 }}>Email</th>
                    <th style={{ padding: 6 }}>Phone</th>
                    <th style={{ padding: 6 }}>Status</th>
                    <th style={{ padding: 6 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const position = person.positionId ? positionMap.get(person.positionId) : null;
                    const team = position?.teamId ? teamMap.get(position.teamId) : null;
                    return (
                      <tr key={person.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: 6 }}>{person.fullName}</td>
                        <td style={{ padding: 6 }}>{position?.title ?? "-"}</td>
                        <td style={{ padding: 6 }}>{team?.name ?? "-"}</td>
                        <td style={{ padding: 6 }}>{person.email ?? "-"}</td>
                        <td style={{ padding: 6 }}>{person.phone ?? "-"}</td>
                        <td style={{ padding: 6 }}>{person.employmentStatus}</td>
                        <td style={{ padding: 6 }}>
                          <button onClick={() => void handleDeleteEntity("person", person.id)}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}

          {activeNav === "policies" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Policies (team/position context)</div>

              <div style={{ ...STYLE.panel, marginBottom: 12 }}>
                <div style={STYLE.subTitle}>Create Policy</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8 }}>
                  <input value={newPolicyTitle} onChange={(e) => setNewPolicyTitle(e.target.value)} placeholder="Policy title" />
                  <input value={newPolicyBody} onChange={(e) => setNewPolicyBody(e.target.value)} placeholder="Policy text" />
                  <select value={newPolicyScope} onChange={(e) => setNewPolicyScope(e.target.value as typeof newPolicyScope)}>
                    <option value={PolicyScope.organization}>Organization</option>
                    <option value={PolicyScope.team}>Team</option>
                    <option value={PolicyScope.position}>Position</option>
                  </select>
                  <select value={newPolicyTeamId} onChange={(e) => setNewPolicyTeamId(e.target.value)}>
                    <option value="">Team target</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <select value={newPolicyPositionId} onChange={(e) => setNewPolicyPositionId(e.target.value)}>
                    <option value="">Position target</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select value={newPolicyOwnerType} onChange={(e) => setNewPolicyOwnerType(e.target.value as OwnerType)}>
                      <option value="person">Owner person</option>
                      <option value="position">Owner position</option>
                    </select>
                    <select value={newPolicyOwnerId} onChange={(e) => setNewPolicyOwnerId(e.target.value)}>
                      <option value="">Owner</option>
                      {(newPolicyOwnerType === "person" ? people : positions).map((item) => (
                        <option key={item.id} value={item.id}>{"fullName" in item ? item.fullName : item.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button style={{ marginTop: 8 }} onClick={() => void handleCreatePolicy()}>Create Policy</button>
              </div>

              <div style={{ ...STYLE.panel, marginBottom: 12 }}>
                <div style={STYLE.subTitle}>Retarget Policy Scope</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
                  <select value={policyRetargetPolicyId} onChange={(e) => setPolicyRetargetPolicyId(e.target.value)}>
                    <option value="">Policy</option>
                    {policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>{policy.title}</option>
                    ))}
                  </select>
                  <select value={policyRetargetScope} onChange={(e) => setPolicyRetargetScope(e.target.value as typeof policyRetargetScope)}>
                    <option value={PolicyScope.organization}>Organization</option>
                    <option value={PolicyScope.team}>Team</option>
                    <option value={PolicyScope.position}>Position</option>
                  </select>
                  <select value={policyRetargetTeamId} onChange={(e) => setPolicyRetargetTeamId(e.target.value)}>
                    <option value="">Team target</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                  <select value={policyRetargetPositionId} onChange={(e) => setPolicyRetargetPositionId(e.target.value)}>
                    <option value="">Position target</option>
                    {positions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                </div>
                <button style={{ marginTop: 8 }} onClick={() => void handleAttachPolicyScope()}>Update Scope</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {policies.map((policy) => (
                  <div key={policy.id} style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontWeight: 700 }}>{policy.title}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{policy.body}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      Scope: {policy.scope}
                      {policy.teamId ? ` (${teamMap.get(policy.teamId)?.name ?? policy.teamId})` : ""}
                      {policy.positionId ? ` (${positionMap.get(policy.positionId)?.title ?? policy.positionId})` : ""}
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>
                      Owner: {ownerLabel(policy.ownerPersonId, policy.ownerPositionId)}
                    </div>
                    <button style={{ marginTop: 6 }} onClick={() => void handleDeleteEntity("policy", policy.id)}>Delete</button>
                  </div>
                ))}
                {policies.length === 0 ? <div style={{ fontSize: 12, color: "#64748B" }}>No policies yet.</div> : null}
              </div>
            </section>
          )}

          {activeNav === "administration" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Administration (minimal)</div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
                Organization ID: {organizationId ?? "-"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <button onClick={downloadPayrollCsv}>Download Payroll Export (utility)</button>
                <button onClick={() => void handleResetDemoState()} disabled={busy}>
                  Reset Deterministic Demo
                </button>
                <button onClick={() => void handleInvalidOrgRecoveryCheck()} disabled={busy}>
                  Run Invalid-Org Recovery Check
                </button>
              </div>
              {demoResetSummary ? (
                <div style={{ fontSize: 12, color: "#0F172A", marginBottom: 6 }}>{demoResetSummary}</div>
              ) : null}
              <div style={{ fontSize: 11, color: "#64748B" }}>
                COO walkthrough baseline: Org Map to Teams to Owners to Actions to Policies.
                {isLocalDemoMode ? " Local snapshot mode is active for visual review." : ""}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default TeamFrame;
