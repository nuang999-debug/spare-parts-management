import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { listItems, type ItemListRow } from "../api/items";
import { buildSummaryData, calcMonthsToNormal, type ChangeRow } from "../lib/summary";
import { exportSumMinChangeExcel, exportSumMinSheet } from "../lib/summaryExport";

const CHART_MUTED = "#94a3b8";
const CHART_GRID = "#263044";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BLUE = "#4f9eff";
const GRAY = "#94a3b8";
const TOOLTIP_STYLE = {
  background: "#1a2233",
  border: "1px solid #263044",
  borderRadius: 6,
  fontSize: 12,
  color: "#e2e8f0",
};
const AXIS_TICK = { fontSize: 11, fill: CHART_MUTED };

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function ChangeRowLine({ row, isUp, onGoToItem }: { row: ChangeRow; isUp: boolean; onGoToItem: (itemNoRaw: string) => void }) {
  const pct = row.oldMin > 0 ? (row.diff / row.oldMin) * 100 : null;
  const color = isUp ? GREEN : RED;
  return (
    <div className="chg-item" style={{ cursor: "pointer" }} onClick={() => onGoToItem(row.itemNoRaw)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: "0.72rem", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}
          title={row.description ?? ""}
        >
          {row.description}
        </div>
        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{row.itemNoRaw}</div>
      </div>
      <div style={{ textAlign: "right", marginLeft: "0.5rem", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>
          {row.oldMin > 0 ? `BB:${fmt(row.oldMin)} → ` : "NEW → "}
          <b style={{ color }}>BC:{fmt(row.sumMin)}</b>
        </div>
        {row.oldMin > 0 && (
          <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color }}>
            {row.diff > 0 ? "+" : ""}
            {fmt(row.diff)}
            {pct != null ? ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : ""}
          </div>
        )}
      </div>
    </div>
  );
}

function UsageItemRow({ item, onGoToItem }: { item: ItemListRow; onGoToItem: (itemNoRaw: string) => void }) {
  const nz = item.usageHistory.filter((h) => h.qty > 0).length;
  const value = item.stockQty * (item.purchasePrice ?? 0);
  return (
    <div className="chg-item" style={{ cursor: "pointer" }} onClick={() => onGoToItem(item.itemNoRaw)}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{ fontSize: "0.72rem", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}
          title={item.description ?? ""}
        >
          {item.description}
        </div>
        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
          {item.itemNoRaw} · ใช้ {nz}/6 เดือน
        </div>
      </div>
      <div style={{ textAlign: "right", marginLeft: "0.5rem", flexShrink: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem" }}>{fmt(item.stockQty)}</div>
        {value > 0 && <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>฿{fmt(value)}</div>}
      </div>
    </div>
  );
}

export default function SummaryTab({ onGoToItem }: { onGoToItem: (itemNoRaw: string) => void }) {
  const { data: items, isLoading } = useQuery({ queryKey: ["items"], queryFn: listItems });

  const summary = useMemo(() => buildSummaryData(items ?? []), [items]);

  if (isLoading) return <p>Loading...</p>;

  const {
    totalItems,
    totalStock,
    totalValue,
    dangerCnt,
    warnCnt,
    prItems,
    prValue,
    increased,
    decreased,
    newItems,
    upTrend,
    downTrend,
    flatTrend,
    totalNext,
    sumMinTotal,
    contItems,
    discItems,
  } = summary;

  const trendTotal = upTrend + downTrend + flatTrend;
  const donutData = [
    { name: "ขาขึ้น", value: upTrend, color: GREEN },
    { name: "ทรงตัว", value: flatTrend, color: GRAY },
    { name: "ขาลง", value: downTrend, color: RED },
  ];

  const stockVsNext = [
    { label: "ปัจจุบัน", value: totalStock, isCurrent: true },
    { label: "Next-1", value: totalNext[0], isCurrent: false },
    { label: "Next-2", value: totalNext[1], isCurrent: false },
    { label: "Next-3", value: totalNext[2], isCurrent: false },
    { label: "Next-4", value: totalNext[3], isCurrent: false },
    { label: "Next-5", value: totalNext[4], isCurrent: false },
  ].map((d) => ({ ...d, pct: sumMinTotal > 0 ? ((d.value - sumMinTotal) / sumMinTotal) * 100 : 0 }));

  function StockVsNextPctLabel(props: { x?: string | number; y?: string | number; width?: string | number; index?: number }) {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const index = props.index ?? 0;
    if (sumMinTotal <= 0) return null;
    const pct = stockVsNext[index]?.pct ?? 0;
    return (
      <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill={pct >= 0 ? GREEN : RED}>
        {pct >= 0 ? "+" : ""}
        {pct.toFixed(0)}%
      </text>
    );
  }
  const eta = calcMonthsToNormal(totalStock, totalNext, sumMinTotal);
  const curPct = sumMinTotal > 0 ? ((totalStock - sumMinTotal) / sumMinTotal) * 100 : 0;

  const totalInvNext = totalNext[0];
  const invPct = totalStock > 0 ? ((totalInvNext - totalStock) / totalStock) * 100 : 0;
  const invTrend = invPct > 5 ? "up" : invPct < -5 ? "down" : "flat";

  return (
    <div className="sum-page">
      <div className="sum-grid">
        <div className="sum-kc">
          <div className="sum-kl">รายการใน SUM MIN</div>
          <div className="sum-kv" style={{ color: "var(--accent)" }}>
            {fmt(totalItems)}
          </div>
          <div className="sum-ks">รายการที่ BC&gt;0</div>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">Stock N0 รวม (BE)</div>
          <div className="sum-kv" style={{ color: "var(--accent2)" }}>
            {fmt(totalStock)} ชิ้น
          </div>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">มูลค่า Stock รวม</div>
          <div className="sum-kv" style={{ color: "var(--warning)" }}>
            ฿{(totalValue / 1e6).toFixed(2)}M
          </div>
          <div className="sum-ks">Stock×Pur.Price</div>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">🔴 วิกฤต / 🟡 ระวัง</div>
          <div className="sum-kv" style={{ color: "var(--danger)" }}>
            {dangerCnt} / {warnCnt}
          </div>
          <div className="sum-ks">Next&lt;SUM MIN</div>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">PR qty รอเปิด</div>
          <div className="sum-kv" style={{ color: "var(--accent3)" }}>
            {fmt(prItems)} รายการ
          </div>
          <div className="sum-ks">มูลค่า ฿{(prValue / 1e6).toFixed(2)}M</div>
        </div>
      </div>

      <div className="sum-two">
        <div className="sum-sec">
          <div className="sum-sec-hd">📦 สัดส่วนแนวโน้มการใช้ (AO-AT 6 เดือน)</div>
          <div className="sum-sec-bd">
            {trendTotal === 0 ? (
              <p>ไม่มีข้อมูล</p>
            ) : (
              <div className="donut-row">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-legend">
                  <div className="donut-total">
                    {fmt(trendTotal)}
                    <span>รายการ</span>
                  </div>
                  {donutData.map((d) => (
                    <div className="donut-legend-item" key={d.name}>
                      <span className="donut-dot" style={{ background: d.color }} />
                      {d.name} {fmt(d.value)} ({trendTotal ? ((d.value / trendTotal) * 100).toFixed(1) : "0.0"}%)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="sum-sec">
          <div className="sum-sec-hd">📐 Stock ปัจจุบัน vs คาดการณ์ Next-1..5 (รวมทั้งหมด)</div>
          <div className="sum-sec-bd">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stockVsNext} margin={{ top: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                {sumMinTotal > 0 && (
                  <ReferenceLine y={sumMinTotal} stroke={RED} strokeDasharray="4 4" label="SUM MIN" />
                )}
                <Bar dataKey="value" activeBar={false}>
                  {stockVsNext.map((d, i) => (
                    <Cell key={i} fill={d.isCurrent ? BLUE : d.value < sumMinTotal ? RED : GREEN} />
                  ))}
                  <LabelList dataKey="value" content={StockVsNextPctLabel} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div id="inv-bar-summary">
              <p style={{ fontSize: "0.85rem" }}>
                {sumMinTotal > 0 ? (
                  <>
                    {curPct >= 0 ? "+" : ""}
                    {curPct.toFixed(1)}% ({curPct >= 0 ? "สูงกว่า" : "ต่ำกว่า"} SUM MIN) — {fmt(totalStock)} /{" "}
                    {fmt(sumMinTotal)}
                  </>
                ) : (
                  "-"
                )}
              </p>
              {totalStock >= sumMinTotal ? (
                <p style={{ color: GREEN }}>✅ อยู่ในระดับปกติแล้ว</p>
              ) : eta?.found ? (
                <p style={{ color: "var(--warning)" }}>
                  📅 {eta.label} (~{eta.monthIdx} เดือน)
                </p>
              ) : (
                <p style={{ color: RED }}>⚠️ เกิน 5 เดือนข้างหน้า</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sum-three">
        <div className="sum-sec">
          <div className="sum-sec-hd">แนวโน้ม Inventory (AO-AT + Next-1..5)</div>
          <div className="sum-sec-bd">
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
              แนวโน้ม 6 เดือน (AO-AT)
            </div>
            <div className="sum-three" style={{ marginBottom: "0.75rem" }}>
              <div className="mini-kc">
                <div className="sum-kl">↑ ขาขึ้น</div>
                <div className="sum-kv" style={{ color: GREEN, fontSize: "1rem" }}>
                  {fmt(upTrend)}
                </div>
              </div>
              <div className="mini-kc">
                <div className="sum-kl">→ ทรงตัว</div>
                <div className="sum-kv" style={{ color: GRAY, fontSize: "1rem" }}>
                  {fmt(flatTrend)}
                </div>
              </div>
              <div className="mini-kc">
                <div className="sum-kl">↓ ขาลง</div>
                <div className="sum-kv" style={{ color: RED, fontSize: "1rem" }}>
                  {fmt(downTrend)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
              คาดการณ์ Stock (Next-1)
            </div>
            <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              {invTrend === "up" ? "📈 " : invTrend === "down" ? "📉 " : "➡️ "}
              Inventory{" "}
              <strong style={{ color: invTrend === "up" ? GREEN : invTrend === "down" ? RED : GRAY }}>
                {invTrend === "up" ? "เพิ่มขึ้น" : invTrend === "down" ? "ลดลง" : "ทรงตัว"}
              </strong>{" "}
              <span style={{ color: "var(--text-muted)" }}>
                {invPct >= 0 ? "+" : ""}
                {invPct.toFixed(1)}% จาก Stock ปัจจุบัน
              </span>
            </p>
            <div className="fcrow">
              <span className="fcl">Stock N0 รวมปัจจุบัน (BE)</span>
              <span className="fcv">{fmt(totalStock)}</span>
            </div>
            <div className="fcrow">
              <span className="fcl">คาด Next-1 รวม (BH)</span>
              <span className="fcv" style={{ color: totalInvNext > totalStock ? GREEN : RED }}>
                {fmt(totalInvNext)}
              </span>
            </div>
            <div className="fcrow">
              <span className="fcl">มูลค่า Stock รวม</span>
              <span className="fcv">฿{fmt(totalValue)}</span>
            </div>
          </div>
        </div>

        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span>✅ ใช้ต่อเนื่อง (≥3/6 เดือน)</span>
            <span style={{ color: GREEN, fontFamily: "var(--font-mono)" }}>{fmt(contItems.length)} รายการ</span>
          </div>
          <div className="sum-sec-bd item-list" style={{ maxHeight: 260 }}>
            {contItems.slice(0, 100).map((d) => (
              <UsageItemRow item={d} onGoToItem={onGoToItem} key={d.id} />
            ))}
            {contItems.length > 100 && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", padding: "0.3rem 0" }}>
                ...+{contItems.length - 100} รายการ
              </div>
            )}
          </div>
        </div>
        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span>⚠️ ใช้ไม่ต่อเนื่อง (&lt;3/6 เดือน)</span>
            <span style={{ color: "var(--warning)", fontFamily: "var(--font-mono)" }}>{fmt(discItems.length)} รายการ</span>
          </div>
          <div className="sum-sec-bd item-list" style={{ maxHeight: 260 }}>
            {discItems.slice(0, 100).map((d) => (
              <UsageItemRow item={d} onGoToItem={onGoToItem} key={d.id} />
            ))}
            {discItems.length > 100 && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", padding: "0.3rem 0" }}>
                ...+{discItems.length - 100} รายการ
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sum-sec">
        <div className="sum-sec-hd">
          <span>📋 ส่งออกรายการ SUM MIN ที่เปลี่ยนแปลง</span>
          <button type="button" className="sum-export-btn" onClick={() => exportSumMinChangeExcel(increased, decreased)}>
            ⬇ Export Excel ทั้งหมด (2 sheets)
          </button>
        </div>
      </div>

      <div className="sum-two">
        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span>
              📈 SUM MIN เพิ่มขึ้น (BC &gt; BB) — {fmt(increased.length)} รายการ (ใหม่ {fmt(newItems.length)})
            </span>
            <button type="button" className="sum-export-btn" onClick={() => exportSumMinSheet("up", increased)}>
              ⬇ Excel
            </button>
          </div>
          <div className="sum-sec-bd item-list" style={{ maxHeight: 280 }}>
            {newItems.length > 0 && (
              <div style={{ fontSize: "0.65rem", color: "var(--accent)", marginBottom: "0.3rem", fontWeight: 700 }}>
                NEW (BB=0→BC&gt;0): {fmt(newItems.length)} รายการ
              </div>
            )}
            {increased
              .concat(newItems)
              .slice(0, 120)
              .map((d, i) => (
                <ChangeRowLine row={d} isUp onGoToItem={onGoToItem} key={i} />
              ))}
            {increased.length > 120 && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", padding: "0.3rem 0" }}>
                ...+{increased.length - 120} รายการ
              </div>
            )}
          </div>
        </div>
        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span>📉 SUM MIN ลดลง (BC &lt; BB) — {fmt(decreased.length)} รายการ</span>
            <button type="button" className="sum-export-btn" onClick={() => exportSumMinSheet("dn", decreased)}>
              ⬇ Excel
            </button>
          </div>
          <div className="sum-sec-bd item-list" style={{ maxHeight: 280 }}>
            {decreased.slice(0, 120).map((d, i) => (
              <ChangeRowLine row={d} isUp={false} onGoToItem={onGoToItem} key={i} />
            ))}
            {decreased.length > 120 && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", padding: "0.3rem 0" }}>
                ...+{decreased.length - 120} รายการ
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
