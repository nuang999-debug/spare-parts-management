export type CalcStatus = "OK" | "WARN" | "DANGER";
export type CalcTrend = "UP" | "DOWN" | "FLAT";

/** hist13 is M-12..M-0, oldest to newest (13 values). */
export function computeAvgMonth(hist13: number[]): number {
  const priorMonths = hist13.slice(0, 12); // excludes current month M-0
  return priorMonths.reduce((sum, v) => sum + v, 0) / 12;
}

export function computeMinUsage(hist13: number[]): number {
  const nonZero = hist13.filter((v) => v > 0);
  return nonZero.length ? Math.min(...nonZero) : 0;
}

export function computeMaxUsage(hist13: number[]): number {
  return hist13.length ? Math.max(...hist13) : 0;
}

/**
 * poByBucket[i] is outstanding PO qty due in forecast month i+1 (1-5).
 * With no Purchase Lines import yet, callers pass all outstanding PO in bucket 1
 * (index 0) and zero elsewhere, matching the old app's fallback.
 */
export function computeNextForecast(
  stockQty: number,
  poByBucket: [number, number, number, number, number],
  avgMonth: number
): [number, number, number, number, number] {
  const result: number[] = [];
  let running = stockQty;
  for (let i = 0; i < 5; i++) {
    running = running + poByBucket[i] - avgMonth;
    result.push(running);
  }
  return result as [number, number, number, number, number];
}

export function computeStatus(next1: number, next2: number, sumMin: number | null): CalcStatus {
  if (!sumMin || sumMin <= 0) return "OK";
  if (next1 < sumMin) return "DANGER";
  if (next2 < sumMin) return "WARN";
  return "OK";
}

/** hist6 is the last 6 months, oldest to newest. Compares the older 3 vs the newer 3. */
export function computeTrend(hist6: number[]): CalcTrend {
  const old3 = average(hist6.slice(0, 3));
  const new3 = average(hist6.slice(3, 6));
  // Matches the original's `if(a===0)return 'flat'` exactly — a negative old3 still computes
  // a real ratio below, it's only an exact-zero average that short-circuits to flat.
  if (old3 === 0) return "FLAT";
  const pctChange = ((new3 - old3) / old3) * 100;
  if (pctChange > 8) return "UP";
  if (pctChange < -8) return "DOWN";
  return "FLAT";
}

export interface SuggestedOrder {
  triggerMonth: number; // 1-5, or -1 if no trigger within the 5-month horizon
  orderQty: number;
}

export function computeSuggestedOrder(
  nextForecast: readonly number[],
  sumMin: number | null
): SuggestedOrder {
  if (sumMin && sumMin > 0) {
    for (let i = 0; i < nextForecast.length; i++) {
      if (nextForecast[i] < sumMin) {
        return { triggerMonth: i + 1, orderQty: Math.max(0, Math.ceil(sumMin - nextForecast[i])) };
      }
    }
  }
  return { triggerMonth: -1, orderQty: 0 };
}

export function computeMustOrderByDate(
  triggerMonth: number,
  leadTimeDays: number | null,
  today: Date
): Date | null {
  if (triggerMonth < 1) return null;
  const daysToTrigger = triggerMonth * 30;
  const mustOrderByDays = Math.max(0, daysToTrigger - (leadTimeDays ?? 0));
  return new Date(today.getTime() + mustOrderByDays * 86_400_000);
}

/**
 * New MIN.ST (BA) — advisory only, never overwrites the authoritative Sum MIN (sumMin).
 * Mirrors the original's one-time import-time formula exactly: ba = leadTime ? avgMonth*(leadTime/30)*1.2 : 0.
 * (The volatility-based 1.15/1.3/1.5 safety factor is a *different*, narrative-only suggestion
 * computed fresh in the frontend deep-analysis text — it never overwrites this persisted field.)
 */
export function computeRecommendedMin(avgMonth: number, leadTimeDays: number | null): number {
  if (!leadTimeDays) return 0;
  const leadTimeMonths = leadTimeDays / 30;
  return avgMonth * leadTimeMonths * 1.2;
}

function average(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}
