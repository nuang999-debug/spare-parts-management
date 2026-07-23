import type { ItemListRow } from "../api/items";

/** Mirrors the original app's renderKPI() — always computed over the full unfiltered dataset. */
export default function KpiBar({ items }: { items: ItemListRow[] }) {
  const total = items.length;
  const danger = items.filter((d) => d.calcStatus === "DANGER").length;
  const warn = items.filter((d) => d.calcStatus === "WARN").length;
  const withPr = items.filter((d) => (d.prQtyCurrent ?? 0) > 0).length;
  const prValue = items.reduce((s, d) => s + (d.prQtyCurrent ?? 0) * (d.purchasePrice ?? 0), 0);

  return (
    <div className="kpi-bar">
      <div className="kc">
        <div className="klbl">รายการทั้งหมด</div>
        <div className="kval" style={{ color: "var(--accent)" }}>
          {total.toLocaleString()}
        </div>
      </div>
      <div className="kc">
        <div className="klbl">🔴 Next-1 &lt; Sum MIN(BC)</div>
        <div className="kval" style={{ color: "var(--danger)" }}>
          {danger.toLocaleString()}
        </div>
        <div className="ksub">ต้องสั่งทันที</div>
      </div>
      <div className="kc">
        <div className="klbl">🟡 Next-2 &lt; Sum MIN(BC)</div>
        <div className="kval" style={{ color: "var(--warning)" }}>
          {warn.toLocaleString()}
        </div>
        <div className="ksub">วางแผนสั่ง</div>
      </div>
      <div className="kc">
        <div className="klbl">มี PR qty (BG)</div>
        <div className="kval" style={{ color: "var(--accent2)" }}>
          {withPr.toLocaleString()}
        </div>
      </div>
      <div className="kc">
        <div className="klbl">มูลค่า PR รวม</div>
        <div className="kval" style={{ color: "var(--warning)", fontSize: "15px" }}>
          ฿{(prValue / 1e6).toFixed(2)}M
        </div>
      </div>
    </div>
  );
}
