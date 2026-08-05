import * as XLSX from "xlsx";
import type { ChangeRow } from "./summary";
import { thaiMonthLabel } from "./thaiMonths";
import { trendPercent } from "./analysis";

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const HISTORY_LETTERS = ["AO", "AP", "AQ", "AR", "AS", "AT"];

function trendLabel(t: ChangeRow["calcTrend"]): string {
  if (t === "UP") return "ขาขึ้น";
  if (t === "DOWN") return "ขาลง";
  if (t === "FLAT") return "คงที่";
  return "";
}

/**
 * เทรนด์ + AVG/M + ยอดขายย้อนหลัง 1 ปี (avgMonth*12 — avgMonth is already sum(M-12..M-1)/12, so
 * this reconstructs the same 12-month total without needing extra data from the API) + one
 * column per of the last 6 months (AO-AT, matching the main Items table's own history columns).
 * Shared by both export paths below so "Export ทั้งหมด" and the single-direction "Excel" buttons
 * always carry the same fields.
 */
function trendAndHistoryColumns(r: ChangeRow) {
  const hist6 = r.usageHistory.map((h) => h.qty); // already oldest→newest, monthIndex 6..11
  const monthly: Record<string, number | ""> = {};
  HISTORY_LETTERS.forEach((letter, i) => {
    const h = r.usageHistory[i];
    monthly[`${letter} ${thaiMonthLabel(i - 6)}`] = h ? h.qty : "";
  });
  return {
    "เทรนด์": trendLabel(r.calcTrend),
    "% เทรนด์ (6 เดือน)": hist6.length === 6 ? Math.round(trendPercent(hist6) * 10) / 10 : "",
    "AVG/M": r.avgMonth ?? "",
    "ยอดขายย้อนหลัง 1 ปี": r.avgMonth != null ? Math.round(r.avgMonth * 12) : "",
    ...monthly,
  };
}

function changeRowsToSheetData(rows: ChangeRow[]) {
  return rows.map((r) => ({
    "รหัส": r.itemNoRaw,
    "ชื่ออะไหล่": r.description ?? "",
    "Class": r.class ?? "",
    "Category": r.category ?? "",
    "Old MIN(BB)": r.oldMin,
    "Sum MIN(BC)": r.sumMin,
    "จำนวนที่เปลี่ยน": r.diff,
    "% ที่เปลี่ยน": r.oldMin > 0 ? Math.round((r.diff / r.oldMin) * 1000) / 10 : "",
    "Stock ปัจจุบัน(BE)": r.stockQty,
    ...trendAndHistoryColumns(r),
    "Pur.Price": r.purchasePrice ?? "",
    "For Model": r.forModel ?? "",
  }));
}

/** Single-sheet export for just one direction, with 2 extra columns the combined export omits. */
export function exportSumMinSheet(type: "up" | "dn", rows: ChangeRow[]) {
  if (!rows.length) {
    alert("ไม่มีข้อมูลในส่วนนี้");
    return;
  }
  const data = rows.map((r) => ({
    "รหัส": r.itemNoRaw,
    "ชื่ออะไหล่": r.description ?? "",
    "Class": r.class ?? "",
    "Category": r.category ?? "",
    "Old MIN(BB)": r.oldMin,
    "Sum MIN(BC)": r.sumMin,
    "จำนวนที่เปลี่ยน": r.diff,
    "% ที่เปลี่ยน": r.oldMin > 0 ? Math.round((r.diff / r.oldMin) * 1000) / 10 : "",
    "Stock ปัจจุบัน(BE)": r.stockQty,
    ...trendAndHistoryColumns(r),
    "Pur.Price": r.purchasePrice ?? "",
    "For Model": r.forModel ?? "",
    "Lead Time": r.leadTimeDays ?? "",
    "Vendor": r.vendor ?? "",
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, type === "up" ? "SUM MIN เพิ่มขึ้น" : "SUM MIN ลดลง");
  XLSX.writeFile(workbook, `SUM_MIN_${type === "up" ? "เพิ่มขึ้น" : "ลดลง"}_${todayStamp()}.xlsx`);
}

/** 2-sheet export covering both directions at once. */
export function exportSumMinChangeExcel(increased: ChangeRow[], decreased: ChangeRow[]) {
  if (!increased.length && !decreased.length) {
    alert("ยังไม่มีข้อมูล กรุณาไปหน้าสรุปภาพรวมก่อน");
    return;
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(changeRowsToSheetData(increased)), "SUM MIN เพิ่มขึ้น");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(changeRowsToSheetData(decreased)), "SUM MIN ลดลง");
  XLSX.writeFile(workbook, `SUM_MIN_เปลี่ยนแปลง_${todayStamp()}.xlsx`);
}
