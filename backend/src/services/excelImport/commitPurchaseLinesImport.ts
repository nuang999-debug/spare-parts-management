import { prisma } from "../../db";
import {
  computeMustOrderByDate,
  computeNextForecast,
  computeStatus,
  computeSuggestedOrder,
} from "../forecastCalc";
import { applyPackingRule } from "../packingRules";
import type { ParsedPurchaseLine } from "./parsePurchaseLines";

const CHUNK_SIZE = 2000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function commitPurchaseLinesImport(params: {
  rows: ParsedPurchaseLine[];
  fileName: string;
  uploadedById: number;
}): Promise<{ importBatchId: number; rowCount: number; itemsUpdated: number }> {
  const { rows, fileName, uploadedById } = params;

  return prisma.$transaction(
    async (tx) => {
      const batch = await tx.importBatch.create({
        data: {
          fileName,
          fileType: "PURCHASE_LINES",
          uploadedById,
          rowCount: rows.length,
          status: "COMMITTED",
        },
      });

      for (const c of chunk(rows, CHUNK_SIZE)) {
        await tx.purchaseLine.createMany({
          data: c.map((r) => ({
            itemNoNormalized: r.itemNoNormalized,
            quantity: r.quantity,
            quantityReceived: r.quantityReceived,
            outstandingQty: r.outstandingQty,
            expectedReceiptDate: r.expectedReceiptDate,
            bucketMonth: r.bucketMonth,
            importBatchId: batch.id,
          })),
        });
      }

      const poBucketsByNo = new Map<string, [number, number, number, number, number]>();
      for (const row of rows) {
        if (row.bucketMonth == null) continue; // beyond the 5-month forecast horizon
        const buckets = poBucketsByNo.get(row.itemNoNormalized) ?? [0, 0, 0, 0, 0];
        buckets[row.bucketMonth - 1] += row.outstandingQty;
        poBucketsByNo.set(row.itemNoNormalized, buckets);
      }

      const affectedItemNos = [...new Set(rows.map((r) => r.itemNoNormalized))];
      const packingRules = await tx.packingUnitRule.findMany({ where: { active: true } });
      const packingRuleByNo = new Map(packingRules.map((r) => [r.itemNoNormalized, r]));
      const now = new Date();

      let itemsUpdated = 0;
      for (const idChunk of chunk(affectedItemNos, 500)) {
        const items = await tx.item.findMany({ where: { itemNoNormalized: { in: idChunk } } });
        for (const item of items) {
          const poBuckets = poBucketsByNo.get(item.itemNoNormalized) ?? [0, 0, 0, 0, 0];
          const next = computeNextForecast(item.stockQty, poBuckets, item.avgMonth ?? 0);
          const calcStatus = computeStatus(next[0], next[1], item.sumMin);
          const suggestion = computeSuggestedOrder(next, item.sumMin);
          const mustOrderByDate = computeMustOrderByDate(suggestion.triggerMonth, item.leadTimeDays, now);
          const rule = packingRuleByNo.get(item.itemNoNormalized);
          const prQtySuggested = applyPackingRule(suggestion.orderQty, rule);
          const prQtyCurrent = item.prIsOverride ? item.prQtyCurrent : prQtySuggested;

          await tx.item.update({
            where: { id: item.id },
            data: {
              next1: next[0],
              next2: next[1],
              next3: next[2],
              next4: next[3],
              next5: next[4],
              calcStatus,
              suggestedOrderQty: suggestion.orderQty,
              mustOrderByDate,
              prQtySuggested,
              prQtyCurrent,
            },
          });
          itemsUpdated++;
        }
      }

      return { importBatchId: batch.id, rowCount: rows.length, itemsUpdated };
    },
    { timeout: 5 * 60_000, maxWait: 15_000 }
  );
}
