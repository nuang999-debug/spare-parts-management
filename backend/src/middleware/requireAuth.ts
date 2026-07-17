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
  req.user = user;
  next();
};
