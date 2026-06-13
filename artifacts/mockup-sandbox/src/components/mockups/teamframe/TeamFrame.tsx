import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, UserCheck, FileText } from "lucide-react";
import { AppShell, type NavId as ShellNavId } from "./AppShell";
import { LoadingScreen } from "./LoadingScreen";
import { EmptyOrgGuide } from "./EmptyOrgGuide";
import { OrgReadyBanner } from "./OrgReadyBanner";
import { OrgHealthSummary } from "./OrgHealthSummary";
import { DrillDownPanel, type DrillDownMode } from "./DrillDownPanel";
import { SetupProgressCard } from "./SetupProgressCard";
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
  listAssignments,
  startAssignment,
  endAssignment,
  transferAssignment,
  resetOrganizationDemoState,
  setBaseUrl,
  transitionActionStatus,
  updatePosition,
  type Action,
  type Assignment,
  type Organization,
  type Person,
  type Policy,
  type Position,
  type PositionOwnership,
  type Team,
  type TeamOwnership,
} from "@workspace/api-client-react";
import { UI_TERMS } from "./ui-terms";

type NavId = ShellNavId;
type OwnerType = "person" | "position";
type PositionLevel = "Executive" | "Director" | "Manager" | "IC";
type PositionPanelTab = "position" | "assignment" | "documents";
type AssignmentRuntimeStatus = "active" | "scheduled" | "ended";

const ACTOR = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "operator@teamframe.local",
  name: "TeamFrame Operator",
};

const STYLE = {
  page: {
    minHeight: "100vh",
    background: "#F1F5F9",
    color: "#0F172A",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  } as const,
  shell: {
    maxWidth: 1540,
    margin: "0 auto",
    padding: 20,
    display: "grid",
    gridTemplateColumns: "176px 1fr",
    gap: 14,
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
    padding: 12,
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

function createIdempotencyKey(prefix: string): string {
  const nonce =
    typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${nonce}`;
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
  people: Array<Person & { positionId?: string | null }>;
  assignments: Assignment[];
  actions: Action[];
  policies: Policy[];
  teamOwnerships: TeamOwnership[];
  positionOwnerships: PositionOwnership[];
};

type AssignmentRuntime = {
  status: AssignmentRuntimeStatus;
  startDate: string;
  endDate: string;
  actualSalary: string;
};

type UploadedPositionDocument = {
  fileName: string;
  uploadedAt: string;
  sizeLabel: string;
  objectUrl: string;
  state: "draft" | "in_review" | "signed" | "outdated";
};

type PositionNodeComputedState = "filled" | "vacant" | "needs_attention";

type OrgCardForbiddenFields = {
  dates?: never;
  assignmentType?: never;
  documents?: never;
  notes?: never;
  signatures?: never;
  kpis?: never;
};

type OrgCardContract = OrgCardForbiddenFields & {
  department: string;
  positionTitle: string;
  personLine: string;
  statusLabel: string;
  statusBg: string;
  statusColor: string;
  isSelected: boolean;
  isRoot: boolean;
  onSelect: () => void;
};

function OrgChartNodeCard(props: OrgCardContract) {
  if (import.meta.env.DEV) {
    const forbiddenFields = ["dates", "kpis", "documents", "notes", "signatures"] as const;
    for (const field of forbiddenFields) {
      if ((props as Record<string, unknown>)[field] !== undefined) {
        console.warn(`Org card contract violation: ${field} is forbidden.`);
      }
    }
  }

  const {
    department,
    positionTitle,
    personLine,
    statusLabel,
    statusBg,
    statusColor,
    isSelected,
    isRoot,
    onSelect,
  } = props;

  return (
    <button
      type="button"
      title={UI_TERMS.feedback.hover.viewDetails}
      onClick={onSelect}
      style={{
        width: "100%",
        maxWidth: isRoot ? 316 : 276,
        border: `${isSelected ? 2 : 1}px solid ${isSelected ? "#2563EB" : "#D1D5DB"}`,
        borderRadius: 12,
        padding: isRoot ? 14 : 12,
        background: "#FFFFFF",
        boxShadow: isSelected
          ? "0 0 0 3px rgba(37,99,235,0.2), 0 14px 26px rgba(15,23,42,0.16)"
          : "0 4px 10px rgba(15,23,42,0.05)",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 10, color: "#64748B", textTransform: "uppercase", fontWeight: 700 }}>
          {department}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            borderRadius: 999,
            padding: "2px 7px",
            background: statusBg,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>
      <div
        style={{
          fontSize: isRoot ? 16 : 14,
          fontWeight: 800,
          color: "#0F172A",
          marginBottom: 6,
          lineHeight: 1.25,
        }}
      >
        {positionTitle}
      </div>
      <div style={{ fontSize: 11, color: "#334155", fontWeight: 500 }}>{personLine}</div>
    </button>
  );
}

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
  assignments: [
    {
      id: "31000000-0000-4000-8000-000000000001",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000001",
      positionId: "20000000-0000-4000-8000-000000000001",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000002",
      positionId: "20000000-0000-4000-8000-000000000002",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000003",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000003",
      positionId: "20000000-0000-4000-8000-000000000003",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000004",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000004",
      positionId: "20000000-0000-4000-8000-000000000004",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000005",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000005",
      positionId: "20000000-0000-4000-8000-000000000005",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000006",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000006",
      positionId: "20000000-0000-4000-8000-000000000006",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000007",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000007",
      positionId: "20000000-0000-4000-8000-000000000007",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "31000000-0000-4000-8000-000000000008",
      organizationId: "00000000-0000-4000-8000-000000000111",
      personId: "30000000-0000-4000-8000-000000000008",
      positionId: "20000000-0000-4000-8000-000000000008",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null,
      status: "active",
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
    assignments: LOCAL_DEMO_STATE.assignments.map((item) => ({ ...item })),
    actions: LOCAL_DEMO_STATE.actions.map((item) => ({ ...item })),
    policies: LOCAL_DEMO_STATE.policies.map((item) => ({ ...item })),
    teamOwnerships: LOCAL_DEMO_STATE.teamOwnerships.map((item) => ({ ...item })),
    positionOwnerships: LOCAL_DEMO_STATE.positionOwnerships.map((item) => ({ ...item })),
  };
}

export function TeamFrame() {
  const [activeNav, setActiveNav] = useState<NavId>("org");
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgNameDraft, setOrgNameDraft] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoResetSummary, setDemoResetSummary] = useState<string>("");
  const [isLocalDemoMode, setIsLocalDemoMode] = useState(false);
  const [focusPositionId, setFocusPositionId] = useState<string | null>(null);
  const [hoveredPositionId, setHoveredPositionId] = useState<string | null>(null);

  const [mutationStatusText, setMutationStatusText] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<
    { message: string; tone: "success" | "error" | "info" } | null
  >(null);
  const [showOrgReadyBanner, setShowOrgReadyBanner] = useState(false);
  const [prevPositionCount, setPrevPositionCount] = useState(0);
  const [prevFilledCount, setPrevFilledCount] = useState(0);
  const assignPersonSelectRef = useRef<HTMLSelectElement>(null);

  // Flow #3: drill-down panel + setup progress card
  const [drillDownMode, setDrillDownMode] = useState<DrillDownMode>(null);
  const [showSetupProgress, setShowSetupProgress] = useState(false);
  const [setupProgressPositionId, setSetupProgressPositionId] = useState<string | null>(null);

  const [teams, setTeams] = useState<Team[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [people, setPeople] = useState<Array<Person & { positionId?: string | null }>>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [teamOwnerships, setTeamOwnerships] = useState<TeamOwnership[]>([]);
  const [positionOwnerships, setPositionOwnerships] = useState<PositionOwnership[]>([]);

  const [assignmentRuntimeByPosition, setAssignmentRuntimeByPosition] = useState<Record<string, AssignmentRuntime>>({});
  const [positionDocuments, setPositionDocuments] = useState<Record<string, UploadedPositionDocument>>({});
  const [positionPanelTab, setPositionPanelTab] = useState<PositionPanelTab>("position");
  const [focusedSubtreeRootId, setFocusedSubtreeRootId] = useState<string | null>(null);

  const [assignmentDraftEmployeeId, setAssignmentDraftEmployeeId] = useState<string>("");
  const [assignmentDraftStatus, setAssignmentDraftStatus] = useState<AssignmentRuntimeStatus>("active");
  const [assignmentDraftStartDate, setAssignmentDraftStartDate] = useState("");
  const [assignmentDraftEndDate, setAssignmentDraftEndDate] = useState("");
  const [assignmentDraftActualSalary, setAssignmentDraftActualSalary] = useState("");

  // Inline structure editors (replace window.prompt for B3/B4)
  const [quickInsert, setQuickInsert] = useState<{
    mode: "above" | "below" | "parallel";
    title: string;
  } | null>(null);
  const [editingReportingLine, setEditingReportingLine] = useState(false);
  const [reportingLineDraftId, setReportingLineDraftId] = useState<string>("");

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

  const activeAssignments = useMemo(
    () => assignments.filter((item) => item.status === "active"),
    [assignments],
  );

  const activeAssignmentByPersonId = useMemo(() => {
    const map = new Map<string, Assignment>();
    for (const assignment of activeAssignments) {
      map.set(assignment.personId, assignment);
    }
    return map;
  }, [activeAssignments]);

  const peopleByPosition = useMemo(() => {
    const map = new Map<string, Person[]>();
    for (const assignment of activeAssignments) {
      const person = personMap.get(assignment.personId);
      if (!person) continue;
      const bucket = map.get(assignment.positionId) ?? [];
      bucket.push(person);
      map.set(assignment.positionId, bucket);
    }
    return map;
  }, [activeAssignments, personMap]);

  const positionAssignmentById = useMemo(() => {
    const map = new Map<string, { person: Person; assignment: Assignment; runtime: AssignmentRuntime }>();
    for (const assignment of activeAssignments) {
      const person = personMap.get(assignment.personId);
      if (!person) continue;
      const runtime = assignmentRuntimeByPosition[assignment.positionId] ?? {
        status: assignment.status,
        startDate: formatDateLabel(assignment.startedAt?.toString()),
        endDate: formatDateLabel(assignment.endedAt?.toString() ?? ""),
        actualSalary: "",
      };
      map.set(assignment.positionId, { person, assignment, runtime });
    }
    return map;
  }, [activeAssignments, assignmentRuntimeByPosition, personMap]);

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

  const selectedPositionId = focusPositionId ?? positionsByManager.get("root")?.[0]?.id ?? null;
  const selectedPosition = selectedPositionId ? positionMap.get(selectedPositionId) ?? null : null;
  const selectedAssignment = selectedPositionId
    ? positionAssignmentById.get(selectedPositionId) ?? null
    : null;

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const kb = Math.round(bytes / 1024);
    if (kb < 1024) return `${kb} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function handleUploadPositionDocument(positionId: string, file: File | null) {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setPositionDocuments((current) => {
      const previous = current[positionId];
      if (previous) URL.revokeObjectURL(previous.objectUrl);
      return {
        ...current,
        [positionId]: {
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          sizeLabel: formatFileSize(file.size),
          objectUrl,
          state: "draft",
        },
      };
    });
  }

  function updatePositionDocumentState(
    positionId: string,
    nextState: UploadedPositionDocument["state"],
  ) {
    setPositionDocuments((current) => {
      const existing = current[positionId];
      if (!existing) return current;
      return {
        ...current,
        [positionId]: {
          ...existing,
          state: nextState,
        },
      };
    });
  }

  function downloadJobDescriptionTemplate(context?: {
    positionName: string;
    departmentName: string;
    reportingLine: string;
  }) {
    const positionName = context?.positionName ?? "[Position Name]";
    const departmentName = context?.departmentName ?? "[Department]";
    const reportingLine = context?.reportingLine ?? "[Reporting Line]";

    const wordHtml = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Job Description</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; margin: 36px; color: #111827; }
    h1 { margin: 0 0 10px 0; font-size: 24px; }
    .row { margin: 6px 0; }
    .section-title { margin-top: 16px; font-weight: 700; }
    .line-box { border: 1px solid #D1D5DB; min-height: 72px; margin-top: 6px; padding: 8px; }
    .signatures { margin-top: 24px; display: table; width: 100%; }
    .sig-cell { display: table-cell; width: 50%; padding-right: 18px; vertical-align: top; }
    .sig-line { border-top: 1px solid #111827; margin-top: 42px; padding-top: 6px; }
  </style>
</head>
<body>
  <h1>Job Description</h1>
  <div class="row"><strong>Name of position:</strong> ${positionName}</div>
  <div class="row"><strong>Department:</strong> ${departmentName}</div>
  <div class="row"><strong>Reporting line:</strong> ${reportingLine}</div>
  <div class="row"><strong>Location:</strong> __________________________________</div>
  <div class="row"><strong>Date prepared:</strong> ____________________________</div>

  <div class="section-title">Objective</div>
  <div class="line-box"></div>

  <div class="section-title">Key responsibilities</div>
  <div class="line-box"></div>

  <div class="section-title">KPIs</div>
  <div class="line-box"></div>

  <div class="signatures">
    <div class="sig-cell">
      <div class="sig-line"><strong>Signed by MANAGER</strong></div>
    </div>
    <div class="sig-cell">
      <div class="sig-line"><strong>Acknowledged by EMPLOYEE</strong></div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([wordHtml], { type: "application/msword;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    const slug = positionName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    anchor.download = `${slug || "job-description"}-template.doc`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  useEffect(() => {
    if (positionPanelTab !== "assignment" || !selectedPositionId) return;
    setAssignmentDraftEmployeeId(selectedAssignment?.person.id ?? "");
    setAssignmentDraftStatus(selectedAssignment?.runtime.status ?? "active");
    setAssignmentDraftStartDate(selectedAssignment?.runtime.startDate ?? "");
    setAssignmentDraftEndDate(selectedAssignment?.runtime.endDate ?? "");
    setAssignmentDraftActualSalary(selectedAssignment?.runtime.actualSalary ?? "");
  }, [positionPanelTab, selectedAssignment, selectedPositionId]);

  function hasPositionStructuralIssue(positionId: string): boolean {
    const position = positionMap.get(positionId);
    if (!position) return true;

    if (position.reportsToPositionId && !positionMap.has(position.reportsToPositionId)) {
      return true;
    }

    const runtime = assignmentRuntimeByPosition[positionId];
    if (runtime?.status === "ended" && (peopleByPosition.get(positionId)?.length ?? 0) > 0) {
      return true;
    }

    return false;
  }

  function resolvePositionNodeState(positionId: string): PositionNodeComputedState {
    if (hasPositionStructuralIssue(positionId)) return "needs_attention";
    const assignment = positionAssignmentById.get(positionId);
    if (!assignment) return "vacant";
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

  function applyStateSnapshot(snapshot: Omit<LocalDemoState, "organizationId">) {
    setTeams(snapshot.teams);
    setPositions(snapshot.positions);
    setPeople(snapshot.people);
    setAssignments(snapshot.assignments);
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
      `Local demo snapshot loaded: ${snapshot.teams.length} teams, ${snapshot.positions.length} positions, ${snapshot.people.length} people, ${snapshot.assignments.length} assignments, ${snapshot.actions.length} actions, ${snapshot.policies.length} policies.`,
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

  async function loadOrganizations(): Promise<Organization[]> {
    const orgs = await executeApiCall("Load organizations", (options) => listOrganizations(options));
    setOrganizations(orgs.items);
    return orgs.items;
  }

  async function bootstrapOrganizationContext(): Promise<string> {
    const orgs = await executeApiCall("Load organizations", (options) => listOrganizations(options));
    setOrganizations(orgs.items);
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
      setOrganizations((current) => [...current, created]);
    }

    return orgId;
  }

  async function handleSelectOrganization(targetOrganizationId: string) {
    if (!targetOrganizationId || targetOrganizationId === organizationId) return;
    setLoading(true);
    setError(null);
    try {
      setOrganizationId(targetOrganizationId);
      await loadOrganizationState(targetOrganizationId);
      setActiveNav("org");
    } catch (error) {
      setError(describeError("Switch organization", error));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateOrganization(name: string) {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Organization name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await executeApiCall("Create organization", (options) =>
        createOrganization({ name: cleanName, slug: defaultOrgSlug() }, options),
      );
      await loadOrganizations();
      setOrgNameDraft("");
      setOrganizationId(created.id);
      await loadOrganizationState(created.id);
      setActiveNav("org");
      setFeedbackToast({ tone: "success", message: `Created "${cleanName}"` });
    } catch (error) {
      setError(describeError("Create organization", error));
    } finally {
      setLoading(false);
    }
  }

  async function loadOrganizationState(targetOrganizationId: string) {
    const [teamData, positionData, peopleData, assignmentData, actionData, policyData, teamOwnerData, positionOwnerData] =
      await Promise.all([
        executeApiCall("Load teams", (options) => listTeams(targetOrganizationId, options)),
        executeApiCall("Load positions", (options) => listPositions(targetOrganizationId, options)),
        executeApiCall("Load people", (options) => listPeople(targetOrganizationId, options)),
        executeApiCall("Load assignments", (options) => listAssignments(targetOrganizationId, options)),
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
      assignments: assignmentData.items,
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
    if (!feedbackToast) return;
    const timeoutId = window.setTimeout(() => {
      setFeedbackToast(null);
    }, 2600);
    return () => window.clearTimeout(timeoutId);
  }, [feedbackToast]);

  useEffect(() => {
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
    setBaseUrl(apiBase ? apiBase : null);

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const orgs = await loadOrganizations();
        if (cancelled) return;
        const firstOrgId = orgs[0]?.id ?? null;
        setOrganizationId(firstOrgId);
        if (firstOrgId) {
          await loadOrganizationState(firstOrgId);
        }
      } catch (error) {
        if (!cancelled) {
          setError(describeError("Bootstrap", error));
          setDemoResetSummary("");
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

  async function runMutation(
    task: () => Promise<void>,
    options?: {
      successMessage?: string;
      loadingMessage?: string;
      failureMessage?: string;
    },
  ) {
    if (isLocalDemoMode) {
      setError(UI_TERMS.errors.localDemoReadonly);
      setFeedbackToast({ message: UI_TERMS.errors.changesNotSaved, tone: "error" });
      return;
    }

    setBusy(true);
    setError(null);
    setMutationStatusText(options?.loadingMessage ?? UI_TERMS.feedback.loading.syncingChanges);
    try {
      await task();
      await refreshState();
      if (options?.successMessage) {
        setFeedbackToast({ message: options.successMessage, tone: "success" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setError(message);
      setFeedbackToast({
        message: options?.failureMessage ?? UI_TERMS.errors.cannotUpdateStructure,
        tone: "error",
      });
    } finally {
      setBusy(false);
      setMutationStatusText(null);
    }
  }

  async function handleQuickInsertPosition(
    mode: "above" | "below" | "parallel",
    targetPositionId: string,
    title: string,
  ) {
    if (!organizationId) return;
    const target = positionMap.get(targetPositionId);
    if (!target) return;

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Position title is required");
      return;
    }

    let reportsToPositionId: string | null = null;
    if (mode === "below") reportsToPositionId = target.id;
    if (mode === "parallel") reportsToPositionId = target.reportsToPositionId ?? null;
    if (mode === "above") reportsToPositionId = target.reportsToPositionId ?? null;

    await runMutation(
      async () => {
        const inserted = await executeApiCall("Create position", (options) =>
          createPosition(
            organizationId,
            {
              title: cleanTitle,
              teamId: target.teamId ?? undefined,
              reportsToPositionId: reportsToPositionId ?? undefined,
              lifecycleStatus: PositionLifecycleStatus.vacant,
            },
            options,
          ),
        );

        if (mode === "above") {
          await executeApiCall("Rewire reporting line", (options) =>
            updatePosition(
              organizationId,
              target.id,
              {
                reportsToPositionId: inserted.id,
              },
              options,
            ),
          );
        }

        setFocusPositionId(inserted.id);
        setPositionPanelTab("position");
        setQuickInsert(null);
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.updatingStructure,
        successMessage:
          mode === "above"
            ? "Position inserted above"
            : mode === "parallel"
              ? "Position inserted alongside"
              : "Position inserted below",
        failureMessage: UI_TERMS.errors.cannotUpdateStructure,
      },
    );
  }

  async function handleUpdateReportingLine(
    positionId: string,
    nextManagerId: string | null,
  ) {
    if (!organizationId) return;
    const position = positionMap.get(positionId);
    if (!position) return;

    const normalized = (nextManagerId ?? "").trim();
    if (!normalized) {
      await runMutation(
        async () => {
          await executeApiCall("Set root reporting line", (requestOptions) =>
            updatePosition(
              organizationId,
              positionId,
              {
                reportsToPositionId: null,
              },
              requestOptions,
            ),
          );
        },
        {
          loadingMessage: UI_TERMS.feedback.loading.updatingStructure,
          successMessage: UI_TERMS.feedback.success.reportingLineUpdated,
          failureMessage: UI_TERMS.errors.cannotUpdateStructure,
        },
      );
      setEditingReportingLine(false);
      return;
    }

    const nextManager = positions.find((candidate) => candidate.id === normalized);
    if (!nextManager || nextManager.id === positionId) {
      setError(UI_TERMS.errors.cannotUpdateStructure);
      return;
    }

    // Prevent loops by checking if the target manager reports into this position.
    let cursor: Position | undefined = nextManager;
    while (cursor?.reportsToPositionId) {
      if (cursor.reportsToPositionId === positionId) {
        setError(UI_TERMS.errors.cannotUpdateStructure);
        return;
      }
      cursor = positionMap.get(cursor.reportsToPositionId);
    }

    await runMutation(
      async () => {
        await executeApiCall("Update reporting line", (requestOptions) =>
          updatePosition(
            organizationId,
            positionId,
            {
              reportsToPositionId: nextManager.id,
            },
            requestOptions,
          ),
        );
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.updatingStructure,
        successMessage: UI_TERMS.feedback.success.reportingLineUpdated,
        failureMessage: UI_TERMS.errors.cannotUpdateStructure,
      },
    );
    setEditingReportingLine(false);
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
    return "Not set";
  }

  function linkLabel(action: Action): string {
    if (action.teamId) return `Team: ${teamMap.get(action.teamId)?.name ?? action.teamId}`;
    if (action.positionId) {
      return `Position: ${positionMap.get(action.positionId)?.title ?? action.positionId}`;
    }
    if (action.personId) return `Person: ${personMap.get(action.personId)?.fullName ?? action.personId}`;
    return "Unknown link";
  }

  function actionStatusLabel(status: ActionStatus): string {
    if (status === ActionStatus.in_progress) return UI_TERMS.actions.states.inProgress;
    if (status === ActionStatus.done) return UI_TERMS.actions.states.done;
    return UI_TERMS.actions.states.open;
  }

  function documentStateLabel(state: UploadedPositionDocument["state"]): string {
    if (state === "in_review") return UI_TERMS.documents.states.inReview;
    if (state === "signed") return UI_TERMS.documents.states.signed;
    if (state === "outdated") return UI_TERMS.documents.states.outdated;
    return UI_TERMS.documents.states.draft;
  }

  function statePresentation(state: PositionNodeComputedState) {
    if (state === "vacant") {
      return { label: UI_TERMS.actions.states.open, bg: "#F1F5F9", color: "#334155", border: "#CBD5E1" };
    }
    if (state === "needs_attention") {
      return { label: UI_TERMS.entities.needsAttention, bg: "#FEF3C7", color: "#92400E", border: "#F59E0B" };
    }
    return { label: "Active", bg: "#DCFCE7", color: "#166534", border: "#22C55E" };
  }

  function renderPositionNode(positionId: string) {
    const position = positionMap.get(positionId);
    if (!position) return <></>;

    const assignment = positionAssignmentById.get(positionId);
    const assignedPerson = assignment?.person ?? null;
    const children = positionsByManager.get(positionId) ?? [];
    const depth = positionDepthMap.get(positionId) ?? 2;
    const isRoot = depth === 0;
    const visibleChildren = children;
    const teamName = position.teamId ? teamMap.get(position.teamId)?.name ?? "Not set" : "Not set";
    const nodeState = resolvePositionNodeState(positionId);
    const stateUi = statePresentation(nodeState);
    const isSelected = selectedPositionId === positionId;
    const showHoverActions = hoveredPositionId === positionId;

    const cardProps = {
      department: teamName,
      positionTitle: position.title,
      personLine:
        nodeState === "needs_attention"
          ? UI_TERMS.entities.needsAttention
          : assignedPerson?.fullName ?? UI_TERMS.entities.openRole,
      statusLabel: stateUi.label,
      statusBg: stateUi.bg,
      statusColor: stateUi.color,
      isSelected,
      isRoot,
      onSelect: () => {
        setFocusPositionId(positionId);
        setPositionPanelTab("position");
      },
    } satisfies OrgCardContract;

    return (
      <div
        key={positionId}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isRoot ? 30 : depth === 1 ? 24 : 20,
          minWidth: isRoot ? 310 : 248,
        }}
      >
        <div
          style={{ position: "relative", width: "100%", maxWidth: isRoot ? 316 : 276 }}
          onMouseEnter={() => setHoveredPositionId(positionId)}
          onMouseLeave={() => setHoveredPositionId((current) => (current === positionId ? null : current))}
        >
          <OrgChartNodeCard {...cardProps} />
          {showHoverActions ? (
            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                top: "calc(100% + 6px)",
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 999,
                boxShadow: "0 8px 18px rgba(15, 23, 42, 0.14)",
                padding: "5px 8px",
                display: "flex",
                gap: 6,
                zIndex: 3,
              }}
            >
              <button
                style={{
                  fontSize: 10,
                  padding: "3px 7px",
                  borderRadius: 999,
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  fontWeight: 600,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  cardProps.onSelect();
                }}
                title={UI_TERMS.feedback.hover.viewDetails}
              >
                View details
              </button>
              <button
                style={{
                  fontSize: 10,
                  padding: "3px 7px",
                  borderRadius: 999,
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  fontWeight: 600,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setFocusPositionId(positionId);
                  setPositionPanelTab("position");
                  setEditingReportingLine(false);
                  setQuickInsert({ mode: "below", title: "" });
                }}
                title={UI_TERMS.feedback.hover.addRelatedPosition}
              >
                Add related position
              </button>
              <button
                style={{
                  fontSize: 10,
                  padding: "3px 7px",
                  borderRadius: 999,
                  border: "1px solid #CBD5E1",
                  background: "#F8FAFC",
                  fontWeight: 600,
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveNav("actions");
                  setNewActionOwnerId(positionId);
                  setNewActionLinkId(positionId);
                }}
                title={UI_TERMS.feedback.hover.createAction}
              >
                Create action
              </button>
            </div>
          ) : null}
        </div>

        {visibleChildren.length > 0 ? (
          <>
            <div style={{ width: 1, height: isRoot ? 26 : 20, background: "#CBD5E1" }} />
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: depth === 0 ? 26 : 18,
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

  const selectedPositionDocument = selectedPositionId
    ? positionDocuments[selectedPositionId] ?? null
    : null;
  const selectedHasStructuralIssue = selectedPosition
    ? hasPositionStructuralIssue(selectedPosition.id)
    : false;
  const selectedHasNoReportingLine = selectedPosition
    ? !selectedPosition.reportsToPositionId && selectedPosition.id !== organizationRootPositions[0]?.id
    : false;


  async function handleSaveAssignment() {
    if (!organizationId || !selectedPositionId || !assignmentDraftEmployeeId) return;

    const selectedEmployee = personMap.get(assignmentDraftEmployeeId);
    if (!selectedEmployee) {
      setError(UI_TERMS.errors.selectPersonToAssign);
      return;
    }

    await runMutation(
      async () => {
        const currentOccupant = positionAssignmentById.get(selectedPositionId);
        if (currentOccupant && currentOccupant.person.id !== assignmentDraftEmployeeId) {
          await executeApiCall("Vacate current occupant", (options) =>
            endAssignment(
              organizationId,
              currentOccupant.assignment.id,
              {
                idempotencyKey: createIdempotencyKey("assignment-vacate"),
              },
              options,
            ),
          );
        }

        const activePersonAssignment = activeAssignmentByPersonId.get(selectedEmployee.id);
        if (activePersonAssignment && activePersonAssignment.positionId !== selectedPositionId) {
          await executeApiCall("Transfer assignment", (options) =>
            transferAssignment(
              organizationId,
              {
                personId: selectedEmployee.id,
                toPositionId: selectedPositionId,
                idempotencyKey: createIdempotencyKey("assignment-transfer"),
              },
              options,
            ),
          );
          return;
        }

        if (!activePersonAssignment) {
          await executeApiCall("Start assignment", (options) =>
            startAssignment(
              organizationId,
              {
                personId: selectedEmployee.id,
                positionId: selectedPositionId,
                idempotencyKey: createIdempotencyKey("assignment-start"),
              },
              options,
            ),
          );
        }
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.savingAssignment,
        successMessage: UI_TERMS.feedback.success.assignmentUpdated,
        failureMessage: UI_TERMS.errors.changesNotSaved,
      },
    );

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
    const occupant = positionAssignmentById.get(selectedPositionId);
    if (!occupant) return;

    await runMutation(
      async () => {
        await executeApiCall("Vacate position", (options) =>
          endAssignment(
            organizationId,
            occupant.assignment.id,
            {
              idempotencyKey: createIdempotencyKey("assignment-vacate"),
            },
            options,
          ),
        );
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.savingAssignment,
        successMessage: UI_TERMS.feedback.success.assignmentEnded,
        failureMessage: UI_TERMS.errors.changesNotSaved,
      },
    );

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
    await runMutation(
      async () => {
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
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.updatingStructure,
        successMessage: UI_TERMS.feedback.success.structureUpdated,
      },
    );
  }

  async function handleCreatePosition() {
    if (!organizationId || !newPositionTitle.trim()) return;
    await runMutation(
      async () => {
        const created = await executeApiCall("Create position", (options) =>
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
        // Auto-focus newly created position — matches hover-insert path behaviour
        if (created?.id) {
          setFocusPositionId(created.id);
          setPositionPanelTab("position");
        }
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.updatingStructure,
        successMessage: UI_TERMS.feedback.success.positionCreated,
        failureMessage: UI_TERMS.errors.cannotUpdateStructure,
      },
    );
  }

  async function handleCreatePerson() {
    if (!organizationId || !newPersonName.trim()) return;
    await runMutation(
      async () => {
        const created = await executeApiCall("Create person", (options) =>
          createPerson(
            organizationId,
            {
              fullName: newPersonName.trim(),
              email: newPersonEmail || undefined,
              phone: newPersonPhone || undefined,
              employmentStatus: newPersonStatus,
            },
            options,
          ),
        );

        if (newPersonPositionId) {
          await executeApiCall("Start assignment", (options) =>
            startAssignment(
              organizationId,
              {
                personId: created.id,
                positionId: newPersonPositionId,
                idempotencyKey: createIdempotencyKey("assignment-start"),
              },
              options,
            ),
          );
        }

        setNewPersonName("");
        setNewPersonEmail("");
        setNewPersonPhone("");
        setNewPersonPositionId("");
        setNewPersonStatus(EmploymentStatus.active);
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.syncingChanges,
        successMessage: UI_TERMS.feedback.success.structureUpdated,
      },
    );
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
    if (!organizationId) return;
    if (!newActionTitle.trim()) {
      setError(UI_TERMS.actions.prompts.whatNeedsToBeDone);
      return;
    }
    if (!newActionOwnerId) {
      setError(UI_TERMS.errors.selectResponsibleOwner);
      return;
    }
    if (!newActionLinkId) {
      setError(UI_TERMS.errors.actionNeedsLink);
      return;
    }
    if (
      actions.some(
        (item) =>
          item.ownerPositionId === newActionOwnerId &&
          item.positionId === newActionLinkId &&
          item.status !== ActionStatus.done,
      )
    ) {
      setError(UI_TERMS.errors.actionActiveOwner);
      return;
    }

    await runMutation(
      async () => {
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
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.syncingChanges,
        successMessage: UI_TERMS.feedback.success.actionCreated,
        failureMessage: UI_TERMS.errors.changesNotSaved,
      },
    );
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

    await runMutation(
      async () => {
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
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.syncingChanges,
        successMessage: UI_TERMS.feedback.success.structureUpdated,
      },
    );
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
      setError("Local demo snapshot mode is disabled. Connect API to continue.");
      return;
    }

    await runMutation(
      async () => {
        const result = await executeApiCall("Reset demo state", (options) =>
          resetOrganizationDemoState(organizationId, options),
        );
        setDemoResetSummary(
          `Reset complete: ${result.teams} teams, ${result.positions} positions, ${result.people} people, ${result.actions} actions, ${result.policies} policies.`,
        );
      },
      {
        loadingMessage: UI_TERMS.feedback.loading.syncingChanges,
        successMessage: UI_TERMS.feedback.success.structureUpdated,
      },
    );
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
      const assignment = activeAssignmentByPersonId.get(person.id);
      const position = assignment ? positionMap.get(assignment.positionId) : null;
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

  // Trigger org-ready banner and setup progress card when positions/assignments change
  useEffect(() => {
    const currentFilled = positionAssignmentById.size;
    const currentPositions = positions.length;
    const justAddedFirstPosition = prevPositionCount === 0 && currentPositions === 1;
    const justFilledFirstPosition = prevFilledCount === 0 && currentFilled === 1;
    if (justAddedFirstPosition || justFilledFirstPosition) {
      setShowOrgReadyBanner(true);
    }
    // Show setup progress card whenever a new assignment is created (any position, not just first)
    if (currentFilled > prevFilledCount && selectedPositionId) {
      setSetupProgressPositionId(selectedPositionId);
      setShowSetupProgress(true);
    }
    setPrevPositionCount(currentPositions);
    setPrevFilledCount(currentFilled);
  }, [positions.length, positionAssignmentById.size, selectedPositionId]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isLocalDemoMode && organizations.length === 0) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#FFFFFF",
            border: "1px solid #D8E0EC",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>
            Create your first organization
          </div>
          <div style={{ fontSize: 13, color: "#64748B", marginBottom: 16 }}>
            Name the company you're setting up. You can add and switch between more
            organizations later.
          </div>
          <input
            autoFocus
            value={orgNameDraft}
            onChange={(event) => setOrgNameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && orgNameDraft.trim()) {
                void handleCreateOrganization(orgNameDraft);
              }
            }}
            placeholder="Organization name"
            style={{ width: "100%", marginBottom: 12, padding: "9px 12px" }}
          />
          <button
            onClick={() => void handleCreateOrganization(orgNameDraft)}
            disabled={!orgNameDraft.trim()}
            style={{
              width: "100%",
              background: orgNameDraft.trim() ? "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)" : "#E2E8F0",
              color: orgNameDraft.trim() ? "#FFFFFF" : "#94A3B8",
              border: "none",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 700,
              cursor: orgNameDraft.trim() ? "pointer" : "not-allowed",
            }}
          >
            Create organization
          </button>
          {error ? (
            <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 10 }}>{error}</div>
          ) : null}
        </div>
      </div>
    );
  }

  const openActions = actions.filter((item) => item.status !== ActionStatus.done).length;
  const needsAttention = overdueActions + blockedActions;
  const vacantCount = positions.length - positionAssignmentById.size;
  const totalComplianceAlerts = [...positionComplianceAlerts.values()].reduce((a, b) => a + b, 0);

  // Drill-down data — derived from existing computed state, no new fetches
  const vacancyRows = positions
    .filter((p) => !positionAssignmentById.get(p.id))
    .map((p) => ({
      positionId: p.id,
      title: p.title,
      teamName: p.teamId ? teamMap.get(p.teamId)?.name ?? null : null,
      reportsToTitle: p.reportsToPositionId
        ? positionMap.get(p.reportsToPositionId)?.title ?? null
        : null,
      vacantSince: p.updatedAt?.toString() ?? null,
    }));

  const actionRows = actions
    .filter((item) => item.status !== ActionStatus.done && (item.blocked || (() => {
      if (!item.dueDate) return false;
      const due = new Date(item.dueDate).getTime();
      return !Number.isNaN(due) && due < Date.now();
    })()))
    .map((item) => ({
      actionId: item.id,
      title: item.title,
      ownerName: item.ownerPersonId ? people.find((p) => p.id === item.ownerPersonId)?.fullName ?? null : null,
      positionTitle: item.positionId ? positionMap.get(item.positionId)?.title ?? null : null,
      dueDate: item.dueDate?.toString() ?? null,
      status: item.status,
      overdue: !!item.dueDate && (() => {
        const due = new Date(item.dueDate!).getTime();
        return !Number.isNaN(due) && due < Date.now();
      })(),
      blocked: item.blocked ?? false,
    }));

  // Include all open actions when drill-down opened (not just urgent ones)
  const actionRowsAll = actions
    .filter((item) => item.status !== ActionStatus.done)
    .map((item) => ({
      actionId: item.id,
      title: item.title,
      ownerName: item.ownerPersonId ? people.find((p) => p.id === item.ownerPersonId)?.fullName ?? null : null,
      positionTitle: item.positionId ? positionMap.get(item.positionId)?.title ?? null : null,
      dueDate: item.dueDate?.toString() ?? null,
      status: item.status,
      overdue: !!item.dueDate && (() => {
        const due = new Date(item.dueDate!).getTime();
        return !Number.isNaN(due) && due < Date.now();
      })(),
      blocked: item.blocked ?? false,
    }))
    .sort((a, b) => {
      if (a.overdue && !b.overdue) return -1;
      if (!a.overdue && b.overdue) return 1;
      if (a.blocked && !b.blocked) return -1;
      if (!a.blocked && b.blocked) return 1;
      return 0;
    });

  const complianceRows = positions
    .filter((p) => (positionComplianceAlerts.get(p.id) ?? 0) > 0)
    .map((p) => {
      const assignment = positionAssignmentById.get(p.id);
      return {
        positionId: p.id,
        positionTitle: p.title,
        personName: assignment?.person.fullName ?? "Unknown",
        missingEmail: !assignment?.person.email,
        missingPhone: !assignment?.person.phone,
      };
    });

  // Setup progress for card
  const progressPositionDoc = setupProgressPositionId
    ? positionDocuments[setupProgressPositionId]
    : null;
  const progressHasEvidence = !!progressPositionDoc && progressPositionDoc.state === "signed";
  const progressHasAssignment = setupProgressPositionId
    ? !!positionAssignmentById.get(setupProgressPositionId)
    : false;
  const progressPositionTitle = setupProgressPositionId
    ? positionMap.get(setupProgressPositionId)?.title ?? ""
    : "";
  const totalSigned = Object.values(positionDocuments).filter((d) => d.state === "signed").length;
  const compliancePct = positions.length > 0
    ? Math.round((totalSigned / positions.length) * 100)
    : 0;

  return (
    <AppShell
      activeNav={activeNav}
      onNavChange={setActiveNav}
      health={[
        { label: "positions", value: positions.length },
        {
          label: "filled",
          value: positionAssignmentById.size,
        },
        {
          label: "vacant",
          value: vacantCount,
          onClick: vacantCount > 0 ? () => setDrillDownMode("vacancies") : undefined,
        },
        {
          label: "open actions",
          value: openActions,
          onClick: openActions > 0 ? () => setDrillDownMode("actions") : undefined,
        },
        {
          label: "needs attention",
          value: needsAttention,
          urgent: true,
          onClick: needsAttention > 0 ? () => setDrillDownMode("actions") : undefined,
        },
      ]}
      statusMessage={mutationStatusText}
      errorMessage={error}
      isDemoMode={isLocalDemoMode}
      organizations={organizations.map((org) => ({ id: org.id, name: org.name }))}
      activeOrganizationId={organizationId}
      onSelectOrganization={isLocalDemoMode ? undefined : (id) => void handleSelectOrganization(id)}
      onCreateOrganization={isLocalDemoMode ? undefined : (name) => void handleCreateOrganization(name)}
    >
      {showOrgReadyBanner && (
        <OrgReadyBanner
          positionCount={positions.length}
          filledCount={positionAssignmentById.size}
          onAssignPerson={() => {
            // Deep-link: ensure org nav is active, panel is open on Assignment tab, first field focused
            setActiveNav("org");
            setPositionPanelTab("assignment");
            setShowOrgReadyBanner(false);
            // Defer focus until after render cycle
            setTimeout(() => {
              assignPersonSelectRef.current?.focus();
            }, 80);
          }}
          onDismiss={() => setShowOrgReadyBanner(false)}
        />
      )}

      {/* Flow #3 — Drill-down panel (vacancy / actions / compliance) */}
      <DrillDownPanel
        mode={drillDownMode}
        onClose={() => setDrillDownMode(null)}
        vacancies={vacancyRows}
        actions={actionRowsAll}
        compliance={complianceRows}
        onSelectPosition={(positionId) => {
          setActiveNav("org");
          setFocusPositionId(positionId);
          setPositionPanelTab("position");
        }}
      />

      {/* Flow #3 — Setup progress card (evidence completion guidance) */}
      {showSetupProgress && setupProgressPositionId && (
        <SetupProgressCard
          positionTitle={progressPositionTitle}
          hasAssignment={progressHasAssignment}
          hasEvidence={progressHasEvidence}
          compliancePct={compliancePct}
          onCompleteEvidence={() => {
            setActiveNav("org");
            setFocusPositionId(setupProgressPositionId);
            setPositionPanelTab("documents");
            setShowSetupProgress(false);
          }}
          onDismiss={() => setShowSetupProgress(false)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {activeNav === "org" && (
            <>
            {/* Flow #3 — Org Health Summary (persistent, uses existing computed state only) */}
            {positions.length > 0 && (
              <OrgHealthSummary
                totalPositions={positions.length}
                filledPositions={positionAssignmentById.size}
                vacantPositions={vacantCount}
                openActions={openActions}
                overdueActions={overdueActions}
                blockedActions={blockedActions}
                complianceAlerts={totalComplianceAlerts}
                onClickVacancies={() => setDrillDownMode("vacancies")}
                onClickActions={() => setDrillDownMode("actions")}
                onClickCompliance={() => setDrillDownMode("compliance")}
              />
            )}

            <section style={STYLE.panel}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ ...STYLE.title, fontSize: 17, marginBottom: 2 }}>
                    {positions.length === 0 ? "Build your org chart" : "Org Chart"}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B" }}>
                    {positions.length === 0
                      ? "Map your team structure and track every position."
                      : `${positions.length} position${positions.length === 1 ? "" : "s"} · ${positionAssignmentById.size} filled`}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 304px",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    ...STYLE.panel,
                    border: "1px solid #D8E0EC",
                    background: "#FFFFFF",
                    minHeight: 620,
                  }}
                >
                  <div style={{ ...STYLE.subTitle, marginBottom: 8 }}>Org Chart</div>
                  <div style={{ marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      Selected: <strong>{selectedPosition?.title ?? "No position selected"}</strong>
                    </div>
                    {focusedSubtreeRootId ? (
                      <button onClick={() => setFocusedSubtreeRootId(null)}>Reset view</button>
                    ) : null}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                      alignItems: "flex-start",
                      minHeight: 560,
                      maxHeight: "70vh",
                      overflow: "auto",
                      padding: "8px 4px",
                    }}
                  >
                    {rootPositions.length === 0 ? (
                      <EmptyOrgGuide
                        disabled={isLocalDemoMode || busy}
                        onCreatePosition={() => {
                          const titleEl = document.querySelector<HTMLInputElement>('input[placeholder="Position title"]');
                          if (titleEl) titleEl.focus();
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 30,
                          alignItems: "center",
                          minWidth: "max-content",
                          margin: "0 auto",
                        }}
                      >
                        {rootPositions.map((position) => renderPositionNode(position.id))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ ...STYLE.panel, border: "1px solid #D8E0EC", position: "sticky", top: 12 }}>
                  <div style={{ ...STYLE.subTitle, marginBottom: 8 }}>{UI_TERMS.panel.positionPanel}</div>
                  {!selectedPosition ? (
                    <div
                      style={{
                        padding: "24px 16px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: "#F1F5F9",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 4,
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <rect x="7" y="2" width="4" height="4" rx="1.5" fill="#94A3B8" />
                          <rect x="2" y="12" width="4" height="4" rx="1.5" fill="#CBD5E1" />
                          <rect x="7" y="12" width="4" height="4" rx="1.5" fill="#CBD5E1" />
                          <rect x="12" y="12" width="4" height="4" rx="1.5" fill="#CBD5E1" />
                          <line x1="9" y1="6" x2="9" y2="12" stroke="#E2E8F0" strokeWidth="1.5" />
                          <line x1="4" y1="9" x2="14" y2="9" stroke="#E2E8F0" strokeWidth="1.5" />
                          <line x1="4" y1="9" x2="4" y2="12" stroke="#E2E8F0" strokeWidth="1.5" />
                          <line x1="14" y1="9" x2="14" y2="12" stroke="#E2E8F0" strokeWidth="1.5" />
                        </svg>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                        {positions.length === 0 ? "No positions yet" : "No position selected"}
                      </div>
                      <div style={{ fontSize: 11, color: "#94A3B8", lineHeight: 1.5 }}>
                        {positions.length === 0
                          ? "Create your first position to get started."
                          : "Click any node in the chart to manage it."}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{selectedPosition.title}</div>
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          Department: {selectedPosition.teamId ? teamMap.get(selectedPosition.teamId)?.name ?? "Not set" : "Not set"}
                        </div>
                      </div>

                      {/* Numbered workflow tabs — communicate intended sequence */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
                          gap: 4,
                          marginBottom: 14,
                          padding: 3,
                          background: "#F1F5F9",
                          borderRadius: 10,
                        }}
                      >
                        {(
                          [
                            { id: "position" as PositionPanelTab, step: "1", label: "Structure", Icon: LayoutGrid },
                            { id: "assignment" as PositionPanelTab, step: "2", label: "Assign", Icon: UserCheck },
                            { id: "documents" as PositionPanelTab, step: "3", label: "Evidence", Icon: FileText },
                          ] as const
                        ).map(({ id, step, label, Icon }) => {
                          const isActive = positionPanelTab === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setPositionPanelTab(id)}
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 3,
                                padding: "7px 4px",
                                border: "none",
                                borderRadius: 8,
                                background: isActive ? "#FFFFFF" : "transparent",
                                boxShadow: isActive ? "0 1px 4px rgba(15,23,42,0.08)" : "none",
                                cursor: "pointer",
                                transition: "background 0.12s",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color: isActive ? "#2563EB" : "#94A3B8",
                                    letterSpacing: "0.04em",
                                  }}
                                >
                                  {step}
                                </span>
                                <Icon
                                  size={13}
                                  color={isActive ? "#2563EB" : "#94A3B8"}
                                  strokeWidth={isActive ? 2.5 : 2}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: isActive ? 700 : 500,
                                  color: isActive ? "#0F172A" : "#64748B",
                                  letterSpacing: "0.02em",
                                }}
                              >
                                {label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {positionPanelTab === "position" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            <strong>{UI_TERMS.panel.fields.position}</strong>: {selectedPosition.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            <strong>{UI_TERMS.panel.fields.reportsTo}</strong>: {selectedPosition.reportsToPositionId
                              ? positionMap.get(selectedPosition.reportsToPositionId)?.title ?? selectedPosition.reportsToPositionId
                              : "Not set"}
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            <strong>{UI_TERMS.panel.fields.department}</strong>: {selectedPosition.teamId
                              ? teamMap.get(selectedPosition.teamId)?.name ?? selectedPosition.teamId
                              : "Not set"}
                          </div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            <strong>{UI_TERMS.panel.fields.status}</strong>: {statePresentation(resolvePositionNodeState(selectedPosition.id)).label}
                          </div>
                          {selectedHasNoReportingLine ? (
                            <div style={{ fontSize: 11, color: "#92400E" }}>
                              {UI_TERMS.warnings.noReportingLine}
                            </div>
                          ) : null}
                          {selectedHasStructuralIssue ? (
                            <div style={{ fontSize: 11, color: "#92400E" }}>
                              {UI_TERMS.warnings.structureUpdated}
                            </div>
                          ) : null}
                          {!selectedAssignment ? (
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              {UI_TERMS.warnings.currentlyUnassigned}
                            </div>
                          ) : null}
                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>{UI_TERMS.panel.fields.notes}</label>
                          <textarea placeholder="Add context" rows={2} style={{ width: "100%", resize: "vertical" }} />

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button onClick={() => { setEditingReportingLine(false); setQuickInsert({ mode: "above", title: "" }); }}>
                              Add above
                            </button>
                            <button onClick={() => { setEditingReportingLine(false); setQuickInsert({ mode: "below", title: "" }); }}>
                              Add below
                            </button>
                            <button onClick={() => { setEditingReportingLine(false); setQuickInsert({ mode: "parallel", title: "" }); }}>
                              Add parallel
                            </button>
                            <button
                              onClick={() => {
                                setQuickInsert(null);
                                setReportingLineDraftId(selectedPosition.reportsToPositionId ?? "");
                                setEditingReportingLine(true);
                              }}
                            >
                              Update reporting line
                            </button>
                            <button
                              onClick={() => void handleVacateSelectedPosition()}
                              disabled={isLocalDemoMode || !selectedAssignment}
                            >
                              Vacate position
                            </button>
                          </div>

                          {quickInsert ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                              <input
                                autoFocus
                                value={quickInsert.title}
                                onChange={(event) =>
                                  setQuickInsert({ mode: quickInsert.mode, title: event.target.value })
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && quickInsert.title.trim()) {
                                    void handleQuickInsertPosition(quickInsert.mode, selectedPosition.id, quickInsert.title);
                                  }
                                  if (event.key === "Escape") setQuickInsert(null);
                                }}
                                placeholder={`New position title (add ${quickInsert.mode})`}
                                style={{ flex: 1 }}
                              />
                              <button
                                onClick={() => void handleQuickInsertPosition(quickInsert.mode, selectedPosition.id, quickInsert.title)}
                                disabled={!quickInsert.title.trim() || isLocalDemoMode}
                              >
                                Create
                              </button>
                              <button onClick={() => setQuickInsert(null)}>Cancel</button>
                            </div>
                          ) : null}

                          {editingReportingLine ? (
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                              <select
                                value={reportingLineDraftId}
                                onChange={(event) => setReportingLineDraftId(event.target.value)}
                                style={{ flex: 1 }}
                              >
                                <option value="">No manager (root position)</option>
                                {positions
                                  .filter((candidate) => candidate.id !== selectedPosition.id)
                                  .map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                      {candidate.title}
                                    </option>
                                  ))}
                              </select>
                              <button
                                onClick={() => void handleUpdateReportingLine(selectedPosition.id, reportingLineDraftId || null)}
                                disabled={isLocalDemoMode}
                              >
                                Save
                              </button>
                              <button onClick={() => setEditingReportingLine(false)}>Cancel</button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {positionPanelTab === "assignment" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {/* Current occupant summary */}
                          {selectedAssignment ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "8px 10px",
                                background: "#F0FDF4",
                                border: "1px solid #BBF7D0",
                                borderRadius: 8,
                              }}
                            >
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  background: "#D1FAE5",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: "#059669",
                                  flexShrink: 0,
                                }}
                              >
                                {selectedAssignment.person.fullName
                                  ? selectedAssignment.person.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()
                                  : "?"}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#065F46" }}>
                                  {selectedAssignment.person.fullName ?? "Unknown"}
                                </div>
                                <div style={{ fontSize: 10, color: "#6EE7B7" }}>Active assignment</div>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                padding: "8px 10px",
                                background: "#FFFBEB",
                                border: "1px solid #FDE68A",
                                borderRadius: 8,
                                fontSize: 11,
                                color: "#92400E",
                              }}
                            >
                              This position is vacant. Assign a person below.
                            </div>
                          )}

                          {/* Person selector */}
                          <div>
                            <label
                              htmlFor="assign-person-select"
                              style={{ fontSize: 11, color: "#334155", fontWeight: 600, display: "block", marginBottom: 4 }}
                            >
                              {selectedAssignment ? "Reassign to" : "Assign person"}
                            </label>
                            <select
                              id="assign-person-select"
                              ref={assignPersonSelectRef}
                              value={assignmentDraftEmployeeId}
                              onChange={(event) => setAssignmentDraftEmployeeId(event.target.value)}
                              style={{ width: "100%" }}
                            >
                              <option value="">Select person</option>
                              {people.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.fullName}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Primary action */}
                          <button
                            type="button"
                            onClick={() => void handleSaveAssignment()}
                            disabled={isLocalDemoMode || !assignmentDraftEmployeeId}
                            style={{
                              background: !isLocalDemoMode && assignmentDraftEmployeeId
                                ? "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)"
                                : "#E2E8F0",
                              color: !isLocalDemoMode && assignmentDraftEmployeeId ? "#FFFFFF" : "#94A3B8",
                              border: "none",
                              borderRadius: 8,
                              padding: "9px 14px",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: !isLocalDemoMode && assignmentDraftEmployeeId ? "pointer" : "not-allowed",
                              boxShadow: !isLocalDemoMode && assignmentDraftEmployeeId
                                ? "0 2px 8px rgba(37,99,235,0.25)"
                                : "none",
                            }}
                          >
                            {selectedAssignment ? "Reassign person" : "Assign person"}
                          </button>

                          {/* Termination — single action, clear microcopy */}
                          {selectedAssignment && (
                            <button
                              type="button"
                              onClick={() => void handleVacateSelectedPosition()}
                              disabled={isLocalDemoMode}
                              style={{
                                background: "none",
                                border: "1px solid #E2E8F0",
                                borderRadius: 8,
                                padding: "8px 14px",
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#475569",
                                cursor: isLocalDemoMode ? "not-allowed" : "pointer",
                                textAlign: "left",
                              }}
                            >
                              <div style={{ fontWeight: 700, color: "#334155", marginBottom: 2 }}>
                                Vacate position
                              </div>
                              <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>
                                End the current assignment and make this position vacant.
                              </div>
                            </button>
                          )}
                        </div>
                      ) : null}

                      {positionPanelTab === "documents" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ fontSize: 11, color: "#334155" }}><strong>{UI_TERMS.panel.fields.roleDescription}</strong></div>
                          <div style={{ fontSize: 11, color: "#334155" }}><strong>{UI_TERMS.panel.fields.keyResponsibilities}</strong></div>
                          <div style={{ fontSize: 11, color: "#334155" }}><strong>{UI_TERMS.panel.fields.kpis}</strong></div>
                          <div style={{ fontSize: 11, color: "#334155" }}>
                            <strong>{UI_TERMS.panel.fields.signatureStatus}</strong>: {selectedPositionDocument ? documentStateLabel(selectedPositionDocument.state) : UI_TERMS.documents.states.draft}
                          </div>

                          {selectedPositionDocument ? (
                            <div style={{ border: "1px solid #CBD5E1", borderRadius: 8, background: "#F8FAFC", padding: "8px 10px" }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>{selectedPositionDocument.fileName}</div>
                              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                Uploaded {formatDateLabel(selectedPositionDocument.uploadedAt)} · {selectedPositionDocument.sizeLabel}
                              </div>
                              <select
                                style={{ marginTop: 8, width: "100%" }}
                                value={selectedPositionDocument.state}
                                onChange={(event) =>
                                  updatePositionDocumentState(
                                    selectedPosition.id,
                                    event.target.value as UploadedPositionDocument["state"],
                                  )
                                }
                              >
                                <option value="draft">{UI_TERMS.documents.states.draft}</option>
                                <option value="in_review">{UI_TERMS.documents.states.inReview}</option>
                                <option value="signed">{UI_TERMS.documents.states.signed}</option>
                                <option value="outdated">{UI_TERMS.documents.states.outdated}</option>
                              </select>
                              <button
                                style={{ marginTop: 8 }}
                                onClick={() => window.open(selectedPositionDocument.objectUrl, "_blank", "noopener,noreferrer")}
                              >
                                Open document
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#64748B" }}>
                              {UI_TERMS.documents.empty}
                            </div>
                          )}

                          <label style={{ fontSize: 11, color: "#334155", fontWeight: 600 }}>
                            {UI_TERMS.documents.upload}
                          </label>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.md,.html"
                            onChange={(event) =>
                              handleUploadPositionDocument(
                                selectedPosition.id,
                                event.target.files?.[0] ?? null,
                              )
                            }
                          />
                          <button
                            onClick={() => {
                              const reportingLine = selectedPosition.reportsToPositionId
                                ? positionMap.get(selectedPosition.reportsToPositionId)?.title ?? selectedPosition.reportsToPositionId
                                : "N/A";
                              downloadJobDescriptionTemplate({
                                positionName: selectedPosition.title,
                                departmentName: selectedPosition.teamId
                                  ? teamMap.get(selectedPosition.teamId)?.name ?? "Not set"
                                  : "Not set",
                                reportingLine,
                              });
                            }}
                          >
                            {UI_TERMS.documents.downloadTemplate}
                          </button>
                        </div>
                      ) : null}

                    </>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: 10,
                  }}
                >
                  Add Positions & People
                </div>

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
                    <div style={STYLE.subTitle}>Person Setup</div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 6 }}>
                        Create Person
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
                        Add Person
                      </button>
                    </div>

                    <div style={{ fontSize: 11, color: "#64748B" }}>
                      Use the Assignment tab to reassign people between positions.
                    </div>
                  </div>
                </div>
              </div>
            </section>
            </>
          )}

          {activeNav === "actions" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Actions</div>

              <div style={{ ...STYLE.panel, marginBottom: 12 }}>
                <div style={STYLE.subTitle}>Create Action</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
                  <input value={newActionTitle} onChange={(e) => setNewActionTitle(e.target.value)} placeholder={UI_TERMS.actions.prompts.whatNeedsToBeDone} />
                  <input type="date" value={newActionDueDate} onChange={(e) => setNewActionDueDate(e.target.value)} />
                  <select value={newActionOwnerId} onChange={(e) => setNewActionOwnerId(e.target.value)}>
                    <option value="">{UI_TERMS.actions.prompts.whoIsResponsible}</option>
                    {decisionMakerPositions.map((position) => (
                      <option key={position.id} value={position.id}>{position.title}</option>
                    ))}
                  </select>
                  <select value={newActionLinkId} onChange={(e) => setNewActionLinkId(e.target.value)}>
                    <option value="">{UI_TERMS.actions.prompts.whereDoesThisBelong}</option>
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
                        {import.meta.env.DEV ? (
                          <div style={{ fontSize: 11, color: "#1D4ED8", marginTop: 2 }}>
                            Path: {item.assignmentId ? "assignment > person > position" : item.ownerPersonId ? "person > position fallback" : "position structural"}
                            {item.assignmentId ? ` · Assignment ${item.assignmentId.slice(0, 8)}` : ""}
                          </div>
                        ) : null}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#334155", border: "1px solid #CBD5E1", borderRadius: 999, padding: "3px 8px" }}>
                          {actionStatusLabel(item.status)}
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
                {actions.length === 0 ? <div style={{ fontSize: 12, color: "#64748B" }}>{UI_TERMS.actions.empty}</div> : null}
              </div>
            </section>
          )}

          {activeNav === "templates" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Templates</div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>
                Download the standard Job Description Word document.
              </div>
              <button onClick={() => downloadJobDescriptionTemplate()}>
                {UI_TERMS.documents.downloadTemplate}
              </button>
            </section>
          )}

          {activeNav === "team" && (
            <section style={STYLE.panel}>
              <div style={{ ...STYLE.title, fontSize: 17 }}>Team Directory</div>
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
                    const assignment = activeAssignmentByPersonId.get(person.id);
                    const position = assignment ? positionMap.get(assignment.positionId) : null;
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
              <div style={{ ...STYLE.title, fontSize: 17 }}>Policies</div>

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
              <div style={{ ...STYLE.title, fontSize: 17 }}>Administration</div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 10 }}>
                Organization ID: {organizationId ?? "-"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <button onClick={downloadPayrollCsv}>Download Payroll Export</button>
                {import.meta.env.DEV ? (
                  <>
                    <button onClick={() => void handleResetDemoState()} disabled={busy}>
                      Reset Deterministic Demo
                    </button>
                    <button onClick={() => void handleInvalidOrgRecoveryCheck()} disabled={busy}>
                      Run Invalid-Org Recovery Check
                    </button>
                  </>
                ) : null}
              </div>
              {import.meta.env.DEV && demoResetSummary ? (
                <div style={{ fontSize: 12, color: "#0F172A", marginBottom: 6 }}>{demoResetSummary}</div>
              ) : null}
            </section>
          )}
      {feedbackToast ? (
        <div
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            background: feedbackToast.tone === "error" ? "#7F1D1D" : "#0F172A",
            color: "#F8FAFC",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 12,
            boxShadow: "0 14px 28px rgba(2, 6, 23, 0.25)",
            zIndex: 40,
          }}
        >
          {feedbackToast.message}
        </div>
      ) : null}
    </div>
    </AppShell>
  );
}

export default TeamFrame;
