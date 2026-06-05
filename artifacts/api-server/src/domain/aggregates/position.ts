import { InvariantViolationError, type EventEnvelope } from "../event-core";

export type PositionNode = {
  id: string;
  reportsToId: string | null;
  order: number;
};

export type PositionGraph = Map<string, PositionNode>;

export type PositionSnapshot = {
  positionId: string;
  title: string;
  teamId: string | null;
  reportsToPositionId: string | null;
  lifecycleStatus: "filled" | "vacant" | "frozen";
};

export function buildPositionGraph(nodes: PositionNode[]): PositionGraph {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function derivePositionsFromEvents(events: EventEnvelope[]): PositionSnapshot[] {
  const sorted = [...events]
    .filter((event) => event.aggregateType === "position")
    .sort((a, b) => {
      const byOccurred = a.occurredAt.localeCompare(b.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      const byVersion = a.version - b.version;
      if (byVersion !== 0) return byVersion;
      const byAggregate = a.aggregateId.localeCompare(b.aggregateId);
      if (byAggregate !== 0) return byAggregate;
      return a.eventType.localeCompare(b.eventType);
    });

  const positions = new Map<string, PositionSnapshot>();
  for (const event of sorted) {
    const payload = event.payload as Record<string, unknown>;
    const positionId = String(payload.positionId ?? payload.id ?? event.aggregateId ?? "");
    if (!positionId) continue;

    if (event.eventType === "position.deleted") {
      positions.delete(positionId);
      continue;
    }

    const existing = positions.get(positionId);
    if (event.eventType === "position.created") {
      positions.set(positionId, {
        positionId,
        title: String(payload.title ?? ""),
        teamId: (payload.teamId as string | null | undefined) ?? null,
        reportsToPositionId:
          (payload.reportsToPositionId as string | null | undefined) ??
          (payload.reportsToId as string | null | undefined) ??
          null,
        lifecycleStatus:
          (payload.lifecycleStatus as "filled" | "vacant" | "frozen" | undefined) ?? "vacant",
      });
      continue;
    }

    if (!existing) continue;
    positions.set(positionId, {
      positionId,
      title:
        Object.prototype.hasOwnProperty.call(payload, "title") ?
          String(payload.title ?? "")
        : existing.title,
      teamId:
        Object.prototype.hasOwnProperty.call(payload, "teamId") ?
          ((payload.teamId as string | null | undefined) ?? null)
        : existing.teamId,
      reportsToPositionId:
        Object.prototype.hasOwnProperty.call(payload, "reportsToPositionId") ||
          Object.prototype.hasOwnProperty.call(payload, "reportsToId") ?
          ((payload.reportsToPositionId as string | null | undefined) ??
            (payload.reportsToId as string | null | undefined) ??
            null)
        : existing.reportsToPositionId,
      lifecycleStatus:
        Object.prototype.hasOwnProperty.call(payload, "lifecycleStatus") ?
          ((payload.lifecycleStatus as "filled" | "vacant" | "frozen" | undefined) ?? "vacant")
        : existing.lifecycleStatus,
    });
  }

  return [...positions.values()].sort((a, b) => a.positionId.localeCompare(b.positionId));
}

export function assertPositionTreeIsAcyclic(graph: PositionGraph): void {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string) {
    if (inStack.has(nodeId)) {
      throw new InvariantViolationError(`Cycle detected at position ${nodeId}.`);
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    inStack.add(nodeId);
    const node = graph.get(nodeId);
    if (node?.reportsToId) {
      if (!graph.has(node.reportsToId)) {
        throw new InvariantViolationError(
          `Position ${nodeId} references missing manager ${node.reportsToId}.`,
        );
      }
      dfs(node.reportsToId);
    }
    inStack.delete(nodeId);
  }

  for (const nodeId of graph.keys()) {
    dfs(nodeId);
  }
}

export function applyReparent(
  graph: PositionGraph,
  positionId: string,
  newParentId: string | null,
): PositionGraph {
  const target = graph.get(positionId);
  if (!target) {
    throw new InvariantViolationError(`Position ${positionId} does not exist.`);
  }
  const next = new Map(graph);
  next.set(positionId, {
    ...target,
    reportsToId: newParentId,
  });
  assertPositionTreeIsAcyclic(next);
  return next;
}

export function buildPositionCreatedEvent(input: {
  orgId: string;
  actorId: string;
  idempotencyKey: string;
  positionId: string;
  title: string;
  teamId: string | null;
  reportsToId: string | null;
  order: number;
}): EventEnvelope {
  return {
    orgId: input.orgId,
    aggregateType: "position",
    aggregateId: input.positionId,
    eventType: "position.created",
    version: 0,
    occurredAt: new Date().toISOString(),
    actorId: input.actorId,
    idempotencyKey: input.idempotencyKey,
    schemaVersion: 1,
    payload: {
      id: input.positionId,
      title: input.title,
      teamId: input.teamId,
      reportsToId: input.reportsToId,
      order: input.order,
    },
    payloadHash: "",
  };
}

export function buildPositionReparentedEvent(input: {
  orgId: string;
  actorId: string;
  idempotencyKey: string;
  positionId: string;
  reportsToId: string | null;
}): EventEnvelope {
  return {
    orgId: input.orgId,
    aggregateType: "position",
    aggregateId: input.positionId,
    eventType: "position.reparented",
    version: 0,
    occurredAt: new Date().toISOString(),
    actorId: input.actorId,
    idempotencyKey: input.idempotencyKey,
    schemaVersion: 1,
    payload: {
      reportsToId: input.reportsToId,
    },
    payloadHash: "",
  };
}

