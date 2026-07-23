import * as XLSX from "xlsx";
import type { ChangeRow } from "./summary";

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
    "Pur.Price": r.purchasePrice ?? "",
    "For Model": r.forModel ?? "",
  }));
}

/** Single-sheet export for just one direction, with 3 extra columns the combined export omits. */
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
    "Pur.Price": r.purchasePrice ?? "",
    "For Model": r.forModel ?? "",
    "AVG/M": r.avgMonth ?? "",
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
