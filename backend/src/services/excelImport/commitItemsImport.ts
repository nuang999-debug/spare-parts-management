import { Prisma } from "@prisma/client";
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

// 500 was too large once every row does its own network round-trip against a real (non-
// localhost) database: on Render's production Postgres, a 500-row chunk of sequential per-row
// upserts routinely exceeded Prisma's default 5s interactive-transaction timeout, aborting the
// whole chunk with a P2028 error — invisible on local dev, where the near-zero-latency localhost
// connection finishes 500 round-trips well under the limit. Now that the whole chunk's upsert is
// ONE bulk statement (see below) instead of one round-trip per row, this size is about parallel
// lock footprint, not round-trip count — kept the same value since it was never the bottleneck.
const ITEM_CHUNK_SIZE = 150;
const CHUNK_TRANSACTION_TIMEOUT_MS = 60_000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface PackingRuleLite {
  multipleOf: number;
  active: boolean;
}

interface ItemUpsertRow {
  itemNoRaw: string;
  itemNoNormalized: string;
  description: string;
  class: string | null;
  sourceStatus: number | null;
  category: string | null;
  dimension: string | null;
  purchasePrice: number | null;
  unitCost: number | null;
  vendor: string | null;
  poQty: number;
  stockQty: number;
  backorderQty: number;
  leadTimeDays: number | null;
  avgMonth: number | null;
  avgMonth6: number;
  minUsage: number | null;
  maxUsage: number | null;
  oldMin: number | null;
  sumMin: number | null;
  next0: number;
  next1: number;
  next2: number;
  next3: number;
  next4: number;
  next5: number;
  calcStatus: string;
  calcTrend: string;
  recommendedMin: number | null;
  suggestedOrderQty: number;
  mustOrderByDate: Date | null;
  prQtySuggested: number;
  prQtyCurrent: number | null;
  prIsOverride: boolean;
  remark: string | null;
  forModel: string | null;
  discontinuedModel: string | null;
  lastImportedAt: Date;
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
): ItemUpsertRow {
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
  const poBuckets = ctx.poBuckets.get(row.itemNoNormalized) ?? [0, 0, 0, 0, 0, 0];
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
    sourceStatus: row.sourceStatus,
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
    next0: next[0],
    next1: next[1],
    next2: next[2],
    next3: next[3],
    next4: next[4],
    next5: next[5],
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
 * One INSERT ... ON CONFLICT DO UPDATE statement for the whole chunk instead of one upsert
 * round-trip per row — the original per-row loop was fine against localhost Postgres but became
 * the actual bottleneck once the database moved off-network (Supabase): ~150 sequential
 * round-trips per chunk at real internet latency (~100-150ms each) made a full 11k-row import
 * take 15-25 minutes and regularly outlast the platform's HTTP proxy timeout, leaving the UI
 * stuck on "Importing..." even though the backend eventually finished. This bulk statement does
 * the same 150 upserts in one round-trip regardless of network latency.
 */
async function bulkUpsertItems(
  tx: Prisma.TransactionClient,
  rows: ItemUpsertRow[]
): Promise<{ id: number; itemNoNormalized: string }[]> {
  if (rows.length === 0) return [];

  const columns = [
    "itemNoRaw",
    "itemNoNormalized",
    "description",
    "class",
    "sourceStatus",
    "category",
    "dimension",
    "purchasePrice",
    "unitCost",
    "vendor",
    "poQty",
    "stockQty",
    "backorderQty",
    "leadTimeDays",
    "avgMonth",
    "avgMonth6",
    "minUsage",
    "maxUsage",
    "oldMin",
    "sumMin",
    "next0",
    "next1",
    "next2",
    "next3",
    "next4",
    "next5",
    "calcStatus",
    "calcTrend",
    "recommendedMin",
    "suggestedOrderQty",
    "mustOrderByDate",
    "prQtySuggested",
    "prQtyCurrent",
    "prIsOverride",
    "remark",
    "forModel",
    "discontinuedModel",
    "lastImportedAt",
    "updatedAt",
  ] as const;

  const valueTuples = rows.map(
    (r) => Prisma.sql`(
      ${r.itemNoRaw}, ${r.itemNoNormalized}, ${r.description}, ${r.class},
      ${r.sourceStatus}::integer, ${r.category}, ${r.dimension},
      ${r.purchasePrice}::double precision, ${r.unitCost}::double precision, ${r.vendor},
      ${r.poQty}::double precision, ${r.stockQty}::double precision, ${r.backorderQty}::double precision,
      ${r.leadTimeDays}::double precision, ${r.avgMonth}::double precision, ${r.avgMonth6}::double precision,
      ${r.minUsage}::double precision, ${r.maxUsage}::double precision, ${r.oldMin}::double precision,
      ${r.sumMin}::double precision, ${r.next0}::double precision, ${r.next1}::double precision,
      ${r.next2}::double precision, ${r.next3}::double precision, ${r.next4}::double precision,
      ${r.next5}::double precision, ${r.calcStatus}::"CalcStatus", ${r.calcTrend}::"CalcTrend",
      ${r.recommendedMin}::double precision, ${r.suggestedOrderQty}::double precision,
      ${r.mustOrderByDate}::timestamp, ${r.prQtySuggested}::double precision,
      ${r.prQtyCurrent}::double precision, ${r.prIsOverride}::boolean, ${r.remark}, ${r.forModel},
      ${r.discontinuedModel}, ${r.lastImportedAt}::timestamp, ${r.lastImportedAt}::timestamp
    )`
  );

  const columnListSql = Prisma.raw(columns.map((c) => `"${c}"`).join(", "));
  const updateSetSql = Prisma.raw(
    columns
      .filter((c) => c !== "itemNoNormalized")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ")
  );

  return tx.$queryRaw<{ id: number; itemNoNormalized: string }[]>`
    INSERT INTO "items" (${columnListSql})
    VALUES ${Prisma.join(valueTuples, ", ")}
    ON CONFLICT ("itemNoNormalized") DO UPDATE SET ${updateSetSql}
    RETURNING "id", "itemNoNormalized"
  `;
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

      const upsertRows: ItemUpsertRow[] = [];
      const auditNotes: Array<{ itemNoNormalized: string; oldValue: number | null; newValue: number | null }> = [];
      for (const row of rowChunk) {
        const existingPr = existingByNo.get(row.itemNoNormalized);
        const data = computeItemData(row, {
          existingPr,
          packingRule: packingRuleByNo.get(row.itemNoNormalized),
          poBuckets,
          poTotals,
          now,
        });
        upsertRows.push(data);

        // A user's manually-overridden PR qty gets re-rounded to the CURRENT packing rule on
        // every reimport (e.g. the multiple-of value changed since they set it) — that silently
        // changes a value they explicitly chose, so it needs the same audit trail as any other
        // PR edit, not just the ones made through the PATCH endpoint.
        if (existingPr?.prIsOverride && existingPr.prQtyCurrent !== data.prQtyCurrent) {
          auditNotes.push({
            itemNoNormalized: row.itemNoNormalized,
            oldValue: existingPr.prQtyCurrent,
            newValue: data.prQtyCurrent,
          });
        }
      }

      const upserted = await bulkUpsertItems(tx, upsertRows);
      const itemIdByNo = new Map(upserted.map((i) => [i.itemNoNormalized, i.id]));

      for (const note of auditNotes) {
        const itemId = itemIdByNo.get(note.itemNoNormalized);
        if (itemId === undefined) continue;
        await recordChange(tx, {
          entityType: "Item",
          entityId: String(itemId),
          fieldName: "prQtyCurrent",
          oldValue: note.oldValue,
          newValue: note.newValue,
          action: "UPDATE",
          changedById: uploadedById,
          note: "Re-rounded to packing rule on reimport",
        });
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
    }, { timeout: CHUNK_TRANSACTION_TIMEOUT_MS });
  }

  // Created only after every chunk has actually succeeded — matches the old single-transaction
  // behavior where a mid-import failure left no batch row at all. Creating this upfront (the
  // earlier version of this function) meant a crash partway through left a batch row claiming
  // COMMITTED with the full row count while most items were never touched, which then fooled
  // every item's isStale check into thinking it was current when it wasn't.
  // uploadedAt is pinned to the SAME `now` every item's lastImportedAt was stamped with (rather
  // than defaulting to the current time, which by definition runs later than that, since this
  // insert happens after the whole chunk loop) — otherwise isStale's `lastImportedAt < latest
  // batch's uploadedAt` check would compare every just-updated item's now-in-the-past timestamp
  // against a strictly-later batch timestamp and flag the entire catalog stale immediately after
  // a fully successful import.
  const batch = await prisma.importBatch.create({
    data: {
      fileName,
      fileType: "ITEMS_RAW",
      uploadedById,
      rowCount: rows.length,
      status: "COMMITTED",
      uploadedAt: now,
    },
  });

  return { importBatchId: batch.id, rowCount: rows.length };
}
