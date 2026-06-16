import type { NextFunction, Request, Response } from "express";
import { forbidden, unauthorized } from "../lib/http-error.js";

export type HrRole = "admin" | "employee" | "super_admin";

/**
 * Require one of the specified roles.  Must run after requireSessionAuth.
 */
export function requireRole(...roles: HrRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const actor = req.sessionActor;
    if (!actor) {
      unauthorized("Authentication required");
    }
    if (!actor.role || !roles.includes(actor.role as HrRole)) {
      forbidden(
        `This action requires one of: ${roles.join(", ")}. Your role: ${actor.role ?? "none"}`,
      );
    }
    next();
  };
}

/**
 * Field gate: strip sensitive fields from a response object based on the
 * caller's role.
 *
 * Usage:
 *   const safeRecord = gateFields(req, record, {
 *     salary: ["admin", "super_admin"],
 *     bankDetails: ["admin", "super_admin"],
 *   });
 */
export function gateFields<T extends Record<string, unknown>>(
  req: Request,
  record: T,
  fieldRoles: Partial<Record<keyof T, HrRole[]>>,
): Partial<T> {
  const callerRole = req.sessionActor?.role as HrRole | null | undefined;
  const result = { ...record };

  for (const [field, allowedRoles] of Object.entries(fieldRoles) as [
    keyof T,
    HrRole[],
  ][]) {
    if (!callerRole || !allowedRoles.includes(callerRole)) {
      delete result[field];
    }
  }

  return result;
}
