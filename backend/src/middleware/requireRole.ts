import { RequestHandler } from "express";
import { Role } from "@prisma/client";
import { HttpError } from "./errorHandler";

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new HttpError(401, "Not authenticated"));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, "Forbidden"));
      return;
    }
    next();
  };
}
