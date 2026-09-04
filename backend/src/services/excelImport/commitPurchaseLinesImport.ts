import { Prisma } from "@prisma/client";
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
// Same fix as commitItemsImport.ts: 500 sequential per-item round-trips inside one interactive
// transaction routinely exceeded Prisma's default 5s timeout against a real (non-localhost)
// database — invisible on local dev, fatal on production. Smaller chunk + explicit longer timeout.
const ITEM_RECOMPUTE_CHUNK_SIZE = 150;
const CHUNK_TRANSACTION_TIMEOUT_MS = 60_000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface ItemRecompute {
  id: number;
  poQty: number;
  next0: number;
  next1: number;
  next2: number;
  next3: number;
  next4: number;
  next5: number;
  calcStatus: string;
  suggestedOrderQty: number;
  mustOrderByDate: Date | null;
  prQtySuggested: number;
  prQtyCurrent: number | null;
}

/**
 * One UPDATE ... FROM (VALUES ...) statement for the whole chunk instead of one UPDATE round-trip
 * per item — same fix and same reasoning as commitItemsImport.ts's bulkUpsertItems: against a
 * real (non-localhost) database, ~150 sequential round-trips per chunk at real internet latency
 * turned this recompute (which touches EVERY item in the catalog, not just the imported PO lines)
 * into a 15-25 minute request that regularly outlasted the platform's HTTP proxy timeout.
 */
async function bulkUpdateItems(tx: Prisma.TransactionClient, rows: ItemRecompute[]): Promise<void> {
  if (rows.length === 0) return;

  const valueTuples = rows.map(
    (r) => Prisma.sql`(
      ${r.id}::integer, ${r.poQty}::double precision,
      ${r.next0}::double precision, ${r.next1}::double precision, ${r.next2}::double precision,
      ${r.next3}::double precision, ${r.next4}::double precision, ${r.next5}::double precision,
      ${r.calcStatus}::"CalcStatus", ${r.suggestedOrderQty}::double precision,
      ${r.mustOrderByDate}::timestamp, ${r.prQtySuggested}::double precision,
      ${r.prQtyCurrent}::double precision
    )`
  );

  await tx.$executeRaw`
    UPDATE "items" AS i SET
      "poQty" = v."poQty",
      "next0" = v."next0",
      "next1" = v."next1",
      "next2" = v."next2",
      "next3" = v."next3",
      "next4" = v."next4",
      "next5" = v."next5",
      "calcStatus" = v."calcStatus",
      "suggestedOrderQty" = v."suggestedOrderQty",
      "mustOrderByDate" = v."mustOrderByDate",
      "prQtySuggested" = v."prQtySuggested",
      "prQtyCurrent" = v."prQtyCurrent",
      "updatedAt" = now()
    FROM (VALUES ${Prisma.join(valueTuples, ", ")}) AS v(
      "id", "poQty", "next0", "next1", "next2", "next3", "next4", "next5",
      "calcStatus", "suggestedOrderQty", "mustOrderByDate", "prQtySuggested", "prQtyCurrent"
    )
    WHERE i."id" = v."id"
  `;
}

/**
 * Deliberately NOT one giant transaction: the forecast-recompute step below touches EVERY item
 * in the catalog on every Purchase Lines import (not just the ones in the new file), so wrapping
 * it all in a single transaction held a lock on the entire items table for the whole import —
 * blocking any concurrent PR-qty edit until it finished. Each 500-item chunk now commits on its
 * own. A mid-import failure leaves earlier chunks committed rather than rolling back everything,
 * which is acceptable since every write here is a deterministic recompute from stored data —
 * simply re-running the import (or the next one) converges back to the same correct state.
 *
 * Each chunk re-reads its own items' current prIsOverride/prQtyCurrent INSIDE its own transaction
 * right before recomputing, rather than working off one snapshot fetched for the whole catalog
 * before any chunk started — the earlier snapshot-once approach had a window where a user's
 * PATCH /items/:id/pr committed after the snapshot but before that item's chunk ran would get
 * silently clobbered by the stale snapshot's prQtyCurrent/prIsOverride.
 *
 * Chunk size is deliberately smaller than it looks like it needs to be, and each transaction
 * carries an explicit generous timeout: 500 sequential per-item round-trips inside one
 * interactive transaction is fast enough on a local Postgres to seem fine, but against a real
 * (non-localhost) database it can exceed Prisma's default 5s transaction timeout and abort the
 * whole chunk with a P2028 error — confirmed for real against production. If the recompute loop
 * fails partway, the batch (and its already-inserted PurchaseLine rows) is deleted rather than
 * left sitting there marked COMMITTED with only some items actually refreshed.
 */
export async function commitPurchaseLinesImport(params: {
  rows: ParsedPurchaseLine[];
  fileName: string;
  uploadedById: number;
}): Promise<{ importBatchId: number; rowCount: number; itemsUpdated: number }> {
  const { rows, fileName, uploadedById } = params;

  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      fileType: "PURCHASE_LINES",
      uploadedById,
      rowCount: rows.length,
      status: "COMMITTED",
    },
  });

  const packingRules = await prisma.packingUnitRule.findMany({ where: { active: true } });
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
    await prisma.purchaseLine.createMany({
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

  const poBucketsByNo = new Map<string, [number, number, number, number, number, number]>();
  const poTotalsByNo = new Map<string, number>();
  for (const row of convertedRows) {
    poTotalsByNo.set(row.itemNoNormalized, (poTotalsByNo.get(row.itemNoNormalized) ?? 0) + row.outstandingQty);
    if (row.bucketMonth == null) continue; // beyond the 5-month forecast horizon
    const buckets = poBucketsByNo.get(row.itemNoNormalized) ?? [0, 0, 0, 0, 0, 0];
    buckets[row.bucketMonth] += row.outstandingQty;
    poBucketsByNo.set(row.itemNoNormalized, buckets);
  }

  // Mirrors the original's recomputeForecastWithPO(): it re-derives Next-1..5 (and now
  // poQty/"PO N0" itself) for EVERY item on every Purchase Lines import, not just the ones
  // present in the new file. Purchase Line data is the primary PO source — an item whose PO
  // lines disappeared from this import (received/cancelled) or that never had any drops to
  // poQty=0 and an unreplenished forecast, rather than keeping a stale value from the Items
  // file's own PO_N0 column forever.
  const allItemIds = (await prisma.item.findMany({ select: { id: true } })).map((i) => i.id);

  let itemsUpdated = 0;
  try {
    for (const idChunk of chunk(allItemIds, ITEM_RECOMPUTE_CHUNK_SIZE)) {
      await prisma.$transaction(
        async (tx) => {
          const itemChunk = await tx.item.findMany({
            where: { id: { in: idChunk } },
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

          const recomputeRows: ItemRecompute[] = [];
          const auditNotes: Array<{ itemId: number; oldValue: number | null; newValue: number | null }> = [];
          for (const item of itemChunk) {
            const poQty = poTotalsByNo.get(item.itemNoNormalized) ?? 0;
            const poBuckets = poBucketsByNo.get(item.itemNoNormalized) ?? [0, 0, 0, 0, 0, 0];
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

            recomputeRows.push({
              id: item.id,
              poQty,
              next0: next[0],
              next1: next[1],
              next2: next[2],
              next3: next[3],
              next4: next[4],
              next5: next[5],
              calcStatus,
              suggestedOrderQty: suggestion.orderQty,
              mustOrderByDate,
              prQtySuggested,
              prQtyCurrent,
            });

            if (item.prIsOverride && item.prQtyCurrent !== prQtyCurrent) {
              auditNotes.push({ itemId: item.id, oldValue: item.prQtyCurrent, newValue: prQtyCurrent });
            }

            itemsUpdated++;
          }

          await bulkUpdateItems(tx, recomputeRows);

          for (const note of auditNotes) {
            await recordChange(tx, {
              entityType: "Item",
              entityId: String(note.itemId),
              fieldName: "prQtyCurrent",
              oldValue: note.oldValue,
              newValue: note.newValue,
              action: "UPDATE",
              changedById: uploadedById,
              note: "Re-rounded to packing rule on Purchase Lines reimport",
            });
          }
        },
        { timeout: CHUNK_TRANSACTION_TIMEOUT_MS }
      );
    }
  } catch (err) {
    // A batch created early (needed so its PurchaseLine rows can reference importBatchId) that
    // then fails partway through the recompute would otherwise sit there marked COMMITTED with
    // only some items refreshed — deleting it (cascades to its PurchaseLine rows via the FK) keeps
    // the same "fully succeeded or leaves no trace" guarantee commitItemsImport.ts has.
    await prisma.importBatch.delete({ where: { id: batch.id } }).catch(() => {});
    throw err;
  }

  return { importBatchId: batch.id, rowCount: rows.length, itemsUpdated };
}
