import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { computeBucketMonth, parsePurchaseLinesWorkbook } from "../src/services/excelImport/parsePurchaseLines";

describe("computeBucketMonth", () => {
  const today = new Date(2026, 6, 17); // 2026-07-17

  it("buckets undated lines into Next-1", () => {
    expect(computeBucketMonth(null, today)).toBe(1);
  });

  it("buckets overdue and this/next-month receipts into Next-1", () => {
    expect(computeBucketMonth(new Date(2026, 5, 1), today)).toBe(1); // last month
    expect(computeBucketMonth(new Date(2026, 6, 30), today)).toBe(1); // this month
    expect(computeBucketMonth(new Date(2026, 7, 15), today)).toBe(1); // next month
  });

  it("buckets by calendar-month difference, not day count / 30", () => {
    // Same calendar-month diff (2) despite very different day counts either side of a month boundary.
    expect(computeBucketMonth(new Date(2026, 8, 1), today)).toBe(2); // 2026-09-01, 46 days out
    expect(computeBucketMonth(new Date(2026, 8, 30), today)).toBe(2); // 2026-09-30, 75 days out
  });

  it("buckets months 3 through 5 correctly", () => {
    expect(computeBucketMonth(new Date(2026, 9, 5), today)).toBe(3);
    expect(computeBucketMonth(new Date(2026, 10, 20), today)).toBe(4);
    expect(computeBucketMonth(new Date(2026, 11, 1), today)).toBe(5);
  });

  it("excludes receipts more than 5 months out", () => {
    expect(computeBucketMonth(new Date(2027, 0, 1), today)).toBeNull();
  });
});

describe("parsePurchaseLinesWorkbook date-serial parsing (real .xlsx round trip)", () => {
  function buildWorkbookBuffer(rows: unknown[][]): Buffer {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Purchase Lines");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  it("buckets a receipt dated exactly the 1st of a month into that month, not the month before", () => {
    // Regression test: XLSX.read's cellDates:true option converts a date-serial cell through an
    // internal epoch/UTC calculation that can land a few hours to either side of local midnight —
    // for a receipt dated exactly the 1st of a month, that rolled the date back into the last day
    // of the *previous* month, silently shifting it into the wrong Next-1..5 bucket. Confirmed
    // against a real Purchase Lines file where every 1st-of-month date came out one month early
    // (matches a fix already shipped in the original tool's own later version). This test writes
    // and re-reads a genuine .xlsx date cell (not a hand-picked serial number) to exercise the
    // real SheetJS date-serial round trip.
    const today = new Date(2026, 6, 21); // 2026-07-21
    const header = ["No.", "Quantity", "Quantity Received", "Expected Receipt Date"];
    const rows = [
      header,
      ["ITEM-SEP1", 10, 0, new Date(2026, 8, 1)], // 2026-09-01 -> diff=2 -> bucket 2
      ["ITEM-OCT1", 5, 0, new Date(2026, 9, 1)], // 2026-10-01 -> diff=3 -> bucket 3
    ];
    const buffer = buildWorkbookBuffer(rows);
    const result = parsePurchaseLinesWorkbook(buffer, today);

    expect(result.errors).toEqual([]);
    const sep1 = result.rows.find((r) => r.itemNoRaw === "ITEM-SEP1");
    const oct1 = result.rows.find((r) => r.itemNoRaw === "ITEM-OCT1");
    expect(sep1?.bucketMonth).toBe(2);
    expect(oct1?.bucketMonth).toBe(3);
  });
});
