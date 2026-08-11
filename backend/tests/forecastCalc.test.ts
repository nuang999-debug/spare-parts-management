import { describe, expect, it } from "vitest";
import {
  computeAvgMonth,
  computeMaxUsage,
  computeMinUsage,
  computeMustOrderByDate,
  computeNextForecast,
  computeRecommendedMin,
  computeStatus,
  computeSuggestedOrder,
  computeTrend,
} from "../src/services/forecastCalc";

// Real row from data 16-07-26.xlsx, item "010 3098 500": M-12..M-0
const HIST13 = [2, 4, 6, 6, 0, 6, 6, 18, 0, 43, 32, 3, 0];
const HIST6 = HIST13.slice(6, 12); // 6-month trend window M-6..M-1, excludes the current/incomplete month M-0
const STOCK_QTY = 52; // ST_N0
const PO_QTY = 60; // PO_N0
const LEAD_TIME_DAYS = 100;
const SUM_MIN = 40; // Summary MiN.ST

describe("computeAvgMonth", () => {
  it("averages the 12 prior months, excluding the current month M-0", () => {
    expect(computeAvgMonth(HIST13)).toBeCloseTo(10.5, 5);
  });
});

describe("computeMinUsage / computeMaxUsage", () => {
  it("ignores zero months for the minimum but not the maximum", () => {
    expect(computeMinUsage(HIST13)).toBe(2);
    expect(computeMaxUsage(HIST13)).toBe(43);
  });

  it("returns 0 for an all-zero history", () => {
    expect(computeMinUsage([0, 0, 0])).toBe(0);
    expect(computeMaxUsage([0, 0, 0])).toBe(0);
  });
});

describe("computeNextForecast", () => {
  it("dumps all outstanding PO into bucket 1 when no Purchase Lines import exists", () => {
    const avgMonth = computeAvgMonth(HIST13);
    const next = computeNextForecast(STOCK_QTY, [PO_QTY, 0, 0, 0, 0], avgMonth);
    expect(next[0]).toBeCloseTo(101.5, 5);
    expect(next[1]).toBeCloseTo(91, 5);
    expect(next[2]).toBeCloseTo(80.5, 5);
    expect(next[3]).toBeCloseTo(70, 5);
    expect(next[4]).toBeCloseTo(59.5, 5);
  });

  it("reallocates PO due dates when buckets are spread out", () => {
    const next = computeNextForecast(100, [0, 50, 0, 0, 0], 10);
    expect(next[0]).toBe(90); // 100 + 0 - 10
    expect(next[1]).toBe(130); // 90 + 50 - 10
  });
});

describe("computeStatus", () => {
  it("is OK when Sum MIN is not set", () => {
    expect(computeStatus(0, 0, null)).toBe("OK");
    expect(computeStatus(0, 0, 0)).toBe("OK");
  });

  it("is DANGER when Next-1 falls below Sum MIN", () => {
    expect(computeStatus(30, 90, 40)).toBe("DANGER");
  });

  it("is WARN when Next-1 is fine but Next-2 falls below Sum MIN", () => {
    expect(computeStatus(50, 30, 40)).toBe("WARN");
  });

  it("is OK for the real 010 3098 500 example (well above Sum MIN)", () => {
    const avgMonth = computeAvgMonth(HIST13);
    const next = computeNextForecast(STOCK_QTY, [PO_QTY, 0, 0, 0, 0], avgMonth);
    expect(computeStatus(next[0], next[1], SUM_MIN)).toBe("OK");
  });

  it("stays OK even with a negative forecast when no Sum MIN is set", () => {
    expect(computeStatus(-5, 10, null)).toBe("OK");
    expect(computeStatus(-5, -10, 0)).toBe("OK");
  });
});

describe("computeSuggestedOrder", () => {
  it("returns no trigger when forecasted stock never dips below Sum MIN", () => {
    const avgMonth = computeAvgMonth(HIST13);
    const next = computeNextForecast(STOCK_QTY, [PO_QTY, 0, 0, 0, 0], avgMonth);
    expect(computeSuggestedOrder(next, SUM_MIN)).toEqual({ triggerMonth: -1, orderQty: 0 });
  });

  it("suggests the shortfall at the first month that dips below Sum MIN", () => {
    expect(computeSuggestedOrder([50, 30, 20, 10, 5], 40)).toEqual({
      triggerMonth: 2,
      orderQty: 10, // ceil(40 - 30)
    });
  });
});

describe("computeMustOrderByDate", () => {
  it("returns null when there is no trigger month", () => {
    expect(computeMustOrderByDate(-1, 30, new Date("2026-01-01"))).toBeNull();
  });

  it("subtracts lead time from the days until the trigger month", () => {
    const result = computeMustOrderByDate(2, 30, new Date("2026-01-01"));
    // triggerMonth 2 -> 60 days out, minus 30 days lead time = 30 days from today
    expect(result?.toISOString().slice(0, 10)).toBe("2026-01-31");
  });

  it("floors at today when lead time exceeds the days until trigger", () => {
    const result = computeMustOrderByDate(1, 100, new Date("2026-01-01"));
    expect(result?.toISOString().slice(0, 10)).toBe("2026-01-01");
  });
});

describe("computeTrend", () => {
  it("flags an upward trend for the real 010 3098 500 example", () => {
    // HIST6 = [6, 18, 0, 43, 32, 3] -> old3 avg 8, new3 avg 26, +225%
    expect(computeTrend(HIST6)).toBe("UP");
  });

  it("flags an upward trend when recent usage is notably higher", () => {
    expect(computeTrend([10, 10, 10, 20, 20, 20])).toBe("UP");
  });

  it("is flat within the +/-8% band", () => {
    expect(computeTrend([10, 10, 10, 10, 10, 11])).toBe("FLAT");
  });

  it("is flat when the older 3 months had zero usage, even if usage picked up since", () => {
    // No baseline to compare against, so this is never counted as "up" — matches the original tool.
    expect(computeTrend([0, 0, 0, 20, 20, 20])).toBe("FLAT");
  });
});

describe("computeRecommendedMin", () => {
  it("matches the real 010 3098 500 example (avgMonth x leadTimeMonths x 1.2, unrounded)", () => {
    const avgMonth = computeAvgMonth(HIST13);
    expect(computeRecommendedMin(avgMonth, LEAD_TIME_DAYS)).toBeCloseTo(42, 5);
  });

  it("returns 0 when there is no lead time", () => {
    expect(computeRecommendedMin(10, null)).toBe(0);
    expect(computeRecommendedMin(10, 0)).toBe(0);
  });

  it("returns 0 when there is no average demand", () => {
    expect(computeRecommendedMin(0, 30)).toBe(0);
  });
});
