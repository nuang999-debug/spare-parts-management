import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db";
import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import { HttpError } from "../../middleware/errorHandler";
import { normalizeItemNo } from "../../lib/itemNo";
import { roundUpToMultiple } from "../../services/packingRules";
import { recordChange } from "../../lib/auditLog";

export const packingRulesRouter = Router();
packingRulesRouter.use(requireAuth, requireRole("ADMIN"));

packingRulesRouter.get("/", async (_req, res, next) => {
  try {
    const rules = await prisma.packingUnitRule.findMany({
      orderBy: { itemNoNormalized: "asc" },
      include: { createdBy: { select: { displayName: true } } },
    });
    res.json(rules);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({ itemNo: z.string().min(1), multipleOf: z.number().int().positive().max(100_000, "multipleOf is unreasonably large") });

packingRulesRouter.post("/", async (req, res, next) => {
  try {
    const { itemNo, multipleOf } = createSchema.parse(req.body);
    const itemNoNormalized = normalizeItemNo(itemNo);
    const changedById = req.user!.id;

    const rule = await prisma.$transaction(async (tx) => {
      const existing = await tx.packingUnitRule.findUnique({ where: { itemNoNormalized } });
      const result = existing
        ? await tx.packingUnitRule.update({
            where: { itemNoNormalized },
            data: { multipleOf, active: true },
          })
        : await tx.packingUnitRule.create({
            data: { itemNoNormalized, multipleOf, active: true, createdById: changedById },
          });

      await recordChange(tx, {
        entityType: "PackingUnitRule",
        entityId: itemNoNormalized,
        fieldName: existing ? "multipleOf" : "created",
        oldValue: existing?.multipleOf ?? null,
        newValue: multipleOf,
        action: existing ? "UPDATE" : "CREATE",
        changedById,
      });

      return result;
    });

    res.json(rule);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  multipleOf: z.number().int().positive().max(100_000, "multipleOf is unreasonably large").optional(),
  active: z.boolean().optional(),
});

packingRulesRouter.patch("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Invalid id");
    const data = updateSchema.parse(req.body);
    const changedById = req.user!.id;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.packingUnitRule.findUnique({ where: { id } });
      if (!existing) throw new HttpError(404, "Rule not found");

      const result = await tx.packingUnitRule.update({ where: { id }, data });

      if (data.multipleOf !== undefined && data.multipleOf !== existing.multipleOf) {
        await recordChange(tx, {
          entityType: "PackingUnitRule",
          entityId: existing.itemNoNormalized,
          fieldName: "multipleOf",
          oldValue: existing.multipleOf,
          newValue: data.multipleOf,
          action: "UPDATE",
          changedById,
        });
      }
      if (data.active !== undefined && data.active !== existing.active) {
        await recordChange(tx, {
          entityType: "PackingUnitRule",
          entityId: existing.itemNoNormalized,
          fieldName: "active",
          oldValue: existing.active,
          newValue: data.active,
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

packingRulesRouter.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) throw new HttpError(400, "Invalid id");
    const changedById = req.user!.id;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.packingUnitRule.findUnique({ where: { id } });
      if (!existing) throw new HttpError(404, "Rule not found");

      const result = await tx.packingUnitRule.update({ where: { id }, data: { active: false } });
      await recordChange(tx, {
        entityType: "PackingUnitRule",
        entityId: existing.itemNoNormalized,
        fieldName: "active",
        oldValue: true,
        newValue: false,
        action: "DELETE",
        changedById,
      });
      return result;
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

packingRulesRouter.post("/recalculate", async (req, res, next) => {
  try {
    const changedById = req.user!.id;

    const result = await prisma.$transaction(async (tx) => {
      const rules = await tx.packingUnitRule.findMany({ where: { active: true } });
      let changedCount = 0;

      for (const rule of rules) {
        const items = await tx.item.findMany({ where: { itemNoNormalized: rule.itemNoNormalized } });
        for (const item of items) {
          const current = item.prQtyCurrent ?? 0;
          const rounded = roundUpToMultiple(current, rule.multipleOf);
          if (rounded !== current) {
            await tx.item.update({ where: { id: item.id }, data: { prQtyCurrent: rounded } });
            await recordChange(tx, {
              entityType: "Item",
              entityId: String(item.id),
              fieldName: "prQtyCurrent",
              oldValue: current,
              newValue: rounded,
              action: "UPDATE",
              changedById,
              note: "bulk-repack-round",
            });
            changedCount++;
          }
        }
      }

      return { changedCount };
    }, { timeout: 10 * 60_000, maxWait: 15_000 });

    res.json(result);
  } catch (err) {
    next(err);
  }
});
