import { describe, expect, it } from "vitest";
import { applyPackingRule, roundUpToMultiple } from "../src/services/packingRules";

describe("roundUpToMultiple", () => {
  it("rounds up to the next multiple", () => {
    expect(roundUpToMultiple(23, 10)).toBe(30);
    expect(roundUpToMultiple(20, 10)).toBe(20);
    expect(roundUpToMultiple(1, 25)).toBe(25);
  });

  it("matches the 6 real packing-rule items", () => {
    expect(roundUpToMultiple(3, 10)).toBe(10); // 140 7015 040 / 140 8618 000
    expect(roundUpToMultiple(12, 5)).toBe(15); // 81620000
    expect(roundUpToMultiple(26, 25)).toBe(50); // 82309600 / 82365500 / 82295600
  });

  it("leaves 0 as 0 (no forced minimum order)", () => {
    expect(roundUpToMultiple(0, 10)).toBe(0);
  });

  it("passes through unchanged when multipleOf is 0 or negative", () => {
    expect(roundUpToMultiple(23, 0)).toBe(23);
    expect(roundUpToMultiple(23, -5)).toBe(23);
  });
});

describe("applyPackingRule", () => {
  it("returns the qty unchanged when there is no rule", () => {
    expect(applyPackingRule(23, null)).toBe(23);
    expect(applyPackingRule(23, undefined)).toBe(23);
  });

  it("returns the qty unchanged when the rule is inactive", () => {
    expect(applyPackingRule(23, { multipleOf: 10, active: false })).toBe(23);
  });

  it("rounds when the rule is active", () => {
    expect(applyPackingRule(23, { multipleOf: 10, active: true })).toBe(30);
  });
});
