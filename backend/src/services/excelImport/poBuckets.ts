import { Prisma } from "@prisma/client";

export type PoBucketsMap = Map<string, [number, number, number, number, number]>;

export interface LatestPoData {
  /** Outstanding PO qty by item, bucketed into forecast months 1-5, from the most recently
   *  committed Purchase Lines import. Empty until a Purchase Lines file has ever been imported. */
  buckets: PoBucketsMap;
  /** Total outstanding PO qty by item across ALL lines in that same latest batch, including
   *  lines due more than 5 months out (excluded from `buckets`/the Next-1..5 forecast, but
   *  still a real outstanding PO). This is now the authoritative source for Item.poQty
   *  ("PO N0") — an item absent from the latest batch has no outstanding PO and reads 0; the
   *  Items-import file's own PO_N0 column is no longer used, since Purchase Line data is more
   *  current and this app never re-derives it any other way. */
  totals: Map<string, number>;
}

export async function loadLatestPoData(tx: Prisma.TransactionClient): Promise<LatestPoData> {
  const latestBatch = await tx.importBatch.findFirst({
    where: { fileType: "PURCHASE_LINES", status: "COMMITTED" },
    orderBy: { uploadedAt: "desc" },
  });
  const buckets: PoBucketsMap = new Map();
  const totals = new Map<string, number>();
  if (!latestBatch) return { buckets, totals };

  const lines = await tx.purchaseLine.findMany({
    where: { importBatchId: latestBatch.id },
    select: { itemNoNormalized: true, outstandingQty: true, bucketMonth: true },
  });
  for (const line of lines) {
    totals.set(line.itemNoNormalized, (totals.get(line.itemNoNormalized) ?? 0) + line.outstandingQty);
    if (!line.bucketMonth || line.bucketMonth < 1 || line.bucketMonth > 5) continue;
    const existing = buckets.get(line.itemNoNormalized) ?? [0, 0, 0, 0, 0];
    existing[line.bucketMonth - 1] += line.outstandingQty;
    buckets.set(line.itemNoNormalized, existing as [number, number, number, number, number]);
  }
  return { buckets, totals };
}
