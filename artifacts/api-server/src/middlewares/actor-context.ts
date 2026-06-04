import type { NextFunction, Request, Response } from "express";
import { parseActorFromHeaders } from "../lib/request-context";

export function requireActorContext(req: Request, _res: Response, next: NextFunction) {
  req.actor = parseActorFromHeaders(req);
  next();
}
