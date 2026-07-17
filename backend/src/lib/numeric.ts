export function toNumberOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const cleaned = String(v).replace(/[*,]/g, "").trim();
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toNumber(v: unknown): number {
  return toNumberOrNull(v) ?? 0;
}
