/**
 * Mirrors the original's nv(): lenient like parseFloat, not strict like Number() — a cell value
 * of "30 days" or "1,234abc" still yields a usable leading number instead of silently becoming 0.
 */
export function toNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[*,]/g, "").trim();
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toNumber(v: unknown): number {
  return toNumberOrNull(v) ?? 0;
}
