import { RequestHandler } from "express";
import { prisma } from "../db";
import { HttpError } from "./errorHandler";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    next(new HttpError(401, "Not authenticated"));
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    req.session.destroy(() => {});
    next(new HttpError(401, "Session invalid"));
    return;
  }
  // A password change (self-service or admin reset) stamps passwordChangedAt — any session
  // whose snapshot predates that stamp was issued under the old password and must die here,
  // otherwise a stolen cookie stays valid indefinitely even after the owner "changes it."
  const currentStamp = user.passwordChangedAt?.getTime() ?? null;
  if (currentStamp !== null && req.session.passwordChangedAt !== currentStamp) {
    req.session.destroy(() => {});
    next(new HttpError(401, "Session invalid"));
    return;
  }
  req.user = user;
  next();
};
