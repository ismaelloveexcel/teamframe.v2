import { and, eq } from "drizzle-orm";
import { db, hrPositionsTable, type HrPosition } from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

export type CreatePositionInput = {
  title: string;
  department?: string | null;
  function?: string | null;
  lineManagerId?: string | null;
  grade?: string | null;
  location?: string | null;
  employmentType?: string | null;
  workSchedule?: string | null;
  budgeted?: boolean;
  jobDescription?: string | null;
  status?: string;
};

export type UpdatePositionInput = Partial<CreatePositionInput>;

export async function createPosition(
  companyId: string,
  actorId: string,
  input: CreatePositionInput,
): Promise<HrPosition> {
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrPositionsTable)
      .values({ ...input, companyId, createdBy: actorId, updatedBy: actorId })
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "position",
        entityId: row.id,
        action: "create" as const,
        after: row as unknown as Record<string, unknown>,
        actorId,
      },
    };
  });
}

export async function updatePosition(
  companyId: string,
  actorId: string,
  id: string,
  patch: UpdatePositionInput,
): Promise<HrPosition | null> {
  return mutateWithAudit(async (tx) => {
    const [before] = await tx
      .select()
      .from(hrPositionsTable)
      .where(and(eq(hrPositionsTable.id, id), eq(hrPositionsTable.companyId, companyId)));
    if (!before) {
      return { result: null, audit: skipAudit(companyId, id) };
    }
    const [row] = await tx
      .update(hrPositionsTable)
      .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
      .where(and(eq(hrPositionsTable.id, id), eq(hrPositionsTable.companyId, companyId)))
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "position",
        entityId: id,
        action: "update" as const,
        before: before as unknown as Record<string, unknown>,
        after: row as unknown as Record<string, unknown>,
        actorId,
      },
    };
  });
}

// When the target row does not exist we still satisfy the helper's contract but
// the no-op audit is harmless (no mutation happened). Callers treat null result
// as 404.
function skipAudit(companyId: string, id: string) {
  return {
    companyId,
    entityType: "position",
    entityId: id,
    action: "update" as const,
    actorId: null,
  };
}

export function listPositions(companyId: string): Promise<HrPosition[]> {
  return db.select().from(hrPositionsTable).where(eq(hrPositionsTable.companyId, companyId));
}

export async function getPosition(companyId: string, id: string): Promise<HrPosition | null> {
  const [row] = await db
    .select()
    .from(hrPositionsTable)
    .where(and(eq(hrPositionsTable.id, id), eq(hrPositionsTable.companyId, companyId)));
  return row ?? null;
}

export type PositionNode = HrPosition & { reports: PositionNode[] };

/** Reporting tree built from line_manager_id (roots = positions with no manager). */
export async function getHierarchy(companyId: string): Promise<PositionNode[]> {
  const rows = await listPositions(companyId);
  const byId = new Map<string, PositionNode>(rows.map((r) => [r.id, { ...r, reports: [] }]));
  const roots: PositionNode[] = [];
  for (const node of byId.values()) {
    const parent = node.lineManagerId ? byId.get(node.lineManagerId) : undefined;
    if (parent) parent.reports.push(node);
    else roots.push(node);
  }
  return roots;
}
