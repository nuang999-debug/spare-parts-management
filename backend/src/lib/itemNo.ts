export function normalizeItemNo(raw: string | number): string {
  return String(raw).trim().replace(/\s+/g, "");
}

/**
 * Purchase Lines item numbers get an extra ".0" float-suffix strip that the original applies
 * only on this import path (`String(row[idxNo]).trim().replace(/\.0$/,'')`) — a known artifact
 * of numeric IDs round-tripped through a float somewhere upstream (e.g. pandas/Power Query)
 * before landing in the Business Central export. Without this, a PO line like "8500123.0"
 * would never match the item master's "8500123" and its outstanding qty would silently vanish.
 */
export function normalizePurchaseLineItemNo(raw: string | number): string {
  return normalizeItemNo(String(raw).trim().replace(/\.0$/, ""));
}
