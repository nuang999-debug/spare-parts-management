import { useState } from "react";
import ItemsTable from "./ItemsTable";
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
        <button type="button" className={`tab-btn ${tab === "plan" ? "on" : ""}`} onClick={() => setTab("plan")}>
          📋 วางแผนสั่งซื้อ
        </button>
        <button type="button" className={`tab-btn ${tab === "sum" ? "on" : ""}`} onClick={() => setTab("sum")}>
          📊 สรุปภาพรวม
        </button>
        {tab === "sum" && (
          <button type="button" className="print-btn" onClick={() => window.print()}>
            🖨 พิมพ์/PDF
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
