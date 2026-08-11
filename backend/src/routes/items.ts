import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";
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
  purchasePrice: true,
  remark: true,
  forModel: true,
  stockQty: true,
  poQty: true,
  backorderQty: true,
  leadTimeDays: true,
  avgMonth: true,
  oldMin: true,
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
  usageHistory: {
    // The 6-month trend window (AO-AT) is M-6..M-1 (monthIndex 6..11), excluding
    // the current/incomplete month M-0 (monthIndex 12).
    where: { monthIndex: { gte: 6, lt: 12 } },
    orderBy: { monthIndex: "asc" as const },
    select: { monthIndex: true, periodLabel: true, qty: true },
  },
} as const;

itemsRouter.get("/", async (_req, res, next) => {
  try {
    const [items, latestBatch] = await Promise.all([
      prisma.item.findMany({
        select: LIST_SELECT,
        orderBy: { itemNoRaw: "asc" },
      }),
      prisma.importBatch.findFirst({
        where: { fileType: "ITEMS_RAW", status: "COMMITTED" },
        orderBy: { uploadedAt: "desc" },
        select: { uploadedAt: true },
      }),
    ]);
    // An item not refreshed by the most recent committed Items import has dropped out of the
    // source file (discontinued/renumbered upstream) but keeps serving its old forecast forever
    // with nothing to say so — flag it so stale numbers aren't mistaken for current ones.
    const latestImportAt = latestBatch?.uploadedAt ?? null;
    const withStaleFlag = items.map((item) => ({
      ...item,
      isStale: latestImportAt != null && (!item.lastImportedAt || item.lastImportedAt < latestImportAt),
    }));
    res.json(withStaleFlag);
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

    const [packingRule, latestBatch] = await Promise.all([
      prisma.packingUnitRule.findUnique({
        where: { itemNoNormalized: item.itemNoNormalized },
        select: { multipleOf: true, active: true },
      }),
      prisma.importBatch.findFirst({
        where: { fileType: "ITEMS_RAW", status: "COMMITTED" },
        orderBy: { uploadedAt: "desc" },
        select: { uploadedAt: true },
      }),
    ]);
    const latestImportAt = latestBatch?.uploadedAt ?? null;
    const isStale = latestImportAt != null && (!item.lastImportedAt || item.lastImportedAt < latestImportAt);

    res.json({ ...item, isStale, packingRule: packingRule?.active ? packingRule : null });
  } catch (err) {
    next(err);
  }
});

const prEditSchema = z.object({ newPrQty: z.number().finite().min(0) });

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

itemsRouter.post("/clear-all-pr", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const changedById = req.user!.id;

    const itemsToClear = await prisma.item.findMany({
      where: { prQtyCurrent: { not: null } },
      select: { id: true, prQtyCurrent: true },
    });

    // Chunked into separate transactions (not one covering every affected row) so a large
    // "clear all" can't hold a lock across the whole affected set for longer than one chunk —
    // same fix as the bulk import commits, for the same reason.
    const CHUNK_SIZE = 500;
    for (let i = 0; i < itemsToClear.length; i += CHUNK_SIZE) {
      const itemChunk = itemsToClear.slice(i, i + CHUNK_SIZE);
      await prisma.$transaction(async (tx) => {
        for (const item of itemChunk) {
          await recordChange(tx, {
            entityType: "Item",
            entityId: String(item.id),
            fieldName: "prQtyCurrent",
            oldValue: item.prQtyCurrent,
            newValue: null,
            action: "UPDATE",
            changedById,
            note: "ล้าง PR ทั้งหมด",
          });
        }
        await tx.item.updateMany({
          where: { id: { in: itemChunk.map((item) => item.id) } },
          data: { prQtyCurrent: null, prIsOverride: false },
        });
      });
    }

    res.json({ clearedCount: itemsToClear.length });
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
