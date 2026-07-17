import { Prisma } from "@prisma/client";

export type PoBucketsMap = Map<string, [number, number, number, number, number]>;

/**
 * Outstanding PO qty by item, bucketed into forecast months 1-5, from the most recently
 * committed Purchase Lines import. Empty until a Purchase Lines file has ever been imported
 * (task 9) — callers fall back to dumping PO_N0 into bucket 1, matching the old app.
 */
export async function loadLatestPoBucketsMap(tx: Prisma.TransactionClient): Promise<PoBucketsMap> {
  const latestBatch = await tx.importBatch.findFirst({
    where: { fileType: "PURCHASE_LINES", status: "COMMITTED" },
    orderBy: { uploadedAt: "desc" },
  });
  const map: PoBucketsMap = new Map();
  if (!latestBatch) return map;

  const lines = await tx.purchaseLine.findMany({
    where: { importBatchId: latestBatch.id },
    select: { itemNoNormalized: true, outstandingQty: true, bucketMonth: true },
  });
  for (const line of lines) {
    if (!line.bucketMonth || line.bucketMonth < 1 || line.bucketMonth > 5) continue;
    const existing = map.get(line.itemNoNormalized) ?? [0, 0, 0, 0, 0];
    existing[line.bucketMonth - 1] += line.outstandingQty;
    map.set(line.itemNoNormalized, existing as [number, number, number, number, number]);
  }
  return map;
}
