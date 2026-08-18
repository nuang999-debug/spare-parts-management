import { prisma } from "../../db";
import { recordChange } from "../../lib/auditLog";
import {
  computeAvgMonth,
  computeMaxUsage,
  computeMinUsage,
  computeMustOrderByDate,
  computeNextForecast,
  computeRecommendedMin,
  computeStatus,
  computeSuggestedOrder,
  computeTrend,
} from "../forecastCalc";
import { applyPackingRule } from "../packingRules";
import { loadLatestPoData, type PoBucketsMap } from "./poBuckets";
import type { ParsedItemRow } from "./parseItemsRaw";

const ITEM_CHUNK_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface PackingRuleLite {
  multipleOf: number;
  active: boolean;
}

function computeItemData(
  row: ParsedItemRow,
  ctx: {
    existingPr: { prQtyCurrent: number | null; prIsOverride: boolean } | undefined;
    packingRule: PackingRuleLite | undefined;
    poBuckets: PoBucketsMap;
    poTotals: Map<string, number>;
    now: Date;
  }
) {
  const hist13 = row.usageHistory.map((h) => h.qty);
  // The 6-month trend window (AO-AT in the original) is M-6..M-1 — it excludes the
  // current/incomplete month M-0, same as computeAvgMonth's exclusion below.
  const hist6 = hist13.slice(6, 12);
  const avgMonth = computeAvgMonth(hist13);
  // Next-1..5 decrements by the 6-month rate (AO-AT), not the 12-month AVG/M —
  // matches the original's bh0=be+bd-avg6, n20=bh0-avg6, ... exactly.
  const avgMonth6 = hist6.reduce((s, v) => s + v, 0) / 6;
  const minUsage = computeMinUsage(hist13);
  const maxUsage = computeMaxUsage(hist13);

  // Purchase Line data is the primary PO source now — an item missing from the latest
  // Purchase Lines batch has no outstanding PO (0), not a fallback to the Items file's own
  // (potentially stale) PO_N0 column.
  const poBuckets = ctx.poBuckets.get(row.itemNoNormalized) ?? [0, 0, 0, 0, 0];
  const next = computeNextForecast(row.stockQty, poBuckets, avgMonth6);
  const calcStatus = computeStatus(next[0], next[1], row.sumMin);
  const calcTrend = computeTrend(hist6);
  const recommendedMin = computeRecommendedMin(avgMonth, row.leadTimeDays);
  const suggestion = computeSuggestedOrder(next, row.sumMin);
  const mustOrderByDate = computeMustOrderByDate(suggestion.triggerMonth, row.leadTimeDays, ctx.now);
  const prQtySuggested = applyPackingRule(suggestion.orderQty, ctx.packingRule);

  const prIsOverride = ctx.existingPr?.prIsOverride ?? false;
  const prQtyCurrent = prIsOverride
    ? applyPackingRule(ctx.existingPr!.prQtyCurrent ?? 0, ctx.packingRule)
    : null;

  return {
    itemNoRaw: row.itemNoRaw,
    itemNoNormalized: row.itemNoNormalized,
    description: row.description,
    class: row.class,
    category: row.category,
    dimension: row.dimension,
    purchasePrice: row.purchasePrice,
    unitCost: row.unitCost,
    vendor: row.vendor,
    poQty: ctx.poTotals.get(row.itemNoNormalized) ?? 0,
    stockQty: row.stockQty,
    backorderQty: row.backorderQty,
    leadTimeDays: row.leadTimeDays,
    avgMonth,
    avgMonth6,
    minUsage,
    maxUsage,
    oldMin: row.oldMin,
    sumMin: row.sumMin,
    next1: next[0],
    next2: next[1],
    next3: next[2],
    next4: next[3],
    next5: next[4],
    calcStatus,
    calcTrend,
    recommendedMin,
    suggestedOrderQty: suggestion.orderQty,
    mustOrderByDate,
    prQtySuggested,
    prQtyCurrent,
    prIsOverride,
    remark: row.remark,
    forModel: row.forModel,
    discontinuedModel: row.discontinuedModel,
    lastImportedAt: ctx.now,
  };
}

/**
 * Deliberately NOT one giant transaction wrapping all ~11K rows: that held every touched row's
 * lock for the entire multi-minute import, blocking any concurrent PR-qty edit until the whole
 * thing finished. Each ITEM_CHUNK_SIZE-row slice now commits on its own, so a lock is only ever
 * held for one chunk's worth of writes (well under a second) instead of the full import.
 *
 * Each chunk's transaction does everything for its own rows — reads the current prQtyCurrent/
 * prIsOverride, upserts the item, and replaces its usage/yearly history — all atomically:
 *   - The PR snapshot is read fresh INSIDE this chunk's own transaction, not pre-fetched once for
 *     the whole import before any chunk starts. An earlier version pre-fetched it upfront, which
 *     opened a window where a user's PATCH /items/:id/pr committed *during* the import (after the
 *     upfront snapshot but before that item's chunk ran) would get silently overwritten by the
 *     stale snapshot's value — this chunk-local read closes that window; the only way a concurrent
 *     edit is missed now is if it lands in the same instant this chunk's transaction is open,
 *     which the transaction's row lock serializes correctly instead of racing.
 *   - History delete+insert for a chunk's items happens in the SAME transaction as that chunk's
 *     item upsert, not split into separate delete-phase/insert-phase transactions afterward — a
 *     crash between those phases used to leave already-touched items with 0 history rows
 *     permanently (until a repeat import). Now a crash mid-chunk rolls back that whole chunk
 *     (item + its history together), leaving every previously-committed chunk fully consistent.
 *
 * The remaining trade-off: a mid-import failure leaves earlier chunks committed rather than
 * rolling back the entire import — acceptable here because every write is a plain upsert keyed by
 * itemNoNormalized, so simply re-running the same import is always safe and idempotent.
 */
export async function commitItemsImport(params: {
  rows: ParsedItemRow[];
  fileName: string;
  uploadedById: number;
}): Promise<{ importBatchId: number; rowCount: number }> {
  const { rows, fileName, uploadedById } = params;

  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      fileType: "ITEMS_RAW",
      uploadedById,
      rowCount: rows.length,
      status: "COMMITTED",
    },
  });

  const packingRules = await prisma.packingUnitRule.findMany({ where: { active: true } });
  const packingRuleByNo = new Map(packingRules.map((r) => [r.itemNoNormalized, r]));

  const { buckets: poBuckets, totals: poTotals } = await loadLatestPoData(prisma);
  const now = new Date();

  for (const rowChunk of chunk(rows, ITEM_CHUNK_SIZE)) {
    await prisma.$transaction(async (tx) => {
      const chunkItemNos = rowChunk.map((r) => r.itemNoNormalized);
      const existingItems = await tx.item.findMany({
        where: { itemNoNormalized: { in: chunkItemNos } },
        select: { itemNoNormalized: true, prQtyCurrent: true, prIsOverride: true },
      });
      const existingByNo = new Map(existingItems.map((e) => [e.itemNoNormalized, e]));

      const itemIdByNo = new Map<string, number>();
      for (const row of rowChunk) {
        const existingPr = existingByNo.get(row.itemNoNormalized);
        const data = computeItemData(row, {
          existingPr,
          packingRule: packingRuleByNo.get(row.itemNoNormalized),
          poBuckets,
          poTotals,
          now,
        });
        const item = await tx.item.upsert({
          where: { itemNoNormalized: row.itemNoNormalized },
          create: data,
          update: data,
          select: { id: true },
        });
        itemIdByNo.set(row.itemNoNormalized, item.id);

        // A user's manually-overridden PR qty gets re-rounded to the CURRENT packing rule on
        // every reimport (e.g. the multiple-of value changed since they set it) — that silently
        // changes a value they explicitly chose, so it needs the same audit trail as any other
        // PR edit, not just the ones made through the PATCH endpoint.
        if (existingPr?.prIsOverride && existingPr.prQtyCurrent !== data.prQtyCurrent) {
          await recordChange(tx, {
            entityType: "Item",
            entityId: String(item.id),
            fieldName: "prQtyCurrent",
            oldValue: existingPr.prQtyCurrent,
            newValue: data.prQtyCurrent,
            action: "UPDATE",
            changedById: uploadedById,
            note: "Re-rounded to packing rule on reimport",
          });
        }
      }

      const touchedIds = [...itemIdByNo.values()];
      await tx.itemUsageHistory.deleteMany({ where: { itemId: { in: touchedIds } } });
      await tx.itemYearlySales.deleteMany({ where: { itemId: { in: touchedIds } } });

      const usageRows = rowChunk.flatMap((row) => {
        const itemId = itemIdByNo.get(row.itemNoNormalized)!;
        return row.usageHistory.map((h) => ({ itemId, monthIndex: h.monthIndex, periodLabel: h.periodLabel, qty: h.qty }));
      });
      const yearlyRows = rowChunk.flatMap((row) => {
        const itemId = itemIdByNo.get(row.itemNoNormalized)!;
        return row.yearlySales.map((y) => ({ itemId, year: y.year, qty: y.qty }));
      });

      await tx.itemUsageHistory.createMany({ data: usageRows });
      await tx.itemYearlySales.createMany({ data: yearlyRows });
    });
  }

  return { importBatchId: batch.id, rowCount: rows.length };
}
