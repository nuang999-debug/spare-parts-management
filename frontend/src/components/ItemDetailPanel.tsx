import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getItem, getItemHistory } from "../api/items";
import { StatusBadge, TrendIndicator } from "./StatusBadge";
import { analyzeItem, nextCellTone } from "../lib/analysis";
import { buildNarrative, buildSuggestions } from "../lib/narrative";
import { thaiMonthLabel } from "../lib/thaiMonths";

const CHART_MUTED = "#94a3b8";
const CHART_GRID = "#263044";
const CHART_ACCENT = "#00d4aa";
const CHART_ACCENT3 = "#a78bfa";
const CHART_DANGER = "#ef4444";
const TOOLTIP_STYLE = {
  background: "#1a2233",
  border: "1px solid #263044",
  borderRadius: 6,
  fontSize: 12,
  color: "#e2e8f0",
};
const AXIS_TICK = { fontSize: 11, fill: CHART_MUTED };
const NEXT_LETTERS = ["BH", "BI", "BJ", "BK", "BL"];

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null) return "-";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export default function ItemDetailPanel({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  const { data: item, isLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId),
  });
  const { data: history } = useQuery({
    queryKey: ["item-history", itemId],
    queryFn: () => getItemHistory(itemId),
  });

  return (
    <aside className="detail-panel">
      <div className="detail-panel-header">
        <h2>{item?.itemNoRaw ?? "..."}</h2>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      {isLoading && <p>Loading...</p>}

      {item && (() => {
        const a = analyzeItem(item);
        const narrative = buildNarrative(item, a);
        const suggestions = buildSuggestions(item, a);
        const reasonLines = narrative.find((s) => s.title.startsWith("3."))?.lines ?? [];
        const maxAbsNext = Math.max(...a.next.map((v) => Math.abs(v)), item.sumMin ?? 0, 1);
        const usageChartData = item.usageHistory.map((h) => ({
          monthIndex: h.monthIndex,
          qty: h.qty,
        }));
        const forecastChartData = a.next.map((v, i) => ({
          label: `${NEXT_LETTERS[i]} ${thaiMonthLabel(i + 1)}`,
          value: v,
        }));

        const fields: Array<[string, string]> = [
          ["No. (A)", item.itemNoRaw],
          ["Description (B)", item.description ?? "-"],
          ["Class (F)", item.class ?? "-"],
          ["Category (G)", item.category ?? "-"],
          ["Dimension (H)", item.dimension ?? "-"],
          ["Vendor (K)", item.vendor ?? "-"],
          ["Pur. Price (I)", `฿${fmt(item.purchasePrice, 2)}`],
          ["Unit Cost (J)", item.unitCost != null ? `฿${fmt(item.unitCost, 2)}` : "-"],
          ["PO N0 / M", fmt(item.poQty, 0)],
          ["ST N0 / Q", fmt(item.stockQty, 0)],
          ["BO QTY / Y", fmt(item.backorderQty, 0)],
          ...item.yearlySales.map((y): [string, string] => [`${y.year}`, fmt(y.qty, 0)]),
          ...item.usageHistory.map((h): [string, string] => [
            `M-${12 - h.monthIndex} ${thaiMonthLabel(h.monthIndex - 12)}`,
            fmt(h.qty, 0),
          ]),
          ["รวม 12M (AV)", fmt(item.usageHistory.slice(0, 12).reduce((s, h) => s + h.qty, 0), 0)],
          ["AVG/M (AW)", fmt(item.avgMonth, 1)],
          ["Lead Time (AX)", `${fmt(item.leadTimeDays, 0)} วัน`],
          ["Min usage (AY)", fmt(item.minUsage, 0)],
          ["Max usage (AZ)", fmt(item.maxUsage, 0)],
          ["New MIN.ST (BA)", fmt(item.recommendedMin, 0)],
          ["Old MIN (BB)", fmt(item.oldMin, 0)],
          ["Sum MIN (BC)", fmt(item.sumMin, 0)],
          ["PR qty suggested (BG)", fmt(item.prQtySuggested, 0)],
          ["PR qty current (BG)", fmt(item.prQtyCurrent, 0)],
          ...([1, 2, 3, 4, 5] as const).map(
            (n): [string, string] => [`Next-${n} (${NEXT_LETTERS[n - 1]}) ${thaiMonthLabel(n)}`, fmt(a.next[n - 1], 1)]
          ),
          ["Remark (BM)", item.remark ?? "-"],
          ["For Model (BN)", item.forModel ?? "-"],
        ];

        return (
          <div className="detail-panel-body">
            <h1 className="detail-title">{item.description}</h1>
            <div className="detail-chips">
              <span className="chip">รหัส {item.itemNoRaw}</span>
              <span className="chip">ประเภท {item.category ?? "-"}</span>
              <span className="chip">Lead {fmt(item.leadTimeDays, 0)} วัน</span>
              <span className="chip">Vendor {item.vendor ?? "-"}</span>
            </div>

            <div className="detail-kpis">
              <div className="kpi">
                <span className="kpi-label">PO N0 (BD=M)</span>
                <span className="kpi-value">{fmt(item.poQty, 0)}</span>
                <span className="kpi-sub">ช่อง M: {fmt(item.poQty, 0)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Stock N0 (BE=Q)</span>
                <span className="kpi-value">{fmt(item.stockQty, 0)}</span>
                <span className="kpi-sub">ช่อง Q: {fmt(item.stockQty, 0)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Sale Order (BF=Y)</span>
                <span className="kpi-value">{item.backorderQty > 0 ? fmt(item.backorderQty, 0) : "-"}</span>
                <span className="kpi-sub">ช่อง Y: {item.backorderQty > 0 ? fmt(item.backorderQty, 0) : "-"}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">AVG/M (AW)</span>
                <span className="kpi-value">{fmt(item.avgMonth, 1)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Sum MIN (BC)</span>
                <span className="kpi-value">{fmt(item.sumMin, 0)}</span>
                <span className="kpi-sub">Old MIN (BB): {fmt(item.oldMin, 0)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">สถานะ</span>
                <span className="kpi-value">
                  <StatusBadge status={item.calcStatus} /> <TrendIndicator trend={item.calcTrend} />
                </span>
                <span className="kpi-sub">PR (BG): {item.prQtyCurrent ? fmt(item.prQtyCurrent, 0) : "-"}</span>
              </div>
            </div>

            <section>
              <h3>ยอดขาย 13 เดือน (AI-AU)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={usageChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis
                    dataKey="monthIndex"
                    tick={AXIS_TICK}
                    tickFormatter={(v: number) => thaiMonthLabel(v - 12)}
                  />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={(v) => thaiMonthLabel(Number(v) - 12)} />
                  <Area type="monotone" dataKey="qty" stroke={CHART_ACCENT} fill={CHART_ACCENT} fillOpacity={0.15} />
                </AreaChart>
              </ResponsiveContainer>
            </section>

            <section>
              <h3>พยากรณ์ BH-BL vs SUM MIN (BC)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={forecastChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="label" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill={CHART_ACCENT3} />
                  {item.sumMin != null && (
                    <ReferenceLine y={item.sumMin} stroke={CHART_DANGER} strokeDasharray="4 4" label="MIN" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section>
              <h3>ยอดขายรายปี (AC-AH)</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={item.yearlySales.map((y) => ({ year: y.year, qty: y.qty }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                  <XAxis dataKey="year" tick={AXIS_TICK} />
                  <YAxis tick={AXIS_TICK} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="qty" fill={CHART_ACCENT} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            <section>
              <h3>NEXT-1→5 vs SUM MIN (BC)</h3>
              <div className="next-bar-list">
                <div className="next-bar-header">
                  <span>เดือน / ช่อง</span>
                  <span>Stock คาด</span>
                </div>
                {a.next.map((val, i) => {
                  const tone = nextCellTone(val, item.sumMin);
                  const widthPct = Math.max(0, Math.min(100, (val / maxAbsNext) * 100));
                  return (
                    <div className="next-bar-row" key={i}>
                      <span className="next-bar-label">
                        {NEXT_LETTERS[i]} {thaiMonthLabel(i + 1)}
                      </span>
                      <div className="next-bar-track">
                        <div className={`next-bar-fill tone-${tone}`} style={{ width: `${widthPct}%` }} />
                      </div>
                      <span className={`next-bar-value tone-${tone}`}>{fmt(val, 1)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="next-bar-footer">
                Sum MIN (BC): {fmt(item.sumMin, 0)} · Old MIN (BB): {fmt(item.oldMin, 0)} · New MIN (BA):{" "}
                {fmt(item.recommendedMin, 0)}
              </p>
            </section>

            <section className="plan-card">
              <div className="plan-card-header">
                <h3>🛒 แผนการสั่งซื้อที่แนะนำ</h3>
                <div className="plan-card-due">
                  <span className="plan-due-label">ต้องสั่งภายใน</span>
                  <span className={`plan-due-value tone-${a.urgency.tone}`}>
                    {a.triggerMonth < 0
                      ? "-"
                      : a.daysToOrder <= 0
                        ? "ทันที!"
                        : item.mustOrderByDate
                          ? new Date(item.mustOrderByDate).toLocaleDateString("th-TH")
                          : "-"}
                  </span>
                </div>
              </div>

              {a.triggerMonth > 0 ? (
                <>
                  <div className={`plan-status tone-${a.urgency.tone}`}>{a.urgency.label}</div>
                  <div className="plan-kpis">
                    <div className="kpi">
                      <span className="kpi-label">จำนวนที่ควรสั่ง</span>
                      <span className="kpi-value">{fmt(a.orderQty, 0)} หน่วย</span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">เดือนที่ Stock ต่ำกว่า MIN</span>
                      <span className="kpi-value">
                        {a.triggerMonthLabel} ({a.triggerLetter})
                      </span>
                      <span className="kpi-sub">
                        {fmt(a.triggerValue, 1)} &lt; {fmt(item.sumMin, 0)}
                      </span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">มูลค่าประมาณ</span>
                      <span className="kpi-value">฿{fmt(a.estimatedValue, 0)}</span>
                      <span className="kpi-sub">@฿{fmt(item.purchasePrice, 2)}/หน่วย</span>
                    </div>
                  </div>
                  <div className="plan-timeline">
                    {([1, 2, 3, 4, 5] as const).map((n) => (
                      <div
                        key={n}
                        className={`timeline-tab ${n === a.triggerMonth ? `active tone-${a.urgency.tone}` : ""}`}
                      >
                        {thaiMonthLabel(n)}
                        {n === a.triggerMonth ? " ⚠" : ""}
                      </div>
                    ))}
                  </div>
                  <p className="plan-summary">
                    🎯 ต้องสั่งวันที่{" "}
                    {item.mustOrderByDate ? new Date(item.mustOrderByDate).toLocaleDateString("th-TH") : "-"} | Lead:{" "}
                    {fmt(item.leadTimeDays, 0)} วัน | Stock ต่ำกว่า MIN: {a.triggerMonthLabel}
                  </p>
                  <div className="plan-reasons">
                    <h4>เหตุผลที่ควรสั่ง</h4>
                    <ul>
                      {reasonLines.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="plan-ok">✅ สถานะปกติ — ไม่มีความจำเป็นต้องสั่งซื้อในช่วง 5 เดือนข้างหน้า</p>
              )}

              {suggestions.length > 0 && (
                <div className="suggestion-list">
                  <h4>ข้อเสนอแนะ</h4>
                  {suggestions.map((s, i) => (
                    <div className="suggestion-item" key={i}>
                      <span className="suggestion-icon">{s.icon}</span>
                      {s.text}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="deep-analysis-card">
              <h3>🧠 วิเคราะห์แนวโน้มและเหตุผลการสั่งซื้อโดยละเอียด</h3>
              {narrative.map((sec) => (
                <div className="narrative-section" key={sec.title}>
                  <h4>{sec.title}</h4>
                  {sec.lines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              ))}
            </section>

            <section className="field-grid-section">
              <h3>ข้อมูลอ้างอิงครบทุกช่อง</h3>
              <div className="field-grid">
                {fields.map(([label, value], i) => (
                  <div className="field-card" key={i}>
                    <span className="field-label">{label}</span>
                    <span className="field-value">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3>Recent edits</h3>
              {history && history.length === 0 && <p>No edits recorded yet.</p>}
              {history && history.length > 0 && (
                <ul className="history-list">
                  {history.slice(0, 10).map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.changedBy.displayName}</strong> changed {entry.fieldName} from{" "}
                      {entry.oldValue ?? "-"} to {entry.newValue ?? "-"} — {new Date(entry.changedAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        );
      })()}
    </aside>
  );
}
