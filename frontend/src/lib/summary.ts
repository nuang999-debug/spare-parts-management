import type { ItemListRow } from "../api/items";

export interface ChangeRow {
  itemNoRaw: string;
  description: string | null;
  class: string | null;
  category: string | null;
  vendor: string | null;
  avgMonth: number | null;
  leadTimeDays: number | null;
  oldMin: number;
  sumMin: number;
  stockQty: number;
  purchasePrice: number | null;
  forModel: string | null;
  diff: number;
}

export interface SummaryData {
  base: ItemListRow[];
  totalItems: number;
  totalStock: number;
  totalValue: number;
  dangerCnt: number;
  warnCnt: number;
  prItems: number;
  prValue: number;
  increased: ChangeRow[];
  decreased: ChangeRow[];
  newItems: ChangeRow[];
  top15: Array<{ label: string; diff: number }>;
  upTrend: number;
  downTrend: number;
  flatTrend: number;
  totalNext: [number, number, number, number, number];
  sumMinTotal: number;
  contItems: ItemListRow[];
  discItems: ItemListRow[];
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function toChangeRow(d: ItemListRow): ChangeRow {
  return {
    itemNoRaw: d.itemNoRaw,
    description: d.description,
    class: d.class,
    category: d.category,
    vendor: d.vendor,
    avgMonth: d.avgMonth,
    leadTimeDays: d.leadTimeDays,
    oldMin: d.oldMin ?? 0,
    sumMin: d.sumMin ?? 0,
    stockQty: d.stockQty,
    purchasePrice: d.purchasePrice,
    forModel: d.forModel,
    diff: (d.sumMin ?? 0) - (d.oldMin ?? 0),
  };
}

/** Mirrors the original app's renderSummary(): every stat here excludes items where Sum MIN (BC) is 0. */
export function buildSummaryData(items: ItemListRow[]): SummaryData {
  const base = items.filter((d) => (d.sumMin ?? 0) > 0);

  const totalStock = base.reduce((s, d) => s + d.stockQty, 0);
  const totalValue = base.reduce((s, d) => s + d.stockQty * (d.purchasePrice ?? 0), 0);
  const dangerCnt = base.filter((d) => d.calcStatus === "DANGER").length;
  const warnCnt = base.filter((d) => d.calcStatus === "WARN").length;
  const prItems = base.filter((d) => (d.prQtyCurrent ?? 0) > 0).length;
  const prValue = base.reduce((s, d) => s + (d.prQtyCurrent ?? 0) * (d.purchasePrice ?? 0), 0);

  const increased = base
    .filter((d) => (d.oldMin ?? 0) > 0 && (d.sumMin ?? 0) > (d.oldMin ?? 0))
    .map(toChangeRow)
    .sort((a, b) => b.diff - a.diff);
  const decreased = base
    .filter((d) => (d.oldMin ?? 0) > 0 && (d.sumMin ?? 0) < (d.oldMin ?? 0))
    .map(toChangeRow)
    .sort((a, b) => a.diff - b.diff);
  const newItems = base.filter((d) => (d.oldMin ?? 0) === 0 && (d.sumMin ?? 0) > 0).map(toChangeRow);

  const combined = [...increased, ...decreased]
    .map((d) => ({ label: truncate(d.description || d.itemNoRaw, 14), diff: d.diff }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const top15 = combined.slice(0, 15);

  const upTrend = base.filter((d) => d.calcTrend === "UP").length;
  const downTrend = base.filter((d) => d.calcTrend === "DOWN").length;
  const flatTrend = base.length - upTrend - downTrend;

  const totalNext: [number, number, number, number, number] = [
    base.reduce((s, d) => s + (d.next1 ?? 0), 0),
    base.reduce((s, d) => s + (d.next2 ?? 0), 0),
    base.reduce((s, d) => s + (d.next3 ?? 0), 0),
    base.reduce((s, d) => s + (d.next4 ?? 0), 0),
    base.reduce((s, d) => s + (d.next5 ?? 0), 0),
  ];
  const sumMinTotal = base.reduce((s, d) => s + (d.sumMin ?? 0), 0);

  // ItemListRow.usageHistory is already pre-filtered to the last 6 months (monthIndex >= 7) by the API.
  const nonZeroMonths6 = (d: ItemListRow) => d.usageHistory.filter((h) => h.qty > 0).length;
  const contItems = base.filter((d) => nonZeroMonths6(d) >= 3).sort((a, b) => b.stockQty - a.stockQty);
  const discItems = base.filter((d) => nonZeroMonths6(d) < 3).sort((a, b) => b.stockQty - a.stockQty);

  return {
    base,
    totalItems: base.length,
    totalStock,
    totalValue,
    dangerCnt,
    warnCnt,
    prItems,
    prValue,
    increased,
    decreased,
    newItems,
    top15,
    upTrend,
    downTrend,
    flatTrend,
    totalNext,
    sumMinTotal,
    contItems,
    discItems,
  };
}

export interface MonthsToNormal {
  found: boolean;
  monthIdx?: number;
  label?: string;
  value?: number;
}

/** First month (0=current, 1-5=Next-1..5) where the projected total stock reaches Sum MIN total. */
export function calcMonthsToNormal(currentStock: number, totalNext: number[], sumMinTotal: number): MonthsToNormal | null {
  if (sumMinTotal <= 0) return null;
  const totals = [currentStock, ...totalNext];
  const labels = ["ปัจจุบัน", "Next-1", "Next-2", "Next-3", "Next-4", "Next-5"];
  for (let i = 0; i < totals.length; i++) {
    if (totals[i] >= sumMinTotal) {
      return { monthIdx: i, label: labels[i], found: true, value: totals[i] };
    }
  }
  return { found: false };
}
