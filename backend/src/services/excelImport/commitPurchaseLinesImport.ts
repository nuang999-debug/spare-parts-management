import { prisma } from "../../db";
import { recordChange } from "../../lib/auditLog";
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

      const packingRules = await tx.packingUnitRule.findMany({ where: { active: true } });
      const packingRuleByNo = new Map(packingRules.map((r) => [r.itemNoNormalized, r]));
      const now = new Date();

      // BC records Quantity/Quantity Received in the line's *purchase* unit of measure, not
      // necessarily the base unit Stock/Next-1..5/Sum MIN are all denominated in. For the items
      // with a packing rule (hose sold by the 25M reel, dust bags by the 5-pack), every real
      // Purchase Lines export on file carries a non-"PC" unit code here (e.g. "25M", "PACK") —
      // confirmed against every export received so far, never just for the current one. Convert
      // those rows to base units before storing/summing, using the rule's multipleOf as the
      // pack size (already confirmed to match: a "25M" line for the 25M-reel hose items, a
      // "PACK" line for the 5-per-pack dust bags). A row with no packing rule, or whose unit code
      // reads "PC"/blank, is left as-is (already in base units).
      const convertedRows = rows.map((r) => {
        const rule = packingRuleByNo.get(r.itemNoNormalized);
        const isBaseUnit = !r.unitOfMeasureCode || r.unitOfMeasureCode.toUpperCase() === "PC";
        const factor = rule?.active && !isBaseUnit ? rule.multipleOf : 1;
        return factor === 1
          ? r
          : { ...r, quantity: r.quantity * factor, quantityReceived: r.quantityReceived * factor, outstandingQty: r.outstandingQty * factor };
      });

      for (const c of chunk(convertedRows, CHUNK_SIZE)) {
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
      const poTotalsByNo = new Map<string, number>();
      for (const row of convertedRows) {
        poTotalsByNo.set(row.itemNoNormalized, (poTotalsByNo.get(row.itemNoNormalized) ?? 0) + row.outstandingQty);
        if (row.bucketMonth == null) continue; // beyond the 5-month forecast horizon
        const buckets = poBucketsByNo.get(row.itemNoNormalized) ?? [0, 0, 0, 0, 0];
        buckets[row.bucketMonth - 1] += row.outstandingQty;
        poBucketsByNo.set(row.itemNoNormalized, buckets);
      }

      // Mirrors the original's recomputeForecastWithPO(): it re-derives Next-1..5 (and now
      // poQty/"PO N0" itself) for EVERY item on every Purchase Lines import, not just the ones
      // present in the new file. Purchase Line data is the primary PO source — an item whose PO
      // lines disappeared from this import (received/cancelled) or that never had any drops to
      // poQty=0 and an unreplenished forecast, rather than keeping a stale value from the Items
      // file's own PO_N0 column forever.
      const allItems = await tx.item.findMany({
        select: {
          id: true,
          itemNoNormalized: true,
          stockQty: true,
          sumMin: true,
          leadTimeDays: true,
          avgMonth6: true,
          prIsOverride: true,
          prQtyCurrent: true,
        },
      });

      let itemsUpdated = 0;
      for (const itemChunk of chunk(allItems, 500)) {
        await Promise.all(
          itemChunk.map(async (item) => {
            const poQty = poTotalsByNo.get(item.itemNoNormalized) ?? 0;
            const poBuckets = poBucketsByNo.get(item.itemNoNormalized) ?? [0, 0, 0, 0, 0];
            const next = computeNextForecast(item.stockQty, poBuckets, item.avgMonth6 ?? 0);
            const calcStatus = computeStatus(next[0], next[1], item.sumMin);
            const suggestion = computeSuggestedOrder(next, item.sumMin);
            const mustOrderByDate = computeMustOrderByDate(suggestion.triggerMonth, item.leadTimeDays, now);
            const rule = packingRuleByNo.get(item.itemNoNormalized);
            const prQtySuggested = applyPackingRule(suggestion.orderQty, rule);
            // Mirrors commitItemsImport's same re-rounding: a packing rule can change (or be
            // added) between when the user set their override and any later import, so the
            // override needs re-applying here too — otherwise a Purchase Lines-only import path
            // could leave prQtyCurrent silently violating the currently active rule.
            const prQtyCurrent = item.prIsOverride ? applyPackingRule(item.prQtyCurrent ?? 0, rule) : null;

            await tx.item.update({
              where: { id: item.id },
              data: {
                poQty,
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

            if (item.prIsOverride && item.prQtyCurrent !== prQtyCurrent) {
              await recordChange(tx, {
                entityType: "Item",
                entityId: String(item.id),
                fieldName: "prQtyCurrent",
                oldValue: item.prQtyCurrent,
                newValue: prQtyCurrent,
                action: "UPDATE",
                changedById: uploadedById,
                note: "Re-rounded to packing rule on Purchase Lines reimport",
              });
            }

            itemsUpdated++;
          })
        );
      }

      return { importBatchId: batch.id, rowCount: rows.length, itemsUpdated };
    },
    { timeout: 10 * 60_000, maxWait: 15_000 }
  );
}
