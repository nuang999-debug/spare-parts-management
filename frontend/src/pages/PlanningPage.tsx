import { useState } from "react";
import { BarChart3, Printer, Table2 } from "lucide-react";
import ItemsTable from "./ItemsTable";
import { tr } from "../lib/i18n";
import SummaryTab from "./SummaryTab";

export default function PlanningPage() {
  const [tab, setTab] = useState<"plan" | "sum">("plan");
  // Mirrors the original's goToPlanItem(): clicking a part in the Summary tab switches to the
  // Planning tab and opens that item's detail panel there — set here, consumed and cleared by
  // ItemsTable once it has located and opened the item.
  const [pendingItemNo, setPendingItemNo] = useState<string | null>(null);

  return (
    <div className="planning-page">
      <div className="tabs-bar">
        <h1 className="page-title">{tr("วางแผนสั่งซื้อ", "Order planning")}</h1>
        <div className="seg" role="tablist" aria-label={tr("มุมมอง", "View")}>
          <button type="button" role="tab" aria-selected={tab === "plan"} className={`seg-btn ${tab === "plan" ? "on" : ""}`} onClick={() => setTab("plan")}>
            <Table2 size={15} strokeWidth={1.8} aria-hidden /> {tr("ตารางวางแผน", "Planning table")}
          </button>
          <button type="button" role="tab" aria-selected={tab === "sum"} className={`seg-btn ${tab === "sum" ? "on" : ""}`} onClick={() => setTab("sum")}>
            <BarChart3 size={15} strokeWidth={1.8} aria-hidden /> {tr("สรุปภาพรวม", "Overview")}
          </button>
        </div>
        {tab === "sum" && (
          <button type="button" className="print-btn" onClick={() => window.print()}>
            <Printer size={15} strokeWidth={1.8} aria-hidden /> {tr("พิมพ์/PDF", "Print/PDF")}
          </button>
        )}
      </div>
      <div className="tab-content">
        {tab === "plan" ? (
          <ItemsTable pendingItemNo={pendingItemNo} onPendingItemHandled={() => setPendingItemNo(null)} />
        ) : (
          <SummaryTab
            onGoToItem={(itemNoRaw) => {
              setPendingItemNo(itemNoRaw);
              setTab("plan");
            }}
          />
        )}
      </div>
    </div>
  );
}
