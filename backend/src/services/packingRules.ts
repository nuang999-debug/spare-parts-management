export function roundUpToMultiple(qty: number, multipleOf: number): number {
  if (multipleOf <= 0 || qty <= 0) return qty;
  return Math.ceil(qty / multipleOf) * multipleOf;
}

export function applyPackingRule(
  qty: number,
  rule: { multipleOf: number; active: boolean } | null | undefined
): number {
  if (!rule || !rule.active) return qty;
  return roundUpToMultiple(qty, rule.multipleOf);
}
