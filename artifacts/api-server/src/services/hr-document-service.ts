import { and, eq } from "drizzle-orm";
import {
  db,
  hrDocumentTable,
  hrTemplateTable,
  type HrDocument,
  type HrTemplate,
} from "@workspace/db";
import { mutateWithAudit } from "./hr-audit.js";

const rec = (v: unknown) => v as unknown as Record<string, unknown>;

/**
 * Template merge: replace {{token}} occurrences in `body` with values from
 * `data`. Tokens are alphanumeric/underscore/dot; surrounding whitespace inside
 * the braces is tolerated ({{ name }}). Unknown tokens are left as-is.
 */
export function renderTemplate(body: string, data: Record<string, unknown>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, token: string) => {
    const value = data[token];
    return value === undefined || value === null ? match : String(value);
  });
}

// ── Templates ─────────────────────────────────────────────────────────────

export type CreateTemplateInput = { name: string; body: string };

export async function createTemplate(
  companyId: string,
  actorId: string,
  input: CreateTemplateInput,
): Promise<HrTemplate> {
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrTemplateTable)
      .values({ ...input, companyId, createdBy: actorId, updatedBy: actorId })
      .returning();
    return {
      result: row,
      audit: { companyId, entityType: "template", entityId: row.id, action: "create" as const, after: rec(row), actorId },
    };
  });
}

export async function updateTemplate(
  companyId: string,
  actorId: string,
  id: string,
  patch: Partial<CreateTemplateInput>,
): Promise<HrTemplate | null> {
  return mutateWithAudit(async (tx) => {
    const [before] = await tx
      .select()
      .from(hrTemplateTable)
      .where(and(eq(hrTemplateTable.id, id), eq(hrTemplateTable.companyId, companyId)));
    if (!before) {
      return {
        result: null,
        audit: { companyId, entityType: "template", entityId: id, action: "update" as const, actorId: null },
      };
    }
    const [row] = await tx
      .update(hrTemplateTable)
      .set({ ...patch, updatedBy: actorId, updatedAt: new Date() })
      .where(and(eq(hrTemplateTable.id, id), eq(hrTemplateTable.companyId, companyId)))
      .returning();
    return {
      result: row,
      audit: {
        companyId,
        entityType: "template",
        entityId: id,
        action: "update" as const,
        before: rec(before),
        after: rec(row),
        actorId,
      },
    };
  });
}

export function listTemplates(companyId: string): Promise<HrTemplate[]> {
  return db.select().from(hrTemplateTable).where(eq(hrTemplateTable.companyId, companyId));
}

export async function getTemplate(companyId: string, id: string): Promise<HrTemplate | null> {
  const [row] = await db
    .select()
    .from(hrTemplateTable)
    .where(and(eq(hrTemplateTable.id, id), eq(hrTemplateTable.companyId, companyId)));
  return row ?? null;
}

// ── Documents ───────────────────────────────────────────────────────────────

export type CreateDocumentInput = {
  name: string;
  employeeId?: string | null;
  templateId?: string | null;
  content?: string | null;
  attachments?: Record<string, unknown>[] | null;
};

export async function createDocument(
  companyId: string,
  actorId: string,
  input: CreateDocumentInput,
): Promise<HrDocument> {
  return mutateWithAudit(async (tx) => {
    const [row] = await tx
      .insert(hrDocumentTable)
      .values({ ...input, companyId, createdBy: actorId, updatedBy: actorId })
      .returning();
    return {
      result: row,
      audit: { companyId, entityType: "document", entityId: row.id, action: "create" as const, after: rec(row), actorId },
    };
  });
}

/**
 * Generate a document by merging a template with a data map. Resolves the
 * template, renders the content, and persists a new document row (audited).
 */
export async function generateDocument(
  companyId: string,
  actorId: string,
  templateId: string,
  data: Record<string, unknown>,
  opts: { name?: string; employeeId?: string | null; attachments?: Record<string, unknown>[] | null } = {},
): Promise<HrDocument | null> {
  return mutateWithAudit(async (tx) => {
    const [template] = await tx
      .select()
      .from(hrTemplateTable)
      .where(and(eq(hrTemplateTable.id, templateId), eq(hrTemplateTable.companyId, companyId)));
    if (!template) {
      return {
        result: null,
        audit: { companyId, entityType: "document", entityId: templateId, action: "create" as const, actorId: null },
      };
    }
    const content = renderTemplate(template.body, data);
    const [row] = await tx
      .insert(hrDocumentTable)
      .values({
        companyId,
        name: opts.name ?? template.name,
        templateId,
        employeeId: opts.employeeId ?? null,
        content,
        attachments: opts.attachments ?? null,
        createdBy: actorId,
        updatedBy: actorId,
      })
      .returning();
    return {
      result: row,
      audit: { companyId, entityType: "document", entityId: row.id, action: "create" as const, after: rec(row), actorId },
    };
  });
}

export function listDocuments(companyId: string, employeeId?: string): Promise<HrDocument[]> {
  if (employeeId) {
    return db
      .select()
      .from(hrDocumentTable)
      .where(and(eq(hrDocumentTable.companyId, companyId), eq(hrDocumentTable.employeeId, employeeId)));
  }
  return db.select().from(hrDocumentTable).where(eq(hrDocumentTable.companyId, companyId));
}

export async function getDocument(companyId: string, id: string): Promise<HrDocument | null> {
  const [row] = await db
    .select()
    .from(hrDocumentTable)
    .where(and(eq(hrDocumentTable.id, id), eq(hrDocumentTable.companyId, companyId)));
  return row ?? null;
}
