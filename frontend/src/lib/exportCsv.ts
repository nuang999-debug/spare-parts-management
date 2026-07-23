import type { ItemListRow } from "../api/items";

const HEADER = [
  "No_",
  "Description",
  "Class",
  "Category",
  "AO",
  "AP",
  "AQ",
  "AR",
  "AS",
  "AT",
  "Trend",
  "AVG/M(AW)",
  "Lead(AX)",
  "Old MIN(BB)",
  "Sum MIN(BC)",
  "PO N0(BD=M)",
  "Stock(BE=Q)",
  "SO(BF=Y)",
  "PR qty(BG)",
  "Next-1(BH)",
  "Next-2(BI)",
  "Next-3(BJ)",
  "Next-4(BK)",
  "Next-5(BL)",
  "Status",
  "ForModel(BN)",
  "Remark(BM)",
];

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Mirrors the original app's exportCSV() — exports the currently filtered/sorted rows, UTF-8 BOM. */
export function exportCSV(rows: ItemListRow[]) {
  const lines = [HEADER.join(",")];
  for (const d of rows) {
    const hist = d.usageHistory;
    lines.push(
      [
        d.itemNoRaw,
        d.description,
        d.class,
        d.category,
        hist[0]?.qty ?? "",
        hist[1]?.qty ?? "",
        hist[2]?.qty ?? "",
        hist[3]?.qty ?? "",
        hist[4]?.qty ?? "",
        hist[5]?.qty ?? "",
        d.calcTrend ?? "",
        d.avgMonth ?? "",
        d.leadTimeDays ?? "",
        d.oldMin ?? "",
        d.sumMin ?? "",
        d.poQty,
        d.stockQty,
        d.backorderQty,
        d.prQtyCurrent ?? "",
        d.next1 ?? "",
        d.next2 ?? "",
        d.next3 ?? "",
        d.next4 ?? "",
        d.next5 ?? "",
        d.calcStatus ?? "",
        d.forModel ?? "",
        d.remark ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }
  const csv = "﻿" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "procurement_plan.csv";
  a.click();
  URL.revokeObjectURL(url);
}
