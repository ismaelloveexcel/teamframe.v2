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
  updatePerson,
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
type PositionLevel = "Executive" | "Director" | "Manager" | "IC";
type PositionPanelTab = "position" | "assignment" | "operations";
type AssignmentRuntimeStatus = "active" | "interim" | "ended";

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
    background: "#EEF2F7",
    color: "#0F172A",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  } as const,
  shell: {
    maxWidth: 1540,
    margin: "0 auto",
    padding: 20,
    display: "grid",
    gridTemplateColumns: "240px 1fr",
    gap: 16,
  } as const,
  sidebar: {
    background: "#0B1220",
    border: "1px solid #111827",
    borderRadius: 14,
    padding: 12,
    height: "fit-content",
    color: "#E2E8F0",
    boxShadow: "0 20px 40px rgba(2, 6, 23, 0.35)",
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

function initials(fullName: string): string {
  const parts = fullName
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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

type PositionBlueprint = {
  jobDescription: string;
  salaryBand: string;
  requirements: string;
};

type AssignmentRuntime = {
  status: AssignmentRuntimeStatus;
  startDate: string;
  endDate: string;
  actualSalary: string;
};

type PositionNodeComputedState = "filled" | "vacant" | "interim" | "degraded" | "at-risk";

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
  const [expandedPositionIds, setExpandedPositionIds] = useState<Set<string>>(new Set());
  const [focusPositionId, setFocusPositionId] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [teamOwnerships, setTeamOwnerships] = useState<TeamOwnership[]>([]);
  const [positionOwnerships, setPositionOwnerships] = useState<PositionOwnership[]>([]);

  const [positionBlueprints, setPositionBlueprints] = useState<Record<string, PositionBlueprint>>({});
  const [assignmentRuntimeByPosition, setAssignmentRuntimeByPosition] = useState<Record<string, AssignmentRuntime>>({});
  const [positionPanelTab, setPositionPanelTab] = useState<PositionPanelTab>("position");
  const [focusedSubtreeRootId, setFocusedSubtreeRootId] = useState<string | null>(null);

  const [assignmentDraftEmployeeId, setAssignmentDraftEmployeeId] = useState<string>("");
  const [assignmentDraftStatus, setAssignmentDraftStatus] = useState<AssignmentRuntimeStatus>("active");
  const [assignmentDraftStartDate, setAssignmentDraftStartDate] = useState("");
  const [assignmentDraftEndDate, setAssignmentDraftEndDate] = useState("");
  const [assignmentDraftActualSalary, setAssignmentDraftActualSalary] = useState("");

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
  const [newActionOwnerId, setNewActionOwnerId] = useState<string>("");
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

  const positionAssignmentById = useMemo(() => {
    const map = new Map<string, { person: Person; runtime: AssignmentRuntime }>();
    for (const [positionId, assignedPeople] of peopleByPosition.entries()) {
      const person = assignedPeople[0];
      if (!person) continue;
      const runtime = assignmentRuntimeByPosition[positionId] ?? {
        status: "active",
        startDate: formatDateLabel(person.createdAt),
        endDate: "",
        actualSalary: "",
      };
      map.set(positionId, { person, runtime });
    }
    return map;
  }, [assignmentRuntimeByPosition, peopleByPosition]);

  const positionActionStats = useMemo(() => {
    const map = new Map<string, { open: number; overdue: number; blocked: number }>();
    for (const position of positions) {
      const scopedActions = actions.filter(
        (item) => item.positionId === position.id || item.ownerPositionId === position.id,
      );
      map.set(position.id, {
        open: scopedActions.filter((item) => item.status !== ActionStatus.done).length,
        overdue: scopedActions.filter((item) => {
          if (item.status === ActionStatus.done || !item.dueDate) return false;
          const due = new Date(item.dueDate).getTime();
          return !Number.isNaN(due) && due < Date.now();
        }).length,
        blocked: scopedActions.filter(
          (item) => item.status !== ActionStatus.done && item.blocked,
        ).length,
      });
    }
    return map;
  }, [actions, positions]);

  const positionComplianceAlerts = useMemo(() => {
    const map = new Map<string, number>();
    for (const position of positions) {
      const assignment = positionAssignmentById.get(position.id);
      if (!assignment) {
        map.set(position.id, 0);
        continue;
      }
      let alerts = 0;
      if (!assignment.person.email) alerts += 1;
      if (!assignment.person.phone) alerts += 1;
      map.set(position.id, alerts);
    }
    return map;
  }, [positionAssignmentById, positions]);

  const positionDirectReportCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const position of positions) {
      map.set(position.id, (positionsByManager.get(position.id) ?? []).length);
    }
    return map;
  }, [positions, positionsByManager]);

  const selectedPositionId = focusPositionId ?? positionsByManager.get("root")?.[0]?.id ?? null;
  const selectedPosition = selectedPositionId ? positionMap.get(selectedPositionId) ?? null : null;
  const selectedAssignment = selectedPositionId
    ? positionAssignmentById.get(selectedPositionId) ?? null
    : null;

  function getPositionBlueprint(position: Position): PositionBlueprint {
    const existing = positionBlueprints[position.id];
    if (existing) return existing;
    return {
      jobDescription: `Define responsibilities and outcomes for ${position.title}.`,
      salaryBand: "Not set",
      requirements: "",
    };
  }

  useEffect(() => {
    if (positionPanelTab !== "assignment" || !selectedPositionId) return;
    setAssignmentDraftEmployeeId(selectedAssignment?.person.id ?? "");
    setAssignmentDraftStatus(selectedAssignment?.runtime.status ?? "active");
    setAssignmentDraftStartDate(selectedAssignment?.runtime.startDate ?? "");
    setAssignmentDraftEndDate(selectedAssignment?.runtime.endDate ?? "");
    setAssignmentDraftActualSalary(selectedAssignment?.runtime.actualSalary ?? "");
  }, [positionPanelTab, selectedAssignment, selectedPositionId]);

  function setPositionBlueprintField(
    positionId: string,
    field: keyof PositionBlueprint,
    value: string,
  ) {
    setPositionBlueprints((current) => ({
      ...current,
      [positionId]: {
        ...(
          current[positionId] ?? {
            jobDescription: `Define responsibilities and outcomes for ${
              positionMap.get(positionId)?.title ?? "this position"
            }.`,
            salaryBand: "Not set",
            requirements: "",
          }
        ),
        [field]: value,
      },
    }));
  }

  function resolvePositionNodeState(positionId: string): PositionNodeComputedState {
    const assignment = positionAssignmentById.get(positionId);
    if (!assignment) return "vacant";
    if (assignment.runtime.status === "interim") return "interim";

    const actionStats = positionActionStats.get(positionId) ?? { open: 0, overdue: 0, blocked: 0 };
    const complianceAlerts = positionComplianceAlerts.get(positionId) ?? 0;

    if (assignment.person.employmentStatus === EmploymentStatus.on_leave) {
      return "degraded";
    }

    if (
      assignment.person.employmentStatus === EmploymentStatus.offboarding ||
      actionStats.overdue > 0 ||
      actionStats.blocked > 0 ||
      complianceAlerts > 0
    ) {
      return "at-risk";
    }

    return "filled";
  }

  const positionDepthMap = useMemo(() => {
    const depth = new Map<string, number>();
    const roots = positionsByManager.get("root") ?? [];
    const queue = roots.map((position) => ({ id: position.id, depth: 0 }));

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (depth.has(current.id)) continue;

      depth.set(current.id, current.depth);
      const children = positionsByManager.get(current.id) ?? [];
      for (const child of children) {
        queue.push({ id: child.id, depth: current.depth + 1 });
      }
    }

    return depth;
  }, [positionsByManager]);

  function resolvePositionLevel(positionId: string): PositionLevel {
    const depth = positionDepthMap.get(positionId);
    if (depth === 0) return "Executive";
    if (depth === 1) return "Director";
    if (depth === 2) return "Manager";
    return "IC";
  }

  const decisionMakerPositions = useMemo(
    () => positions.filter((position) => resolvePositionLevel(position.id) !== "IC"),
    [positions, positionDepthMap],
  );

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

  const ownershipResolvedCount = useMemo(
    () =>
      actions.filter(
        (item) => Boolean(item.assignmentId || item.ownerPersonId || item.ownerPositionId),
      ).length,
    [actions],
  );

  const assignmentLinkedCount = useMemo(
    () => actions.filter((item) => Boolean(item.assignmentId)).length,
    [actions],
  );

  const positionOwnedCount = useMemo(
    () => actions.filter((item) => Boolean(item.ownerPositionId)).length,
    [actions],
  );

  const personOwnedCount = useMemo(
    () => actions.filter((item) => Boolean(item.ownerPersonId)).length,
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
    setExpandedPositionIds(new Set());
  }, [positions]);

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
          loadLocalDemoSnapshot("API unavailable. Loaded local demo snapshot for visual review.");
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

  function togglePositionExpansion(positionId: string) {
    setExpandedPositionIds((current) => {
      const next = new Set(current);
      if (next.has(positionId)) next.delete(positionId);
      else next.add(positionId);
      return next;
    });
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

  function openAssignmentEditorForPosition(positionId: string, status?: AssignmentRuntimeStatus) {
    const assignment = positionAssignmentById.get(positionId);
    setFocusPositionId(positionId);
    setPositionPanelTab("assignment");
    setAssignmentDraftEmployeeId(assignment?.person.id ?? "");
    setAssignmentDraftStatus(status ?? assignment?.runtime.status ?? "active");
    setAssignmentDraftStartDate(assignment?.runtime.startDate ?? "");
    setAssignmentDraftEndDate(assignment?.runtime.endDate ?? "");
    setAssignmentDraftActualSalary(assignment?.runtime.actualSalary ?? "");
  }

  function statePresentation(state: PositionNodeComputedState) {
    if (state === "vacant") {
      return { label: "Vacant", bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5" };
    }
    if (state === "interim") {
      return { label: "Interim", bg: "#FEF3C7", color: "#92400E", border: "#FCD34D" };
    }
    if (state === "degraded") {
      return { label: "Degraded", bg: "#FEF3C7", color: "#92400E", border: "#F59E0B" };
    }
    if (state === "at-risk") {
      return { label: "At-risk", bg: "#FEE2E2", color: "#991B1B", border: "#EF4444" };
    }
    return { label: "Filled", bg: "#DCFCE7", color: "#166534", border: "#22C55E" };
  }

  function renderPositionNode(positionId: string) {
    const position = positionMap.get(positionId);
    if (!position) return <></>;

    const assignment = positionAssignmentById.get(positionId);
    const assignedPerson = assignment?.person ?? null;
    const children = positionsByManager.get(positionId) ?? [];
    const isCollapsed = expandedPositionIds.has(positionId);
    const visibleChildren = isCollapsed ? [] : children;
    const teamName = position.teamId ? teamMap.get(position.teamId)?.name ?? "Unassigned" : "Unassigned";
    const actionStats = positionActionStats.get(positionId) ?? { open: 0, overdue: 0, blocked: 0 };
    const complianceAlerts = positionComplianceAlerts.get(positionId) ?? 0;
    const directReports = positionDirectReportCount.get(positionId) ?? 0;
    const nodeState = resolvePositionNodeState(positionId);
    const stateUi = statePresentation(nodeState);
    const isSelected = selectedPositionId === positionId;

    return (
      <div
        key={positionId}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, minWidth: 260 }}
      >
        <button
          type="button"
          onClick={() => {
            setFocusPositionId(positionId);
            setPositionPanelTab("position");
          }}
          style={{
            width: "100%",
            maxWidth: 300,
            border: `1px solid ${isSelected ? "#2563EB" : stateUi.border}`,
            borderRadius: 14,
            padding: 12,
            background: "#FFFFFF",
            boxShadow: isSelected
              ? "0 0 0 2px rgba(37,99,235,0.12), 0 14px 28px rgba(15, 23, 42, 0.12)"
              : "0 14px 28px rgba(15, 23, 42, 0.12)",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "#334155",
                textTransform: "uppercase",
                border: "1px solid #CBD5E1",
                borderRadius: 999,
                padding: "3px 8px",
                background: "#F8FAFC",
              }}
            >
              {teamName}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                borderRadius: 999,
                padding: "3px 8px",
                background: stateUi.bg,
                color: stateUi.color,
              }}
            >
              {stateUi.label}
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                background: "#0F172A",
                color: "#F8FAFC",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {assignedPerson ? initials(assignedPerson.fullName) : "NA"}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{position.title}</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                {assignedPerson ? assignedPerson.fullName : "Vacant seat"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 10, color: "#334155", background: "#E2E8F0", borderRadius: 999, padding: "2px 7px" }}>
              {actionStats.open} open actions
            </span>
            {actionStats.overdue > 0 ? (
              <span style={{ fontSize: 10, color: "#991B1B", background: "#FEE2E2", borderRadius: 999, padding: "2px 7px" }}>
                {actionStats.overdue} overdue
              </span>
            ) : null}
            {complianceAlerts > 0 ? (
              <span style={{ fontSize: 10, color: "#92400E", background: "#FEF3C7", borderRadius: 999, padding: "2px 7px" }}>
                {complianceAlerts} compliance alerts
              </span>
            ) : null}
            {directReports > 5 ? (
              <span style={{ fontSize: 10, color: "#7F1D1D", background: "#FEE2E2", borderRadius: 999, padding: "2px 7px" }}>
                overload ({directReports} reports)
              </span>
            ) : null}
          </div>

          <div
            style={{
              marginTop: 10,
              borderTop: "1px solid #E2E8F0",
              paddingTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <button
              onClick={(event) => {
                event.stopPropagation();
                openAssignmentEditorForPosition(positionId);
              }}
              style={{ fontSize: 10, padding: "3px 7px" }}
            >
              {assignedPerson ? "Reassign" : "Assign"}
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setActiveNav("actions");
                setFocusPositionId(positionId);
                setNewActionOwnerId(positionId);
                setNewActionLinkId(positionId);
              }}
              style={{ fontSize: 10, padding: "3px 7px" }}
            >
              Create action
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                openAssignmentEditorForPosition(positionId, "interim");
              }}
              style={{ fontSize: 10, padding: "3px 7px" }}
            >
              Mark interim
            </button>
            <button
              onClick={(event) => {
                event.stopPropagation();
                setFocusedSubtreeRootId((current) =>
                  current === positionId ? null : positionId,
                );
              }}
              style={{ fontSize: 10, padding: "3px 7px" }}
            >
              {focusedSubtreeRootId === positionId ? "Unfocus" : "Focus subtree"}
            </button>
          </div>

          {children.length > 0 ? (
            <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  togglePositionExpansion(positionId);
                }}
                style={{ fontSize: 10, padding: "3px 7px" }}
              >
                {isCollapsed ? "Expand reports" : "Collapse reports"}
              </button>
            </div>
          ) : null}
        </button>

        {visibleChildren.length > 0 ? (
          <>
            <div style={{ width: 2, height: 16, background: "#1E293B" }} />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              {visibleChildren.map((child) => renderPositionNode(child.id))}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  const organizationRootPositions = positionsByManager.get("root") ?? [];
  const rootPositions = useMemo(() => {
    if (!focusedSubtreeRootId) return organizationRootPositions;
    const focusedRoot = positionMap.get(focusedSubtreeRootId);
    return focusedRoot ? [focusedRoot] : organizationRootPositions;
  }, [focusedSubtreeRootId, organizationRootPositions, positionMap]);

  const chartDepartmentTeams = teams.filter((team) => {
    const executiveTeamId = organizationRootPositions[0]?.teamId ?? null;
    if (executiveTeamId) return team.parentTeamId === executiveTeamId;
    return team.parentTeamId === null;
  });

  const departmentOverview = useMemo(() => {
    return chartDepartmentTeams.map((team) => {
      const teamPositions = positions.filter((position) => position.teamId === team.id);
      const teamPositionIds = new Set(teamPositions.map((position) => position.id));
      const teamPeopleCount = people.filter(
        (person) => person.positionId && teamPositionIds.has(person.positionId),
      ).length;
      return {
        teamId: team.id,
        teamName: team.name,
        positionCount: teamPositions.length,
        peopleCount: teamPeopleCount,
      };
    });
  }, [chartDepartmentTeams, positions, people]);

  const selectedActionStats = selectedPositionId
    ? positionActionStats.get(selectedPositionId) ?? { open: 0, overdue: 0, blocked: 0 }
    : { open: 0, overdue: 0, blocked: 0 };

  const selectedComplianceAlerts = selectedPositionId
    ? positionComplianceAlerts.get(selectedPositionId) ?? 0
    : 0;

  const selectedNodeState: PositionNodeComputedState = selectedPositionId
    ? resolvePositionNodeState(selectedPositionId)
    : "vacant";
  const selectedNodeStateUi = statePresentation(selectedNodeState);

  const selectedPositionOwnership = selectedPositionId
    ? positionOwnershipMap.get(selectedPositionId) ?? null
    : null;
  const selectedTeamOwnership = selectedPosition?.teamId
    ? teamOwnershipMap.get(selectedPosition.teamId) ?? null
    : null;


  async function handleSaveAssignment() {
    if (!organizationId || !selectedPositionId || !assignmentDraftEmployeeId) return;

    const selectedEmployee = personMap.get(assignmentDraftEmployeeId);
    if (!selectedEmployee) {
      setError("Selected employee could not be found.");
      return;
    }

    await runMutation(async () => {
      const currentOccupant = positionAssignmentById.get(selectedPositionId)?.person;
      if (currentOccupant && currentOccupant.id !== assignmentDraftEmployeeId) {
        await executeApiCall("Unassign current occupant", (options) =>
          updatePerson(
            organizationId,
            currentOccupant.id,
            {
              positionId: null,
            },
            options,
          ),
        );
      }

      if (selectedEmployee.positionId && selectedEmployee.positionId !== selectedPositionId) {
        await executeApiCall("Clear employee previous assignment", (options) =>
          updatePerson(
            organizationId,
            selectedEmployee.id,
            {
              positionId: null,
            },
            options,
          ),
        );
      }

      await executeApiCall("Assign employee to position", (options) =>
        updatePerson(
          organizationId,
          selectedEmployee.id,
          {
            positionId: selectedPositionId,
          },
          options,
        ),
      );
    });

    setAssignmentRuntimeByPosition((current) => ({
      ...current,
      [selectedPositionId]: {
        status: assignmentDraftStatus,
        startDate: assignmentDraftStartDate || new Date().toISOString().slice(0, 10),
        endDate: assignmentDraftEndDate,
        actualSalary: assignmentDraftActualSalary,
      },
    }));
  }

  async function handleVacateSelectedPosition() {
    if (!organizationId || !selectedPositionId) return;
    const occupant = positionAssignmentById.get(selectedPositionId)?.person;
    if (!occupant) return;

    await runMutation(async () => {
      await executeApiCall("Vacate position", (options) =>
        updatePerson(
          organizationId,
          occupant.id,
          {
            positionId: null,
          },
          options,
        ),
      );
    });

    setAssignmentRuntimeByPosition((current) => ({
      ...current,
      [selectedPositionId]: {
        status: "ended",
        startDate: current[selectedPositionId]?.startDate ?? "",
        endDate: new Date().toISOString().slice(0, 10),
        actualSalary: current[selectedPositionId]?.actualSalary ?? "",
      },
    }));
  }

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
              ownerPersonId: null,
              ownerPositionId: newActionOwnerId,
            },
            link: {
              teamId: null,
              positionId: newActionLinkId,
              personId: null,
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
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10, color: "#F8FAFC" }}>TeamFrame V1 · Execution</div>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              style={{
                width: "100%",
                textAlign: "left",
                border: "1px solid #1F2937",
                borderRadius: 8,
                padding: "8px 10px",
                marginBottom: 6,
                background: activeNav === item.id ? "#1E293B" : "#0F172A",
                color: activeNav === item.id ? "#E2E8F0" : "#94A3B8",
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
            <div
              style={{
                marginTop: 10,
                border: "1px solid #BFDBFE",
                background: "#EFF6FF",
                borderRadius: 10,
                padding: "8px 10px",
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0,1fr))",
                gap: 8,
              }}
            >
              <div>
                <div style={{ ...STYLE.subTitle, color: "#1D4ED8" }}>Execution Layer</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A8A" }}>V1 Active</div>
              </div>
              <div>
                <div style={{ ...STYLE.subTitle, color: "#1D4ED8" }}>Ownership Resolved</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A8A" }}>
                  {ownershipResolvedCount}/{actions.length || 0}
                </div>
              </div>
              <div>
                <div style={{ ...STYLE.subTitle, color: "#1D4ED8" }}>Assignment Linked</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A8A" }}>{assignmentLinkedCount}</div>
              </div>
              <div>
                <div style={{ ...STYLE.subTitle, color: "#1D4ED8" }}>Position Owned</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A8A" }}>{positionOwnedCount}</div>
              </div>
              <div>
                <div style={{ ...STYLE.subTitle, color: "#1D4ED8" }}>Person Owned</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#1E3A8A" }}>{personOwnedCount}</div>
              </div>
            </div>
            {error ? (
              <div
                style={{
                  marginTop: 10,
                  color: isLocalDemoMode ? "#92400E" : "#B91C1C",
                  fontSize: 12,
                }}
              >
                {error}
              </div>
            ) : null}
            {busy ? <div style={{ marginTop: 10, color: "#475569", fontSize: 12 }}>Saving…</div> : null}
            <div style={{ marginTop: 8, fontSize: 11, color: isLocalDemoMode ? "#92400E" : "#0F766E" }}>
              Data source: {isLocalDemoMode ? "Local demo snapshot (read-only)" : "Live API state"}
            </div>
          </section>

          {activeNav === "org" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Organization Builder · Position Node State Machine</div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
                Position is the source of truth. Click any node to manage structure, assignment, and execution context.
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "250px minmax(0, 1fr) 350px",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    ...STYLE.panel,
                    background: "#F8FAFC",
                    border: "1px solid #D8E0EC",
                    padding: 12,
                    position: "sticky",
                    top: 12,
                  }}
                >
                  <div style={{ ...STYLE.subTitle, marginBottom: 10 }}>Organization Index</div>
                  <div
                    style={{
                      border: "1px solid #DBEAFE",
                      borderRadius: 10,
                      padding: "8px 10px",
                      background: "#EFF6FF",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ ...STYLE.subTitle, color: "#1D4ED8", marginBottom: 4 }}>Selected Position</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1E3A8A" }}>
                      {selectedPosition?.title ?? "No position selected"}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 999,
                          padding: "3px 8px",
                          background: selectedNodeStateUi.bg,
                          color: selectedNodeStateUi.color,
                        }}
                      >
                        {selectedNodeStateUi.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#334155", marginTop: 6 }}>
                      Open {selectedActionStats.open} · Overdue {selectedActionStats.overdue} · Compliance {selectedComplianceAlerts}
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "8px 10px",
                      background: "#FFFFFF",
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Subtree Focus</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 3 }}>
                      {focusedSubtreeRootId
                        ? `Focused on ${positionMap.get(focusedSubtreeRootId)?.title ?? "position"}`
                        : "Full organization view"}
                    </div>
                    {focusedSubtreeRootId ? (
                      <button style={{ marginTop: 8 }} onClick={() => setFocusedSubtreeRootId(null)}>
                        Reset full view
                      </button>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {departmentOverview.map((team) => (
                      <div
                        key={team.teamId}
                        style={{
                          border: "1px solid #E2E8F0",
                          borderRadius: 10,
                          padding: "8px 10px",
                          background: "#FFFFFF",
                        }}
                      >
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{team.teamName}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          {team.positionCount} positions · {team.peopleCount} assigned
                        </div>
                      </div>
                    ))}
                    {departmentOverview.length === 0 ? (
                      <div style={{ fontSize: 11, color: "#64748B" }}>No department structure available.</div>
                    ) : null}
                  </div>
                </div>

                <div
                  style={{
                    ...STYLE.panel,
                    border: "1px solid #D8E0EC",
                    background: "linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)",
                    minHeight: 600,
                  }}
                >
                  <div style={{ ...STYLE.subTitle, marginBottom: 10 }}>Org Chart Canvas</div>
                  <div style={{ fontSize: 11, color: "#64748B", marginBottom: 12 }}>
                    {focusedSubtreeRootId
                      ? `Focused subtree root: ${positionMap.get(focusedSubtreeRootId)?.title ?? "Unknown"}`
                      : "Displaying full recursive position tree"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", minHeight: 520 }}>
                    {rootPositions.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#64748B" }}>No positions yet. Create a root position to start.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
                        {rootPositions.map((position) => renderPositionNode(position.id))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ ...STYLE.panel, border: "1px solid #D8E0EC", position: "sticky", top: 12 }}>
                  <div style={{ ...STYLE.subTitle, marginBottom: 8 }}>Position Context Panel</div>
                  {!selectedPosition ? (
                    <div style={{ fontSize: 12, color: "#64748B" }}>Select a position from the org chart.</div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{selectedPosition.title}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          Department: {selectedPosition.teamId ? teamMap.get(selectedPosition.teamId)?.name ?? "Unassigned" : "Unassigned"}
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 6, marginBottom: 10 }}>
                        <button
                          onClick={() => setPositionPanelTab("position")}
                          style={{
                            fontSize: 11,
                            background: positionPanelTab === "position" ? "#E2E8F0" : "#FFFFFF",
                            border: "1px solid #CBD5E1",
                            padding: "5px 6px",
                          }}
                        >
                          Position
                        </button>
                        <button
                          onClick={() => setPositionPanelTab("assignment")}
                          style={{
                            fontSize: 11,
                            background: positionPanelTab === "assignment" ? "#E2E8F0" : "#FFFFFF",
                            border: "1px solid #CBD5E1",
                            padding: "5px 6px",
                          }}
                        >
                          Assignment
                        </button>
                        <button
                          onClick={() => setPositionPanelTab("operations")}
                          style={{
                            fontSize: 11,
                            background: positionPanelTab === "operations" ? "#E2E8F0" : "#FFFFFF",
                            border: "1px solid #CBD5E1",
                            padding: "5px 6px",
                          }}
                        >
                          Operations
                        </button>
                      </div>

                      {positionPanelTab === "position" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Job description</label>
                          <textarea
                            value={getPositionBlueprint(selectedPosition).jobDescription}
                            onChange={(event) =>
                              setPositionBlueprintField(
                                selectedPosition.id,
                                "jobDescription",
                                event.target.value,
                              )
                            }
                            rows={4}
                            style={{ width: "100%", resize: "vertical" }}
                          />

                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Salary band</label>
                          <input
                            value={getPositionBlueprint(selectedPosition).salaryBand}
                            onChange={(event) =>
                              setPositionBlueprintField(
                                selectedPosition.id,
                                "salaryBand",
                                event.target.value,
                              )
                            }
                            placeholder="e.g. 40k-55k"
                            style={{ width: "100%" }}
                          />

                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Role requirements</label>
                          <textarea
                            value={getPositionBlueprint(selectedPosition).requirements}
                            onChange={(event) =>
                              setPositionBlueprintField(
                                selectedPosition.id,
                                "requirements",
                                event.target.value,
                              )
                            }
                            rows={3}
                            style={{ width: "100%", resize: "vertical" }}
                          />

                          <div style={{ fontSize: 11, color: "#64748B" }}>
                            Module 1 note: this metadata is held in local session state pending backend fields.
                          </div>
                        </div>
                      ) : null}

                      {positionPanelTab === "assignment" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Assigned employee</label>
                          <select
                            value={assignmentDraftEmployeeId}
                            onChange={(event) => setAssignmentDraftEmployeeId(event.target.value)}
                            style={{ width: "100%" }}
                          >
                            <option value="">Select employee</option>
                            {people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.fullName}
                              </option>
                            ))}
                          </select>

                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Assignment status</label>
                          <select
                            value={assignmentDraftStatus}
                            onChange={(event) =>
                              setAssignmentDraftStatus(event.target.value as AssignmentRuntimeStatus)
                            }
                            style={{ width: "100%" }}
                          >
                            <option value="active">Active</option>
                            <option value="interim">Interim</option>
                          </select>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Start date</label>
                              <input
                                type="date"
                                value={assignmentDraftStartDate}
                                onChange={(event) => setAssignmentDraftStartDate(event.target.value)}
                                style={{ width: "100%" }}
                              />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>End date</label>
                              <input
                                type="date"
                                value={assignmentDraftEndDate}
                                onChange={(event) => setAssignmentDraftEndDate(event.target.value)}
                                style={{ width: "100%" }}
                              />
                            </div>
                          </div>

                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>Actual salary (optional)</label>
                          <input
                            value={assignmentDraftActualSalary}
                            onChange={(event) => setAssignmentDraftActualSalary(event.target.value)}
                            placeholder="e.g. 52,000"
                            style={{ width: "100%" }}
                          />

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button
                              onClick={() => void handleSaveAssignment()}
                              disabled={isLocalDemoMode || !assignmentDraftEmployeeId}
                            >
                              Save assignment
                            </button>
                            <button
                              onClick={() => void handleVacateSelectedPosition()}
                              disabled={isLocalDemoMode || !selectedAssignment}
                            >
                              Mark vacant
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {positionPanelTab === "operations" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            Actions open: <strong>{selectedActionStats.open}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            Overdue actions: <strong>{selectedActionStats.overdue}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            Blocked actions: <strong>{selectedActionStats.blocked}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            Compliance alerts: <strong>{selectedComplianceAlerts}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            Position owner: {selectedPositionOwnership
                              ? ownerLabel(
                                  selectedPositionOwnership.ownerPersonId,
                                  selectedPositionOwnership.ownerPositionId,
                                )
                              : "Unassigned"}
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            Team owner: {selectedTeamOwnership
                              ? ownerLabel(
                                  selectedTeamOwnership.ownerPersonId,
                                  selectedTeamOwnership.ownerPositionId,
                                )
                              : "Unassigned"}
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            Direct contact: {selectedAssignment?.person.email ?? "No email"} · {selectedAssignment?.person.phone ?? "No phone"}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                            <button
                              onClick={() => {
                                setActiveNav("actions");
                                setNewActionOwnerId(selectedPosition.id);
                                setNewActionLinkId(selectedPosition.id);
                              }}
                            >
                              Create linked action
                            </button>
                            <button onClick={() => setFocusedSubtreeRootId(selectedPosition.id)}>
                              Focus subtree
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <details style={{ marginTop: 12 }}>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: 10,
                  }}
                >
                  Organization Builder controls
                </summary>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                  <div style={STYLE.panel}>
                    <div style={STYLE.subTitle}>Department + Position Setup</div>
                    <div
                      style={{
                        fontSize: 11,
                        color: isLocalDemoMode ? "#92400E" : "#64748B",
                        marginBottom: 8,
                      }}
                    >
                      {isLocalDemoMode
                        ? "Local demo mode is read-only. Connect API mode to persist changes."
                        : "Use this to build department hierarchy and reporting lines."}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Create Department
                      </div>
                      <input
                        value={newTeamName}
                        onChange={(event) => setNewTeamName(event.target.value)}
                        placeholder="Department name"
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <select
                        value={newTeamParentId}
                        onChange={(event) => setNewTeamParentId(event.target.value)}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <option value="">No parent department</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => void handleCreateTeam()} disabled={isLocalDemoMode}>
                        Add Department
                      </button>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Create Position
                      </div>
                      <input
                        value={newPositionTitle}
                        onChange={(event) => setNewPositionTitle(event.target.value)}
                        placeholder="Position title"
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <select
                        value={newPositionTeamId}
                        onChange={(event) => setNewPositionTeamId(event.target.value)}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <option value="">No department</option>
                        {teams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newPositionReportsToId}
                        onChange={(event) => setNewPositionReportsToId(event.target.value)}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <option value="">No manager (root position)</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.title}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => void handleCreatePosition()} disabled={isLocalDemoMode}>
                        Add Position
                      </button>
                    </div>
                  </div>

                  <div style={STYLE.panel}>
                    <div style={STYLE.subTitle}>Employee Setup</div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Create Employee
                      </div>
                      <input
                        value={newPersonName}
                        onChange={(event) => setNewPersonName(event.target.value)}
                        placeholder="Full name"
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <input
                        value={newPersonEmail}
                        onChange={(event) => setNewPersonEmail(event.target.value)}
                        placeholder="Email"
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <input
                        value={newPersonPhone}
                        onChange={(event) => setNewPersonPhone(event.target.value)}
                        placeholder="Phone"
                        style={{ width: "100%", marginBottom: 6 }}
                      />
                      <select
                        value={newPersonPositionId}
                        onChange={(event) => setNewPersonPositionId(event.target.value)}
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <option value="">No initial position</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.id}>
                            {position.title}
                          </option>
                        ))}
                      </select>
                      <select
                        value={newPersonStatus}
                        onChange={(event) =>
                          setNewPersonStatus(event.target.value as typeof newPersonStatus)
                        }
                        style={{ width: "100%", marginBottom: 6 }}
                      >
                        <option value={EmploymentStatus.active}>Active</option>
                        <option value={EmploymentStatus.on_leave}>On leave</option>
                        <option value={EmploymentStatus.offboarding}>Offboarding</option>
                      </select>
                      <button onClick={() => void handleCreatePerson()} disabled={isLocalDemoMode}>
                        Add Employee
                      </button>
                    </div>

                    <div style={{ fontSize: 11, color: "#64748B" }}>
                      Use the node quick actions or Assignment tab for reassignments.
                    </div>
                  </div>
                </div>
              </details>
            </section>
          )}

          {activeNav === "actions" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Actions (execution layer)</div>

              <div style={{ ...STYLE.panel, marginBottom: 12 }}>
                <div style={STYLE.subTitle}>Create Action</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
                  <input value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)} placeholder="Action title" />
                  <input type="date" value={newActionDueDate} onChange={(e) => setNewActionDueDate(e.target.value)} />
                  <select value={newActionOwnerId} onChange={(e) => setNewActionOwnerId(e.target.value)}>
                    <option value="">Decision owner position</option>
                    {decisionMakerPositions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                  <select value={newActionLinkId} onChange={(e) => setNewActionLinkId(e.target.value)}>
                    <option value="">Linked position</option>
                    {decisionMakerPositions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
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
                        <div style={{ fontSize: 11, color: "#1D4ED8", marginTop: 2 }}>
                          Path: {item.assignmentId ? "assignment > person > position" : item.ownerPersonId ? "person > position fallback" : "position structural"}
                          {item.assignmentId ? ` · Assignment ${item.assignmentId.slice(0, 8)}` : ""}
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
