import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { HttpError } from "../middleware/errorHandler";
import { applyPackingRule } from "../services/packingRules";
import { recordChange } from "../lib/auditLog";

export const itemsRouter = Router();
itemsRouter.use(requireAuth);

const LIST_SELECT = {
  id: true,
  itemNoRaw: true,
  itemNoNormalized: true,
  description: true,
  class: true,
  category: true,
  vendor: true,
  stockQty: true,
  poQty: true,
  backorderQty: true,
  leadTimeDays: true,
  sumMin: true,
  next1: true,
  next2: true,
  next3: true,
  next4: true,
  next5: true,
  calcStatus: true,
  calcTrend: true,
  suggestedOrderQty: true,
  mustOrderByDate: true,
  prQtySuggested: true,
  prQtyCurrent: true,
  prIsOverride: true,
  lastImportedAt: true,
} as const;

itemsRouter.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.item.findMany({
      select: LIST_SELECT,
      orderBy: { itemNoRaw: "asc" },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

itemsRouter.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Invalid item id");

    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        usageHistory: { orderBy: { monthIndex: "asc" } },
        yearlySales: { orderBy: { year: "asc" } },
      },
    });
    if (!item) throw new HttpError(404, "Item not found");
    res.json(item);
  } catch (err) {
    next(err);
  }
});

const prEditSchema = z.object({ newPrQty: z.number().min(0) });

itemsRouter.patch("/:id/pr", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Invalid item id");
    const { newPrQty } = prEditSchema.parse(req.body);
    const changedById = req.user!.id;

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.item.findUnique({ where: { id } });
      if (!item) throw new HttpError(404, "Item not found");

      const rule = await tx.packingUnitRule.findUnique({
        where: { itemNoNormalized: item.itemNoNormalized },
      });
      const roundedQty = applyPackingRule(newPrQty, rule ?? undefined);
      const oldQty = item.prQtyCurrent;

      const result = await tx.item.update({
        where: { id },
        data: { prQtyCurrent: roundedQty, prIsOverride: true },
      });

      if (oldQty !== roundedQty) {
        await recordChange(tx, {
          entityType: "Item",
          entityId: String(id),
          fieldName: "prQtyCurrent",
          oldValue: oldQty,
          newValue: roundedQty,
          action: "UPDATE",
          changedById,
        });
      }

      return result;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

itemsRouter.get("/:id/history", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Invalid item id");

    const history = await prisma.auditLog.findMany({
      where: { entityType: "Item", entityId: String(id) },
      orderBy: { changedAt: "desc" },
      include: { changedBy: { select: { displayName: true, username: true } } },
    });
    res.json(history);
  } catch (err) {
    next(err);
  }
});
