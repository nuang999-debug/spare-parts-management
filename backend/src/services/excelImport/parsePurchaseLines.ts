import * as XLSX from "xlsx";
import { normalizePurchaseLineItemNo } from "../../lib/itemNo";
import { toNumber } from "../../lib/numeric";

// Business Central "Purchase Lines" export — only these 4 columns are actually needed,
// matched by name (case/whitespace-insensitive) since the real export carries ~29 columns total.
const REQUIRED_HEADERS = ["No.", "Quantity", "Quantity Received", "Expected Receipt Date"];
// Optional — present in every real export seen so far, but parsing doesn't hard-fail without it
// (see commitPurchaseLinesImport's unit-of-measure conversion, which treats a missing/unreadable
// code as "already in base units", the safe default).
const UOM_HEADER = "Unit of Measure Code";

export interface ParsedPurchaseLine {
  itemNoRaw: string;
  itemNoNormalized: string;
  quantity: number;
  quantityReceived: number;
  outstandingQty: number;
  expectedReceiptDate: Date | null;
  /** 1-5, or null if the receipt is more than 5 months out (excluded from the Next-1..5 forecast). */
  bucketMonth: number | null;
  /**
   * BC's purchase unit for this line (e.g. "PC", "PACK", "25M") — for most items this is the
   * base unit ("PC") and Quantity/Quantity Received are already in base-unit counts. For the
   * handful of items with an active packing-unit rule (e.g. hose sold by the 25M reel, dust bags
   * by the 5-pack), BC records these columns in PACKAGES, not pieces/meters — confirmed against
   * every real Purchase Lines export on file, where these items consistently carry a non-"PC"
   * code here. commitPurchaseLinesImport multiplies by the packing rule's multipleOf when this
   * is set and isn't "PC", to convert into the same base unit Stock/Next-1..5/Sum MIN use.
   */
  unitOfMeasureCode: string | null;
}

export interface ParsePurchaseLinesResult {
  rows: ParsedPurchaseLine[];
  rowCount: number;
  warnings: string[];
  errors: string[];
}

function normHeader(h: unknown): string {
  return String(h).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Excel date cells are read as raw serial numbers (not via SheetJS's `cellDates:true`) and
 * converted here through `XLSX.SSF.parse_date_code`, then built with the LOCAL `Date`
 * constructor from its y/m/d fields. `cellDates:true` converts the serial through an internal
 * epoch/UTC calculation that can land a few hours to either side of local midnight — for a
 * receipt dated exactly the 1st of a month that's enough to roll the date back into the last
 * day of the *previous* month, silently shifting it into the wrong Next-1..5 bucket (confirmed
 * against a real Purchase Lines file: every 1st-of-month date came out one month early). Going
 * through parse_date_code's integer y/m/d avoids that epoch/timezone arithmetic entirely.
 */
function parseDate(v: unknown): Date | null {
  if (typeof v === "number") {
    const pc = XLSX.SSF.parse_date_code(v);
    if (!pc || !pc.y) return null;
    return new Date(pc.y, pc.m - 1, pc.d || 1);
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const s = v.trim();
    // Same y/m/d-via-local-constructor approach as the numeric branch above, for the two date
    // text formats this export can actually contain — a cell stored as text rather than a real
    // Excel serial hits `new Date(string)` instead, which parses a bare "YYYY-MM-DD" as UTC
    // midnight and can reintroduce the exact same 1st-of-month rollback this function exists to
    // prevent, depending on the server's local timezone offset.
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slash) return new Date(Number(slash[3]), Number(slash[1]) - 1, Number(slash[2]));
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * No date -> bucket 1 (matches the old app's fallback for undated lines).
 * Bucketed by calendar-month difference from today (not day-count / 30), matching the
 * original app's poMonthBucket(): diff<=1 (this month, next month, or overdue) -> bucket 1;
 * diff 2..5 -> that bucket; diff>5 -> excluded (null), so a far-future PO doesn't overstate
 * near-term supply in the Next-1..5 forecast.
 */
export function computeBucketMonth(expectedReceiptDate: Date | null, today: Date): number | null {
  if (!expectedReceiptDate) return 1;
  const diff =
    (expectedReceiptDate.getFullYear() - today.getFullYear()) * 12 +
    (expectedReceiptDate.getMonth() - today.getMonth());
  if (diff <= 1) return 1;
  if (diff <= 5) return diff;
  return null;
}

export function parsePurchaseLinesWorkbook(buffer: Buffer, today: Date = new Date()): ParsePurchaseLinesResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    // Deliberately NOT cellDates:true — see parseDate()'s comment for why.
    workbook = XLSX.read(buffer, { type: "buffer" });
  } catch {
    return { rows: [], rowCount: 0, warnings, errors: ["Could not read the file as an Excel workbook."] };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], rowCount: 0, warnings, errors: ["The workbook has no sheets."] };
  }
  const sheet = workbook.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  if (!allRows.length) {
    return { rows: [], rowCount: 0, warnings, errors: ["The workbook has no rows."] };
  }

  const headerRow = allRows[0].map(normHeader);
  const colIndex: Record<string, number> = {};
  for (const header of REQUIRED_HEADERS) {
    const idx = headerRow.indexOf(normHeader(header));
    if (idx === -1) {
      errors.push(`Missing expected column "${header}". The file layout may have changed.`);
    } else {
      colIndex[header] = idx;
    }
  }
  if (errors.length) {
    return { rows: [], rowCount: 0, warnings, errors };
  }
  const uomIdx = headerRow.indexOf(normHeader(UOM_HEADER));

  const rows: ParsedPurchaseLine[] = [];
  for (const raw of allRows.slice(1)) {
    const itemNoCell = raw[colIndex["No."]];
    if (itemNoCell === undefined || itemNoCell === null || String(itemNoCell).trim() === "") {
      continue; // blank/spacer row
    }
    const quantity = toNumber(raw[colIndex["Quantity"]]);
    const quantityReceived = toNumber(raw[colIndex["Quantity Received"]]);
    const outstandingQty = quantity - quantityReceived;
    if (outstandingQty <= 0) continue; // fully received, nothing outstanding

    const itemNoRaw = String(itemNoCell).trim();
    const expectedReceiptDate = parseDate(raw[colIndex["Expected Receipt Date"]]);
    const unitOfMeasureCode = uomIdx === -1 ? null : String(raw[uomIdx] ?? "").trim() || null;

    rows.push({
      itemNoRaw,
      itemNoNormalized: normalizePurchaseLineItemNo(itemNoRaw),
      quantity,
      quantityReceived,
      outstandingQty,
      expectedReceiptDate,
      unitOfMeasureCode,
      bucketMonth: computeBucketMonth(expectedReceiptDate, today),
    });
  }

  if (!rows.length) {
    errors.push("No outstanding purchase order lines were found in this file.");
  }

  return { rows, rowCount: rows.length, warnings, errors };
}
