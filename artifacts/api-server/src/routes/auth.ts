import { Router, type IRouter } from "express";
import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import {
  db,
  pool,
  runWithTenant,
  usersTable,
  sessionsTable,
  membershipsTable,
  companiesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest, unauthorized } from "../lib/http-error.js";
import { requireSessionAuth } from "../middlewares/session-auth.js";

const router: IRouter = Router();

const SALT_ROUNDS = 12;
const SESSION_TTL_HOURS = 24;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * POST /api/auth/register
 * Body: { email, password, companyId?, role? }
 */
router.post(
  "/auth/register",
  asyncHandler(async (req, res) => {
    const { email, password, companyId, role } = req.body as {
      email?: string;
      password?: string;
      companyId?: string;
      role?: string;
    };

    if (!email || !password) {
      badRequest("email and password are required");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const [user] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        status: "active",
        updatedAt: new Date(),
      })
      .returning();

    if (companyId) {
      const memberRole = (role ?? "employee") as "admin" | "employee" | "super_admin";
      // memberships has FORCED RLS (company_id = app.company_id). Scope the
      // insert to the target company so the WITH CHECK passes under app_user.
      await runWithTenant(companyId, async () => {
        await db.insert(membershipsTable).values({
          userId: user.id,
          companyId,
          role: memberRole,
        });
      });
    }

    res.status(201).json({ id: user.id, email: user.email, status: user.status });
  }),
);

/**
 * POST /api/auth/bootstrap
 * Tenant onboarding: creates a company + its first admin user + admin membership.
 * Body: { companyName, jurisdiction?, currency?, adminEmail, adminPassword }
 *
 * companies + memberships have FORCED RLS keyed on app.company_id. We generate
 * the company id up front and run the company + membership inserts inside that
 * tenant scope so the RLS WITH CHECK is satisfied without any BYPASSRLS role.
 */
router.post(
  "/auth/bootstrap",
  asyncHandler(async (req, res) => {
    const { companyName, jurisdiction, currency, adminEmail, adminPassword } = req.body as {
      companyName?: string;
      jurisdiction?: string;
      currency?: string;
      adminEmail?: string;
      adminPassword?: string;
    };

    if (!companyName || !adminEmail || !adminPassword) {
      badRequest("companyName, adminEmail and adminPassword are required");
    }

    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    // users is a global identity table (no RLS) — safe to insert before any
    // tenant context exists.
    const [user] = await db
      .insert(usersTable)
      .values({
        email: adminEmail.toLowerCase(),
        passwordHash,
        status: "active",
        updatedAt: new Date(),
      })
      .returning();

    const companyId = randomUUID();
    await runWithTenant(companyId, async () => {
      await db.insert(companiesTable).values({
        id: companyId,
        name: companyName,
        jurisdiction: jurisdiction ?? "UAE",
        currency: currency ?? "AED",
      });
      await db.insert(membershipsTable).values({
        userId: user.id,
        companyId,
        role: "admin",
      });
    });

    res.status(201).json({
      companyId,
      admin: { id: user.id, email: user.email, role: "admin" },
    });
  }),
);

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Uses SECURITY DEFINER function to resolve user bypassing RLS.
 */
router.post(
  "/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      badRequest("email and password are required");
    }

    // Gate (b): SECURITY DEFINER bypasses RLS on the global users table
    const result = await pool.query<{
      id: string;
      email: string;
      password_hash: string | null;
      status: string;
    }>("SELECT * FROM get_user_by_email($1)", [email.toLowerCase()]);

    if (result.rows.length === 0) {
      unauthorized("Invalid credentials");
    }

    const row = result.rows[0];

    if (row.status === "inactive") {
      unauthorized("Account is inactive");
    }

    if (!row.password_hash) {
      unauthorized("No password set for this account");
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      unauthorized("Invalid credentials");
    }

    // Find default company membership via SECURITY DEFINER (memberships has
    // FORCED RLS; under app_user a direct query before tenant context returns
    // nothing).
    const membershipResult = await pool.query<{ company_id: string }>(
      "SELECT company_id FROM get_user_default_company($1)",
      [row.id],
    );

    const token = generateToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    const [session] = await db
      .insert(sessionsTable)
      .values({
        userId: row.id,
        token,
        companyId: membershipResult.rows[0]?.company_id ?? null,
        expiresAt,
      })
      .returning();

    res.json({
      token: session.token,
      userId: session.userId,
      companyId: session.companyId,
      expiresAt: session.expiresAt,
    });
  }),
);

/**
 * POST /api/auth/logout
 */
router.post(
  "/auth/logout",
  requireSessionAuth,
  asyncHandler(async (req, res) => {
    const authHeader = req.headers["authorization"] ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (token) {
      await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    }
    res.json({ ok: true });
  }),
);

/**
 * GET /api/auth/me
 */
router.get(
  "/auth/me",
  requireSessionAuth,
  asyncHandler(async (req, res) => {
    res.json({ actor: req.sessionActor });
  }),
);

export default router;
