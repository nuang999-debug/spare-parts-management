import { prisma } from "../../db";
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
import { loadLatestPoBucketsMap, type PoBucketsMap } from "./poBuckets";
import type { ParsedItemRow } from "./parseItemsRaw";

const ITEM_CHUNK_SIZE = 500;
const CHILD_ROW_CHUNK_SIZE = 3000;

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
    now: Date;
  }
) {
  const hist13 = row.usageHistory.map((h) => h.qty);
  const hist6 = hist13.slice(7, 13);
  const avgMonth = computeAvgMonth(hist13);
  const minUsage = computeMinUsage(hist13);
  const maxUsage = computeMaxUsage(hist13);

  const poBuckets = ctx.poBuckets.get(row.itemNoNormalized) ?? [row.poQty, 0, 0, 0, 0];
  const next = computeNextForecast(row.stockQty, poBuckets, avgMonth);
  const calcStatus = computeStatus(next[0], next[1], row.sumMin);
  const calcTrend = computeTrend(hist6);
  const recommendedMin = computeRecommendedMin(avgMonth, row.leadTimeDays, hist6);
  const suggestion = computeSuggestedOrder(next, row.sumMin);
  const mustOrderByDate = computeMustOrderByDate(suggestion.triggerMonth, row.leadTimeDays, ctx.now);
  const prQtySuggested = applyPackingRule(suggestion.orderQty, ctx.packingRule);

  const prIsOverride = ctx.existingPr?.prIsOverride ?? false;
  const prQtyCurrent = prIsOverride
    ? applyPackingRule(ctx.existingPr!.prQtyCurrent ?? 0, ctx.packingRule)
    : prQtySuggested;

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
    poQty: row.poQty,
    stockQty: row.stockQty,
    backorderQty: row.backorderQty,
    leadTimeDays: row.leadTimeDays,
    avgMonth,
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
    lastImportedAt: ctx.now,
  };
}

export async function commitItemsImport(params: {
  rows: ParsedItemRow[];
  fileName: string;
  uploadedById: number;
}): Promise<{ importBatchId: number; rowCount: number }> {
  const { rows, fileName, uploadedById } = params;

  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          fileName,
          fileType: "ITEMS_RAW",
          uploadedById,
          rowCount: rows.length,
          status: "COMMITTED",
        },
      });

      const itemNos = rows.map((r) => r.itemNoNormalized);
      const existingItems = await tx.item.findMany({
        where: { itemNoNormalized: { in: itemNos } },
        select: { itemNoNormalized: true, prQtyCurrent: true, prIsOverride: true },
      });
      const existingByNo = new Map(existingItems.map((e) => [e.itemNoNormalized, e]));

      const packingRules = await tx.packingUnitRule.findMany({ where: { active: true } });
      const packingRuleByNo = new Map(packingRules.map((r) => [r.itemNoNormalized, r]));

      const poBuckets = await loadLatestPoBucketsMap(tx);
      const now = new Date();

      const itemIdByNo = new Map<string, number>();
      for (const row of rows) {
        const data = computeItemData(row, {
          existingPr: existingByNo.get(row.itemNoNormalized),
          packingRule: packingRuleByNo.get(row.itemNoNormalized),
          poBuckets,
          now,
        });
        const item = await tx.item.upsert({
          where: { itemNoNormalized: row.itemNoNormalized },
          create: data,
          update: data,
          select: { id: true },
        });
        itemIdByNo.set(row.itemNoNormalized, item.id);
      }

      const touchedIds = [...itemIdByNo.values()];
      for (const idChunk of chunk(touchedIds, ITEM_CHUNK_SIZE)) {
        await tx.itemUsageHistory.deleteMany({ where: { itemId: { in: idChunk } } });
        await tx.itemYearlySales.deleteMany({ where: { itemId: { in: idChunk } } });
      }

      const usageRows = rows.flatMap((row) => {
        const itemId = itemIdByNo.get(row.itemNoNormalized)!;
        return row.usageHistory.map((h) => ({ itemId, monthIndex: h.monthIndex, periodLabel: h.periodLabel, qty: h.qty }));
      });
      const yearlyRows = rows.flatMap((row) => {
        const itemId = itemIdByNo.get(row.itemNoNormalized)!;
        return row.yearlySales.map((y) => ({ itemId, year: y.year, qty: y.qty }));
      });

      for (const c of chunk(usageRows, CHILD_ROW_CHUNK_SIZE)) {
        await tx.itemUsageHistory.createMany({ data: c });
      }
      for (const c of chunk(yearlyRows, CHILD_ROW_CHUNK_SIZE)) {
        await tx.itemYearlySales.createMany({ data: c });
      }

      return { importBatchId: batch.id, rowCount: rows.length };
    },
    { timeout: 10 * 60_000, maxWait: 15_000 }
  );
}
