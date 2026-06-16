import { Router, type IRouter } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, notFound } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";
import { requireRole } from "../middlewares/rbac.js";
import {
  createDocument,
  createTemplate,
  generateDocument,
  getDocument,
  getTemplate,
  listDocuments,
  listTemplates,
  updateTemplate,
} from "../services/hr-document-service.js";

const router: IRouter = Router();

router.use("/templates", requireSessionAuth, requireRole("admin", "super_admin"));
router.use("/documents", requireSessionAuth, requireRole("admin", "super_admin"));

function companyOf(req: { sessionActor?: { companyId: string | null } }): string {
  const companyId = req.sessionActor?.companyId;
  if (!companyId) badRequest("No company context on session");
  return companyId as string;
}

// ── Templates ──────────────────────────────────────────────────────────────
router.post(
  "/templates",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { name, body } = req.body ?? {};
    if (!name || !body) badRequest("name and body are required");
    res.status(201).json(await createTemplate(companyOf(req), actor.userId, req.body));
  }),
);

router.get(
  "/templates",
  asyncHandler(async (req, res) => {
    res.json(await listTemplates(companyOf(req)));
  }),
);

router.get(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const row = await getTemplate(companyOf(req), String(req.params.id));
    if (!row) notFound("Template not found");
    res.json(row);
  }),
);

router.patch(
  "/templates/:id",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const row = await updateTemplate(companyOf(req), actor.userId, String(req.params.id), req.body);
    if (!row) notFound("Template not found");
    res.json(row);
  }),
);

// Generate a document from a template + data map.
router.post(
  "/templates/:id/generate",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { data, name, employeeId, attachments } = req.body ?? {};
    const row = await generateDocument(companyOf(req), actor.userId, String(req.params.id), data ?? {}, {
      name,
      employeeId,
      attachments,
    });
    if (!row) notFound("Template not found");
    res.status(201).json(row);
  }),
);

// ── Documents ────────────────────────────────────────────────────────────
router.post(
  "/documents",
  asyncHandler(async (req, res) => {
    const actor = req.sessionActor!;
    const { name } = req.body ?? {};
    if (!name) badRequest("name is required");
    res.status(201).json(await createDocument(companyOf(req), actor.userId, req.body));
  }),
);

router.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
    res.json(await listDocuments(companyOf(req), employeeId));
  }),
);

router.get(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const row = await getDocument(companyOf(req), String(req.params.id));
    if (!row) notFound("Document not found");
    res.json(row);
  }),
);

export default router;
