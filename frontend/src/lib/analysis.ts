import type { ItemDetail } from "../api/items";
import { thaiMonthLabel } from "./thaiMonths";

export function average(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function stdev(values: number[]): number {
  if (!values.length) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((v) => (v - mean) ** 2)));
}

export interface TriggerResult {
  triggerMonth: number; // 1-5, or -1 if no trigger within the 5-month horizon
  orderQty: number;
}

/** Mirrors backend computeSuggestedOrder — first forecast month that dips below Sum MIN. */
export function findTrigger(next: number[], sumMin: number | null): TriggerResult {
  if (sumMin && sumMin > 0) {
    for (let i = 0; i < next.length; i++) {
      if (next[i] < sumMin) {
        return { triggerMonth: i + 1, orderQty: Math.max(0, Math.ceil(sumMin - next[i])) };
      }
    }
  }
  return { triggerMonth: -1, orderQty: 0 };
}

export type Urgency = "danger" | "warn" | "info" | "ok";

export function urgencyLabel(triggerMonth: number): { label: string; tone: Urgency } {
  if (triggerMonth === 1) return { label: "สั่งด่วน!", tone: "danger" };
  if (triggerMonth === 2) return { label: "ควรสั่งเร็วๆ นี้", tone: "warn" };
  if (triggerMonth >= 3) return { label: "วางแผนสั่ง", tone: "info" };
  return { label: "ยังไม่จำเป็น", tone: "ok" };
}

/**
 * % change of the newer half of a 6-month window vs the older half. Mirrors backend
 * computeTrend()'s exact-zero-baseline rule: an all-zero older half has no real percentage to
 * report (it isn't "infinite growth"), so it's 0, matching the backend's unconditional FLAT
 * classification for that case — returning 100 here used to produce self-contradicting text
 * like "ทรงตัว (+100.0%)" and a spurious "เทรนด์ขาขึ้น" suggestion on an item the table itself
 * correctly shows as FLAT.
 */
export function trendPercent(hist6: number[]): number {
  const old3 = average(hist6.slice(0, 3));
  const new3 = average(hist6.slice(3, 6));
  if (old3 > 0) return ((new3 - old3) / old3) * 100;
  return 0;
}

/** Deviation of each of the 6 months from AVG/M (the 12-month average) — NOT from hist6's own mean. */
export function volatilityPercent(hist6: number[], avgMonth: number): number {
  if (avgMonth <= 0) return 0;
  const variance = average(hist6.map((v) => (v - avgMonth) ** 2));
  return (Math.sqrt(variance) / avgMonth) * 100;
}

export interface MonthExtreme {
  value: number;
  label: string;
}

/** hist6 offsets run -6..-1 (oldest to newest), excluding the current/incomplete month. */
export function maxMonth(hist6: number[]): MonthExtreme {
  const value = Math.max(...hist6);
  const idx = hist6.indexOf(value);
  return { value, label: thaiMonthLabel(idx - 6) };
}

export function minMonth(hist6: number[]): MonthExtreme {
  const value = Math.min(...hist6);
  const idx = hist6.indexOf(value);
  return { value, label: thaiMonthLabel(idx - 6) };
}

export function mustOrderByDays(triggerMonth: number, leadTimeDays: number | null): number {
  if (triggerMonth < 1) return 0;
  return Math.max(0, triggerMonth * 30 - (leadTimeDays ?? 0));
}

export function safetyFactorFor(volatilityPct: number): number {
  return volatilityPct > 50 ? 1.5 : volatilityPct > 30 ? 1.3 : 1.15;
}

/**
 * Live, unsaved "what if this PR arrives" preview — does NOT touch the real Next-1..5 (those
 * only ever move from a confirmed PO's Expected Receipt Date, matching standard MRP practice
 * where a requisition isn't counted as a scheduled receipt). Since next[i] is a running total
 * (stock + cumulative PO - cumulative avg), adding prQty at one bucket shifts every next[i]
 * from that bucket onward by the same flat +prQty — no need to know the real PO breakdown.
 */
export function whatIfBucket(leadTimeDays: number | null): number {
  return Math.min(5, Math.max(1, Math.ceil((leadTimeDays ?? 0) / 30)));
}

export function computeWhatIfNext(next: readonly number[], leadTimeDays: number | null, prQty: number): number[] {
  const bucket = whatIfBucket(leadTimeDays);
  return next.map((v, i) => (i + 1 >= bucket ? v + prQty : v));
}

export type CellTone = "ok" | "warn" | "danger";

/** Mirrors backend ncls(): red below Sum MIN, amber within 15% above it, else green. */
export function nextCellTone(value: number, sumMin: number | null): CellTone {
  if (!sumMin || sumMin <= 0) return "ok";
  if (value < sumMin) return "danger";
  if (value < sumMin * 1.15) return "warn";
  return "ok";
}

export interface ItemAnalysis {
  hist6: number[];
  next: number[];
  triggerMonth: number;
  orderQty: number;
  /** orderQty rounded up to the item's packing-unit multiple (server-computed prQtySuggested),
   *  when one applies — this is the quantity that should actually be purchased/shown to the
   *  user, vs. orderQty's raw pre-rounding math. */
  recommendedOrderQty: number;
  urgency: { label: string; tone: Urgency };
  triggerValue: number | null;
  triggerMonthLabel: string;
  triggerLetter: string;
  trendPct: number;
  volatilityPct: number;
  nonZeroMonths: number;
  max: MonthExtreme;
  min: MonthExtreme;
  daysToOrder: number;
  estimatedValue: number;
  /** How many of Next-1..5 fall below Sum MIN (0-5) — drives the 4-tier risk assessment. */
  belowMinCount: number;
}

const NEXT_LETTERS = ["BH", "BI", "BJ", "BK", "BL"];

export function analyzeItem(item: ItemDetail): ItemAnalysis {
  const hist13 = item.usageHistory.map((h) => h.qty);
  // The 6-month trend window (AO-AT) is M-6..M-1 — excludes the current/incomplete month M-0.
  const hist6 = hist13.slice(6, 12);
  const next = [item.next1, item.next2, item.next3, item.next4, item.next5].map((v) => v ?? 0);

  const { triggerMonth, orderQty } = findTrigger(next, item.sumMin);
  const triggerValue = triggerMonth > 0 ? next[triggerMonth - 1] : null;
  // prQtySuggested is the backend's orderQty already rounded up to the item's packing-unit
  // multiple (see backend applyPackingRule) — falls back to the raw orderQty when the item has
  // no active packing rule, since the backend then stores them equal.
  const recommendedOrderQty = item.prQtySuggested ?? orderQty;

  return {
    hist6,
    next,
    triggerMonth,
    orderQty,
    recommendedOrderQty,
    urgency: urgencyLabel(triggerMonth),
    triggerValue,
    triggerMonthLabel: triggerMonth > 0 ? thaiMonthLabel(triggerMonth) : "-",
    triggerLetter: triggerMonth > 0 ? NEXT_LETTERS[triggerMonth - 1] : "-",
    trendPct: trendPercent(hist6),
    volatilityPct: volatilityPercent(hist6, item.avgMonth ?? 0),
    nonZeroMonths: hist6.filter((v) => v > 0).length,
    max: maxMonth(hist6),
    min: minMonth(hist6),
    daysToOrder: mustOrderByDays(triggerMonth, item.leadTimeDays),
    estimatedValue: recommendedOrderQty * (item.purchasePrice ?? 0),
    belowMinCount:
      item.sumMin != null && item.sumMin > 0 ? next.filter((v) => v < (item.sumMin ?? 0)).length : 0,
  };
}
