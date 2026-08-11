// Excel autocorrect silently swaps a typed straight quote/apostrophe for its "smart" Unicode
// counterpart (e.g. 18"RED -> 18"RED with U+201D) — two exports of the exact same item can end
// up with different raw quote characters, and without this normalization they land as two
// separate item rows with sales history split between them (found for real: SW44-18"RED).
const SMART_QUOTES: [RegExp, string][] = [
  [/[“”„″]/g, '"'],
  [/[‘’‚′]/g, "'"],
];

export function normalizeItemNo(raw: string | number): string {
  let s = String(raw).trim().replace(/\s+/g, "");
  for (const [pattern, replacement] of SMART_QUOTES) s = s.replace(pattern, replacement);
  return s;
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
