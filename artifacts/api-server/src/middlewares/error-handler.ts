import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";
import { HttpError } from "../lib/http-error";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      message: err.message,
      details: err.details,
    });
    return;
  }

  logger.error({ err, path: req.path, method: req.method }, "Unhandled API error");
  res.status(500).json({
    message: "Internal Server Error",
  });
}
