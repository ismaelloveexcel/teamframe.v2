import type { NextFunction, Request, Response } from "express";
import { pool, runWithTenant } from "@workspace/db";
import { unauthorized } from "../lib/http-error.js";

/**
 * Session auth middleware.
 *
 * Extracts a Bearer token from the Authorization header (or x-session-token
 * header as a fallback).  Uses the SECURITY DEFINER function
 * get_session_with_membership() — which runs as the db owner, bypassing RLS —
 * to resolve user+company without needing a tenant context first.
 *
 * After resolution it sets req.sessionActor so downstream handlers know who
 * is calling.
 */
export function requireSessionAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];
  let token: string | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim() || null;
  } else {
    const fallback = req.headers["x-session-token"];
    if (typeof fallback === "string" && fallback.trim()) {
      token = fallback.trim();
    }
  }

  if (!token) {
    unauthorized("Missing session token");
  }

  const resolvedToken = token;
  pool
    .query<{
      user_id: string;
      company_id: string | null;
      role: string | null;
      user_email: string;
      user_status: string;
    }>("SELECT * FROM get_session_with_membership($1)", [resolvedToken])
    .then((result) => {
      if (result.rows.length === 0) {
        unauthorized("Invalid or expired session token");
      }
      const row = result.rows[0];
      const companyId = row.company_id ?? null;
      req.sessionActor = {
        userId: row.user_id,
        email: row.user_email,
        status: row.user_status as "invited" | "active" | "inactive",
        companyId,
        role: (row.role ?? null) as "admin" | "employee" | "super_admin" | null,
      };

      // Scope all `db` access for the rest of this request to the tenant, so
      // Postgres RLS (app.company_id) constrains every query. The scoped
      // connection is held until the response settles.
      if (companyId) {
        runWithTenant(
          companyId,
          () =>
            new Promise<void>((resolve) => {
              res.once("finish", resolve);
              res.once("close", resolve);
              next();
            }),
        ).catch((err: unknown) => {
          next(err);
        });
      } else {
        next();
      }
    })
    .catch((err: unknown) => {
      next(err);
    });
}
