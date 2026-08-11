import type { CalcTrend, ItemListRow, ItemUsageHistoryRow } from "../api/items";

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
  remark: string | null;
  diff: number;
  calcTrend: CalcTrend | null;
  /** Last 6 months only (monthIndex 6-11 / M-6..M-1), same window the Excel export splits into
   *  per-month columns and derives the trend % from — matches ItemListRow's own scope. */
  usageHistory: ItemUsageHistoryRow[];
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
  upTrend: number;
  downTrend: number;
  flatTrend: number;
  totalNext: [number, number, number, number, number];
  sumMinTotal: number;
  contItems: ItemListRow[];
  discItems: ItemListRow[];
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
    remark: d.remark,
    diff: (d.sumMin ?? 0) - (d.oldMin ?? 0),
    calcTrend: d.calcTrend,
    usageHistory: d.usageHistory,
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

  // Sourced from the full `items` list, not `base` — a MIN that dropped all the way to 0 is
  // still a real "decreased" transition (arguably the most extreme one) and must not disappear
  // from this list just because the item no longer qualifies for the base>0 KPI aggregates below.
  // (increased/newItems both already imply sumMin>0 via their own filter, so switching their
  // source from base to items changes nothing for them — only decreased's result set grows.)
  const increased = items
    .filter((d) => (d.oldMin ?? 0) > 0 && (d.sumMin ?? 0) > (d.oldMin ?? 0))
    .map(toChangeRow)
    .sort((a, b) => b.diff - a.diff);
  const decreased = items
    .filter((d) => (d.oldMin ?? 0) > 0 && (d.sumMin ?? 0) < (d.oldMin ?? 0))
    .map(toChangeRow)
    .sort((a, b) => a.diff - b.diff);
  const newItems = items.filter((d) => (d.oldMin ?? 0) === 0 && (d.sumMin ?? 0) > 0).map(toChangeRow);

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
    upTrend,
    downTrend,
    flatTrend,
    totalNext,
    sumMinTotal,
    contItems,
    discItems,
  };
}

export interface CategoryMinBreakdownRow {
  category: string | null;
  label: string;
  total: number;
  withMin: number;
  withoutMin: number;
  stockWithMin: number;
  stockWithoutMin: number;
}

const CATEGORY_ORDER = ["MACHINE", "PART"];

/** Counts every item (not just base's sumMin>0 subset) by Category, split on whether Sum MIN(BC)
 *  is set — this is the one section of the Summary page meant to show coverage gaps, so it must
 *  not pre-filter to base like the rest of buildSummaryData does. */
export function buildCategoryMinBreakdown(items: ItemListRow[]): CategoryMinBreakdownRow[] {
  const groups = new Map<string, { total: number; withMin: number; stockWithMin: number; stockWithoutMin: number }>();
  for (const it of items) {
    const key = it.category ?? "(ไม่ระบุกลุ่ม)";
    const g = groups.get(key) ?? { total: 0, withMin: 0, stockWithMin: 0, stockWithoutMin: 0 };
    g.total++;
    if ((it.sumMin ?? 0) > 0) {
      g.withMin++;
      g.stockWithMin += it.stockQty;
    } else {
      g.stockWithoutMin += it.stockQty;
    }
    groups.set(key, g);
  }
  const rows: CategoryMinBreakdownRow[] = [];
  for (const key of CATEGORY_ORDER) {
    const g = groups.get(key);
    if (g)
      rows.push({
        category: key,
        label: key,
        total: g.total,
        withMin: g.withMin,
        withoutMin: g.total - g.withMin,
        stockWithMin: g.stockWithMin,
        stockWithoutMin: g.stockWithoutMin,
      });
    groups.delete(key);
  }
  for (const [key, g] of groups) {
    rows.push({
      category: null,
      label: key,
      total: g.total,
      withMin: g.withMin,
      withoutMin: g.total - g.withMin,
      stockWithMin: g.stockWithMin,
      stockWithoutMin: g.stockWithoutMin,
    });
  }
  return rows;
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
