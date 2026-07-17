import * as XLSX from "xlsx";
import { normalizeItemNo } from "../../lib/itemNo";
import { toNumber } from "../../lib/numeric";

// Business Central "Purchase Lines" export — only these 4 columns are actually needed,
// matched by name (case/whitespace-insensitive) since the real export carries ~29 columns total.
const REQUIRED_HEADERS = ["No.", "Quantity", "Quantity Received", "Expected Receipt Date"];

export interface ParsedPurchaseLine {
  itemNoRaw: string;
  itemNoNormalized: string;
  quantity: number;
  quantityReceived: number;
  outstandingQty: number;
  expectedReceiptDate: Date | null;
  /** 1-5, or null if the receipt is more than 5 months out (excluded from the Next-1..5 forecast). */
  bucketMonth: number | null;
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

function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

/**
 * No date -> bucket 1 (matches the old app's fallback for undated lines).
 * More than 5 months out -> excluded (null) rather than dumped into bucket 1, so a far-future
 * PO doesn't overstate near-term supply in the Next-1..5 forecast.
 */
export function computeBucketMonth(expectedReceiptDate: Date | null, today: Date): number | null {
  if (!expectedReceiptDate) return 1;
  const daysUntil = Math.round((expectedReceiptDate.getTime() - today.getTime()) / 86_400_000);
  if (daysUntil <= 30) return 1;
  const monthDiff = Math.ceil(daysUntil / 30);
  return monthDiff > 5 ? null : monthDiff;
}

export function parsePurchaseLinesWorkbook(buffer: Buffer, today: Date = new Date()): ParsePurchaseLinesResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
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

    rows.push({
      itemNoRaw,
      itemNoNormalized: normalizeItemNo(itemNoRaw),
      quantity,
      quantityReceived,
      outstandingQty,
      expectedReceiptDate,
      bucketMonth: computeBucketMonth(expectedReceiptDate, today),
    });
  }

  if (!rows.length) {
    errors.push("No outstanding purchase order lines were found in this file.");
  }

  return { rows, rowCount: rows.length, warnings, errors };
}
