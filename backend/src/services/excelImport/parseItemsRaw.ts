import * as XLSX from "xlsx";
import { normalizeItemNo } from "../../lib/itemNo";
import { toNumber, toNumberOrNull } from "../../lib/numeric";

// Exact header row from the real "Data Inventory" export (raw-export format, 52 columns).
// Matched by name, not position, so a shifted column is caught immediately.
const HEADERS = [
  "No_", "Description", "P STOP", "S STOP", "Status", "Class", "Category", "Dimension",
  "Pur. Price", "Unit Cost", "Vendor No_", "PO_TTL", "PO_N0", "PO_TRADE", "PO_NoLOC",
  "ST TTL", "ST_N0", "ST_N1", "ST_N2", "ST_N3", "ST_N5", "ST_TECH", "ST_DEMO", "ST_OTHER",
  "BO QTY", "BO_N0", "BO_N1~N5", "BO_SVC",
  "YDMD-2021", "YDMD-2022", "YDMD-2023", "YDMD-2024", "YDMD-2025", "YDMD-2026",
  "M-12", "M-11", "M-10", "M-9", "M-8", "M-7", "M-6", "M-5", "M-4", "M-3", "M-2", "M-1", "M-0",
  "Lead time Calculation", "Old Min.ST", "Summary MiN.ST", "Remark", "For Model",
] as const;

const USAGE_MONTH_HEADERS = ["M-12", "M-11", "M-10", "M-9", "M-8", "M-7", "M-6", "M-5", "M-4", "M-3", "M-2", "M-1", "M-0"];
const YEARLY_HEADERS = ["YDMD-2021", "YDMD-2022", "YDMD-2023", "YDMD-2024", "YDMD-2025", "YDMD-2026"];

// Excel's Table "Total Row" and AutoFilter status caption leak into the "No_" column as trailing
// rows below the real data when a filtered/tabled range is exported — these aren't items, they're
// spreadsheet chrome, and must never be imported as one (seen for real: a "Total" row whose ST_N0
// cell held the column's SUM formula result, reported as a phantom item with a huge stock qty).
const NON_ITEM_ROW_VALUES = new Set(["total", "subtotal", "grand total", "no filters applied", "filter applied", "filtered"]);

export interface ParsedItemRow {
  itemNoRaw: string;
  itemNoNormalized: string;
  description: string;
  class: string | null;
  category: string | null;
  dimension: string | null;
  purchasePrice: number | null;
  unitCost: number | null;
  vendor: string | null;
  poQty: number;
  stockQty: number;
  backorderQty: number;
  yearlySales: { year: number; qty: number }[];
  usageHistory: { monthIndex: number; periodLabel: string; qty: number }[];
  leadTimeDays: number | null;
  oldMin: number | null;
  sumMin: number | null;
  remark: string | null;
  forModel: string | null;
}

export interface ParseResult {
  rows: ParsedItemRow[];
  rowCount: number;
  warnings: string[];
  errors: string[];
}

function toStringOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Mirrors the original's normHdr(): case/whitespace-insensitive header comparison, so a
 * re-exported file with e.g. "pur. price" or a stray non-breaking space doesn't hard-fail an
 * import that the original tool would have accepted without complaint. The exact-name safety
 * net (catching a genuinely shifted/renamed column) is preserved — only cosmetic formatting
 * differences are tolerated.
 */
function normHdr(v: unknown): string {
  return String(v ?? "")
    .split(String.fromCharCode(160))
    .join(" ")
    .replace(/\s\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findHeaderRowIndex(rows: unknown[][]): number {
  for (let r = 0; r < Math.min(6, rows.length); r++) {
    const first = rows[r]?.[0];
    if (typeof first === "string" && normHdr(first) === "no_") return r;
  }
  return -1;
}

export function parseItemsRawWorkbook(buffer: Buffer): ParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
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

  const headerRowIdx = findHeaderRowIndex(allRows);
  if (headerRowIdx === -1) {
    return {
      rows: [],
      rowCount: 0,
      warnings,
      errors: ['Could not find the header row (expected column A to be "No_" within the first 6 rows).'],
    };
  }

  const headerRow = allRows[headerRowIdx].map((h) => String(h).trim());
  const normalizedHeaderRow = headerRow.map(normHdr);
  const colIndex: Record<string, number> = {};
  for (const header of HEADERS) {
    const idx = normalizedHeaderRow.indexOf(normHdr(header));
    if (idx === -1) {
      errors.push(`Missing expected column "${header}". The file layout may have changed.`);
    } else {
      colIndex[header] = idx;
    }
  }
  if (errors.length) {
    return { rows: [], rowCount: 0, warnings, errors };
  }

  const dataRows = allRows.slice(headerRowIdx + 1);
  // Keyed by itemNoNormalized so a duplicate item number overwrites rather than
  // producing two rows that would later collide on the item's child-table inserts.
  const rowsByItemNo = new Map<string, ParsedItemRow>();

  for (const raw of dataRows) {
    const itemNoCell = raw[colIndex["No_"]];
    if (itemNoCell === undefined || itemNoCell === null || String(itemNoCell).trim() === "") {
      continue; // blank spacer row
    }
    const itemNoRaw = String(itemNoCell).trim();
    if (NON_ITEM_ROW_VALUES.has(itemNoRaw.toLowerCase())) {
      warnings.push(`Skipped row "${itemNoRaw}" — looks like an Excel table/filter caption, not a real item.`);
      continue;
    }
    const itemNoNormalized = normalizeItemNo(itemNoRaw);
    if (rowsByItemNo.has(itemNoNormalized)) {
      warnings.push(`Duplicate item number "${itemNoRaw}" — the last occurrence in the file wins.`);
    }

    // A negative "units used/sold" has no real business meaning here (unlike stock, which can
    // legitimately be a running total) — seen for real as stray negative-adjustment figures in
    // the source file that were otherwise silently corrupting avgMonth into a negative average.
    // Clamped rather than dropped so the month/year still gets its zero entry, not a missing one.
    const usageHistory = USAGE_MONTH_HEADERS.map((label, monthIndex) => ({
      monthIndex,
      periodLabel: label,
      qty: Math.max(0, toNumber(raw[colIndex[label]])),
    }));
    const yearlySales = YEARLY_HEADERS.map((label) => ({
      year: Number(label.split("-")[1]),
      qty: Math.max(0, toNumber(raw[colIndex[label]])),
    }));

    rowsByItemNo.set(itemNoNormalized, {
      itemNoRaw,
      itemNoNormalized,
      description: toStringOrNull(raw[colIndex["Description"]]) ?? "",
      class: toStringOrNull(raw[colIndex["Class"]]),
      category: toStringOrNull(raw[colIndex["Category"]]),
      dimension: toStringOrNull(raw[colIndex["Dimension"]]),
      purchasePrice: toNumberOrNull(raw[colIndex["Pur. Price"]]),
      unitCost: toNumberOrNull(raw[colIndex["Unit Cost"]]),
      vendor: toStringOrNull(raw[colIndex["Vendor No_"]]),
      poQty: toNumber(raw[colIndex["PO_N0"]]),
      stockQty: toNumber(raw[colIndex["ST_N0"]]),
      backorderQty: toNumber(raw[colIndex["BO QTY"]]),
      yearlySales,
      usageHistory,
      leadTimeDays: toNumberOrNull(raw[colIndex["Lead time Calculation"]]),
      oldMin: toNumberOrNull(raw[colIndex["Old Min.ST"]]),
      sumMin: toNumberOrNull(raw[colIndex["Summary MiN.ST"]]),
      remark: toStringOrNull(raw[colIndex["Remark"]]),
      forModel: toStringOrNull(raw[colIndex["For Model"]]),
    });
  }

  const rows = [...rowsByItemNo.values()];
  if (!rows.length) {
    errors.push("No data rows were found below the header row.");
    return { rows, rowCount: 0, warnings, errors };
  }

  // Sanity check: known-numeric columns should actually be numeric in most sampled rows.
  const sample = dataRows.slice(0, 30);
  const numericColumnsToCheck: Array<[string, string]> = [
    ["Pur. Price", "Pur. Price"],
    ["Old Min.ST", "Old Min.ST"],
    ["Summary MiN.ST", "Summary MiN.ST"],
  ];
  for (const [header, label] of numericColumnsToCheck) {
    const values = sample.map((r) => r[colIndex[header]]).filter((v) => v !== "" && v !== undefined && v !== null);
    if (!values.length) continue;
    const numericCount = values.filter((v) => toNumberOrNull(v) !== null).length;
    if (numericCount / values.length < 0.6) {
      warnings.push(`Column "${label}" looks mostly non-numeric in the first ${sample.length} rows — the column position may have shifted.`);
    }
  }

  return { rows, rowCount: rows.length, warnings, errors };
}
