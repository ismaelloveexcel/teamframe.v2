import {
  getList,
  getValidated,
  patchValidated,
  postValidated,
} from "../lib/api-client";
import {
  documentSchema,
  templateSchema,
  type Document,
  type Template,
} from "./schemas";

export function listTemplates() {
  return getList("/templates", templateSchema);
}

export function getTemplate(id: string): Promise<Template> {
  return getValidated(`/templates/${id}`, templateSchema);
}

export type TemplateInput = { name: string; body: string };

export function createTemplate(input: TemplateInput): Promise<Template> {
  return postValidated("/templates", input, templateSchema);
}

export function updateTemplate(id: string, input: Partial<TemplateInput>): Promise<Template> {
  return patchValidated(`/templates/${id}`, input, templateSchema);
}

export type GenerateDocumentInput = {
  data?: Record<string, unknown>;
  name?: string;
  employeeId?: string | null;
  attachments?: Array<Record<string, unknown>>;
};

export function generateDocument(
  templateId: string,
  input: GenerateDocumentInput,
): Promise<Document> {
  return postValidated(`/templates/${templateId}/generate`, input, documentSchema);
}

export function listDocuments(employeeId?: string) {
  return getList("/documents", documentSchema, employeeId ? { employeeId } : undefined);
}

export function getDocument(id: string): Promise<Document> {
  return getValidated(`/documents/${id}`, documentSchema);
}

export type CreateDocumentInput = {
  name: string;
  employeeId?: string | null;
  content?: string | null;
};

export function createDocument(input: CreateDocumentInput): Promise<Document> {
  return postValidated("/documents", input, documentSchema);
}
