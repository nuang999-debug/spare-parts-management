import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("ADMIN"));

const HISTORY_LIMIT = 500;

auditRouter.get("/login-history", async (req, res, next) => {
  try {
    const { username, from, to } = req.query;
    const where: Prisma.LoginHistoryWhereInput = {};
    if (typeof username === "string" && username) {
      where.usernameAttempted = { contains: username, mode: "insensitive" };
    }
    if (typeof from === "string" || typeof to === "string") {
      where.createdAt = {
        ...(typeof from === "string" ? { gte: new Date(from) } : {}),
        ...(typeof to === "string" ? { lte: new Date(to) } : {}),
      };
    }

    const rows = await prisma.loginHistory.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      include: { user: { select: { displayName: true, username: true } } },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

auditRouter.get("/edit-history", async (req, res, next) => {
  try {
    const { itemId, userId, entityType } = req.query;
    const where: Prisma.AuditLogWhereInput = {};
    if (typeof itemId === "string" && itemId) where.entityId = itemId;
    if (typeof userId === "string" && userId) where.changedById = Number(userId);
    if (typeof entityType === "string" && entityType) where.entityType = entityType;

    const rows = await prisma.auditLog.findMany({
      where,
      orderBy: { changedAt: "desc" },
      take: HISTORY_LIMIT,
      include: { changedBy: { select: { displayName: true, username: true } } },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
