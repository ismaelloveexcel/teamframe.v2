import { badRequest, notFound } from "../lib/http-error";
import type { ActionLinkInput, OwnershipAssignmentInput } from "../persistence/repositories";

export function toPgDate(value: Date | string | null | undefined): string | null | undefined {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

export function requireOwnershipInput(input: OwnershipAssignmentInput) {
  if (!input.ownerPersonId && !input.ownerPositionId) {
    badRequest("Owner assignment requires ownerPersonId or ownerPositionId");
  }
}

export function requireExactlyOneActionLink(input: ActionLinkInput) {
  const count = Number(Boolean(input.teamId)) +
    Number(Boolean(input.positionId)) +
    Number(Boolean(input.personId));
  if (count !== 1) {
    badRequest("Action link must target exactly one of teamId, positionId, or personId");
  }
}

export function requirePolicyScopeShape(
  scope: "organization" | "team" | "position",
  teamId: string | null,
  positionId: string | null,
) {
  if (scope === "organization" && (teamId || positionId)) {
    badRequest("Organization-scoped policy cannot target teamId or positionId");
  }
  if (scope === "team" && (!teamId || positionId)) {
    badRequest("Team-scoped policy requires teamId and no positionId");
  }
  if (scope === "position" && (!positionId || teamId)) {
    badRequest("Position-scoped policy requires positionId and no teamId");
  }
}

export function requireDefined<T>(value: T | null, message: string): T {
  if (!value) {
    notFound(message);
  }
  return value;
}
