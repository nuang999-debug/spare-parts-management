import { describe, expect, it } from "vitest";
import { normalizeItemNo, normalizePurchaseLineItemNo } from "../src/lib/itemNo";

describe("normalizeItemNo", () => {
  it("strips whitespace", () => {
    expect(normalizeItemNo("140 7015 040")).toBe("1407015040");
  });

  it("coerces a plain Excel number to a string", () => {
    expect(normalizeItemNo(81620000)).toBe("81620000");
  });

  it("collapses smart quotes/apostrophes from Excel autocorrect to their straight ASCII form", () => {
    expect(normalizeItemNo('SW44-18"RED')).toBe('SW44-18"RED');
    expect(normalizeItemNo("SW44-18”RED")).toBe('SW44-18"RED');
    expect(normalizeItemNo("SW44-18“RED")).toBe('SW44-18"RED');
    expect(normalizeItemNo("O’RING")).toBe("O'RING");
    expect(normalizeItemNo("O‘RING")).toBe("O'RING");
  });
});

describe("normalizePurchaseLineItemNo", () => {
  it("strips a trailing .0 float artifact in addition to normal normalization", () => {
    expect(normalizePurchaseLineItemNo("8500123.0")).toBe("8500123");
  });
});
