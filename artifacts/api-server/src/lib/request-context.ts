import type { Request } from "express";
import { badRequest, unauthorized } from "./http-error";

export interface ActorContext {
  userId: string;
  email: string;
  fullName: string | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getHeaderString(req: Request, key: string): string | null {
  const value = req.header(key);
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateUuid(value: string, fieldName: string): string {
  if (!UUID_REGEX.test(value)) {
    badRequest(`Invalid ${fieldName}`);
  }
  return value;
}

export function parseActorFromHeaders(req: Request): ActorContext {
  const rawUserId = getHeaderString(req, "x-user-id");
  const rawEmail = getHeaderString(req, "x-user-email");
  const rawName = getHeaderString(req, "x-user-name");

  if (!rawUserId || !rawEmail) {
    unauthorized("Missing actor headers: x-user-id and x-user-email are required");
  }

  return {
    userId: validateUuid(rawUserId, "x-user-id"),
    email: rawEmail.toLowerCase(),
    fullName: rawName ?? null,
  };
}
