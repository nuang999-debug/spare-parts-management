import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

export const auditRouter = Router();
auditRouter.use(requireAuth, requireRole("ADMIN"));

const HISTORY_LIMIT = 500;

// A malformed from/to (e.g. ?from=notadate) used to reach `new Date(from)` unchecked, producing
// an Invalid Date that Prisma's `gte`/`lte` filter would reject with a raw runtime error —
// rejecting it here up front turns that into a clean 400 instead.
const dateQuerySchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
  .optional();

auditRouter.get("/login-history", async (req, res, next) => {
  try {
    const { username, from, to } = req.query;
    const parsedFrom = dateQuerySchema.parse(typeof from === "string" ? from : undefined);
    const parsedTo = dateQuerySchema.parse(typeof to === "string" ? to : undefined);
    const where: Prisma.LoginHistoryWhereInput = {};
    if (typeof username === "string" && username) {
      where.usernameAttempted = { contains: username, mode: "insensitive" };
    }
    if (parsedFrom || parsedTo) {
      where.createdAt = {
        ...(parsedFrom ? { gte: new Date(parsedFrom) } : {}),
        ...(parsedTo ? { lte: new Date(parsedTo) } : {}),
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

    // entityId is just an opaque string (AuditLog is one generic table shared across entity
    // types, with no DB relation to join on) — "Item #17918" means nothing to an admin without
    // cross-referencing the database by hand, so resolve it to the item code/username here.
    const itemIds = rows.filter((r) => r.entityType === "Item").map((r) => Number(r.entityId));
    const userIds = rows.filter((r) => r.entityType === "User").map((r) => Number(r.entityId));
    const [items, users] = await Promise.all([
      itemIds.length
        ? prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, itemNoRaw: true, description: true } })
        : Promise.resolve([]),
      userIds.length
        ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, displayName: true } })
        : Promise.resolve([]),
    ]);
    const itemLabelById = new Map(items.map((i) => [i.id, `${i.itemNoRaw}${i.description ? ` — ${i.description}` : ""}`]));
    const userLabelById = new Map(users.map((u) => [u.id, `${u.displayName} (${u.username})`]));

    const withLabels = rows.map((row) => {
      const numericId = Number(row.entityId);
      const entityLabel =
        row.entityType === "Item"
          ? (itemLabelById.get(numericId) ?? `Item #${row.entityId}`)
          : row.entityType === "User"
            ? (userLabelById.get(numericId) ?? `User #${row.entityId}`)
            : `${row.entityType} ${row.entityId}`;
      return { ...row, entityLabel };
    });

    res.json(withLabels);
  } catch (err) {
    next(err);
  }
});
