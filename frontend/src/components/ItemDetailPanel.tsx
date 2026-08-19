import { Fragment, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getItem, getItemHistory, type PoDueDateRow } from "../api/items";
import { analyzeItem, computeWhatIfNext, nextCellTone, whatIfBucket } from "../lib/analysis";
import { buildNarrative, buildPlanReasons, buildSuggestions, type Run } from "../lib/narrative";
import { thaiMonthLabel, thaiDateShort } from "../lib/thaiMonths";

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
// Recharts sets each tooltip row's own inline color (defaulting to black, meant to match a
// multi-series legend) regardless of `contentStyle`'s color above — on this dark tooltip
// background that left every number invisible. `itemStyle`/`labelStyle` are the props that
// actually reach those inner elements.
const TOOLTIP_ITEM_STYLE = { color: TOOLTIP_STYLE.color };
const TOOLTIP_LABEL_STYLE = { color: TOOLTIP_STYLE.color };
const AXIS_TICK = { fontSize: 11, fill: CHART_MUTED };
const NEXT_LETTERS = ["BH", "BI", "BJ", "BK", "BL"];

/** Unstyled <b> defaults to accent2 — mirrors the original's `.da-text b { color: var(--acc2) }`. */
function RichRuns({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.bold ? (
          <b key={i} style={{ color: run.color ?? "var(--accent2)" }}>
            {run.text}
          </b>
        ) : (
          <span key={i}>{run.text}</span>
        )
      )}
    </>
  );
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || n === 0) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** Like fmt but never dashes a real zero — mirrors the original's fmtN(), used for Next-1..5 and usage-history values. */
function fmtN(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

const PO_DUE_DATE_COLLAPSED_COUNT = 2;

/** "YYYY-MM-DD" parsed as a local date (not via `new Date(str)`, which reads it as UTC midnight
 *  and can shift a day in either direction depending on the viewer's timezone offset). */
function formatPoDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return thaiDateShort(new Date(y, m - 1, d));
}

function PoDueDatesList({ rows }: { rows: PoDueDateRow[] }) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;

  const visible = expanded ? rows : rows.slice(0, PO_DUE_DATE_COLLAPSED_COUNT);
  const hidden = rows.slice(PO_DUE_DATE_COLLAPSED_COUNT);
  const hiddenTotal = hidden.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="po-due-dates">
      {visible.map((r) => (
        <Fragment key={r.date ?? "none"}>
          <span className="po-due-date-label" style={r.date === null ? { color: "var(--warning)" } : undefined}>
            {r.date ? formatPoDueDate(r.date) : "ไม่ระบุวันที่"}
          </span>
          <span className="po-due-date-qty">{fmtN(r.qty, 0)}</span>
        </Fragment>
      ))}
      {!expanded && hidden.length > 0 && (
        <button type="button" className="po-due-date-toggle" onClick={() => setExpanded(true)}>
          <span>+{hidden.length} วันอื่น</span>
          <span>{fmtN(hiddenTotal, 0)}</span>
        </button>
      )}
      {expanded && hidden.length > 0 && (
        <button
          type="button"
          className="po-due-date-toggle po-due-date-toggle-collapse"
          onClick={() => setExpanded(false)}
        >
          ▲ ย่อ
        </button>
      )}
    </div>
  );
}

const STATUS_DASHBOARD: Record<string, { label: string; color: string }> = {
  DANGER: { label: "🔴 วิกฤต", color: "var(--danger)" },
  WARN: { label: "🟡 ระวัง", color: "var(--warning)" },
  OK: { label: "🟢 ปกติ", color: "var(--success)" },
};

const DEFAULT_WIDTH = 520;
// No practical floor on shrinking — 40px is just a technical safety minimum (matches the
// items table's own column-resize floor) so the resizer never shrinks to an ungrabbable sliver.
const MIN_WIDTH = 40;
const MAX_WIDTH = 900;

export default function ItemDetailPanel({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const dragStart = useRef<{ x: number; width: number } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const { data: item, isLoading } = useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId),
  });
  const { data: history } = useQuery({
    queryKey: ["item-history", itemId],
    queryFn: () => getItemHistory(itemId),
  });

  // Sandbox-only "what if this PR arrives" input — never saved, never affects the real
  // Next-1..5 (which only ever move from a confirmed PO's Expected Receipt Date). Pre-fills
  // from the item's actual PR qty (so you don't retype it) but stays freely editable to try
  // other quantities — only this local value drives the preview below.
  const [whatIfPr, setWhatIfPr] = useState("");
  useEffect(() => {
    setWhatIfPr(item?.prQtyCurrent != null ? String(item.prQtyCurrent) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.prQtyCurrent]);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragStart.current) return;
      const delta = dragStart.current.x - e.clientX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStart.current.width + delta)));
    }
    function onMouseUp() {
      if (dragStart.current) {
        dragStart.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        // Restore the collapse/expand width transition now that the drag (which must stay
        // transition-free to avoid the panel rubber-banding behind the cursor) has ended.
        if (panelRef.current) panelRef.current.style.transitionProperty = "";
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function onResizeMouseDown(e: React.MouseEvent) {
    dragStart.current = { x: e.clientX, width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    if (panelRef.current) panelRef.current.style.transitionProperty = "none";
  }

  if (collapsed) {
    return (
      <aside ref={panelRef} className="detail-panel detail-panel-collapsed">
        <button type="button" className="detail-panel-toggle" onClick={() => setCollapsed(false)} title="ขยาย">
          ◀
        </button>
      </aside>
    );
  }

  return (
    <aside ref={panelRef} className="detail-panel" style={{ width }}>
      <div className="detail-panel-resizer" onMouseDown={onResizeMouseDown} />
      <div className="detail-panel-scroll">
      <div className="detail-panel-header">
        <h2>{item?.itemNoRaw ?? "..."}</h2>
        <div className="detail-panel-header-actions">
          <button type="button" onClick={() => setCollapsed(true)} title="หุบ">
            ▶
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {isLoading && <p>Loading...</p>}

      {item && (() => {
        const a = analyzeItem(item);
        const narrative = buildNarrative(item, a);
        const suggestions = buildSuggestions(item, a);
        const planReasons = buildPlanReasons(item, a);
        const maxAbsNext = Math.max(...a.next.map((v) => Math.abs(v)), item.sumMin ?? 0, 1);
        const usageChartData = item.usageHistory.map((h) => ({
          monthIndex: h.monthIndex,
          qty: h.qty,
        }));
        const forecastChartData = a.next.map((v, i) => ({
          label: `${NEXT_LETTERS[i]} ${thaiMonthLabel(i + 1)}`,
          value: v,
        }));

        const whatIfPrQty = Number(whatIfPr) || 0;
        const whatIfNext = whatIfPrQty > 0 ? computeWhatIfNext(a.next, item.leadTimeDays, whatIfPrQty) : null;
        const whatIfBucketMonth = whatIfBucket(item.leadTimeDays);

        const hasPoDueDates = item.poDueDates.length > 0;

        const fields: Array<[string, string]> = [
          ["No. (A)", item.itemNoRaw],
          ["Description (B)", item.description ?? "-"],
          ["Class (F)", item.class ?? "-"],
          ["Category (G)", item.category ?? "-"],
          ["Dimension (H)", item.dimension ?? "-"],
          ["Vendor (K)", item.vendor ?? "-"],
          ["Pur. Price (I)", `฿${fmt(item.purchasePrice, 2)}`],
          ["Unit Cost (J)", item.unitCost != null ? `฿${fmt(item.unitCost, 2)}` : "-"],
          ["PO N0 / M", fmtN(item.poQty, 0)],
          ["ST N0 / Q", fmtN(item.stockQty, 0)],
          ["BO QTY / Y", fmtN(item.backorderQty, 0)],
          ...item.yearlySales.map((y): [string, string] => [`${y.year}`, fmt(y.qty, 0)]),
          ...item.usageHistory.map((h): [string, string] => [
            `M-${12 - h.monthIndex} ${thaiMonthLabel(h.monthIndex - 12)}`,
            fmtN(h.qty, 0),
          ]),
          ["รวม 12M (AV)", fmt(item.usageHistory.slice(0, 12).reduce((s, h) => s + h.qty, 0), 0)],
          ["AVG/M (AW)", fmt(item.avgMonth, 1)],
          ["Lead Time (AX)", `${item.leadTimeDays ?? "—"} วัน`],
          ["Min usage (AY)", fmt(item.minUsage, 0)],
          ["Max usage (AZ)", fmt(item.maxUsage, 0)],
          ["New MIN.ST (BA)", fmt(item.recommendedMin, 1)],
          ["Old MIN (BB)", fmt(item.oldMin, 0)],
          ["Sum MIN ✦ (BC)", fmt(item.sumMin, 0)],
          ["PR qty suggested (calc.)", fmt(item.prQtySuggested, 0)],
          ["PR qty current (BG)", fmt(item.prQtyCurrent, 0)],
          ...([1, 2, 3, 4, 5] as const).map(
            (n): [string, string] => [`Next-${n} (${NEXT_LETTERS[n - 1]}) ${thaiMonthLabel(n)}`, fmtN(a.next[n - 1], 1)]
          ),
          ["Remark (BM)", item.remark ?? "-"],
          ["For Model (BN)", item.forModel ?? "-"],
        ];

        return (
          <div className="detail-panel-body">
            <h1 className="detail-title">{item.description}</h1>
            {item.isStale && (
              <div
                style={{
                  margin: "0 0 0.75rem",
                  padding: "0.5rem 0.7rem",
                  background: "color-mix(in srgb, var(--warning) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                  borderRadius: 6,
                  fontSize: "0.8rem",
                  color: "var(--warning)",
                }}
              >
                ⚠️ รายการนี้ไม่พบในไฟล์ import ล่าสุด — ตัวเลข Stock/คาดการณ์ด้านล่างอาจไม่เป็นปัจจุบัน
              </div>
            )}
            <div className="detail-chips">
              <span className="chip">
                <span className="chip-label">รหัส</span>
                <span className="chip-value" style={{ color: "var(--accent2)" }}>{item.itemNoRaw}</span>
              </span>
              <span className="chip">
                <span className="chip-label">ประเภท</span>
                <span className="chip-value" style={{ color: "var(--text-muted2)" }}>{item.category ?? "—"}</span>
              </span>
              <span className="chip">
                <span className="chip-label">Lead</span>
                <span className="chip-value" style={{ color: "var(--warning)" }}>
                  {item.leadTimeDays ?? "—"} วัน
                </span>
              </span>
              <span className="chip">
                <span className="chip-label">Vendor</span>
                <span className="chip-value" style={{ color: "var(--text-muted2)" }}>{item.vendor ?? "—"}</span>
              </span>
            </div>

            <div className="detail-kpis">
              <div className="kpi">
                <span className="kpi-label">PO N0 (BD=M)</span>
                <span className="kpi-value" style={{ color: "var(--accent2)" }}>{fmtN(item.poQty, 0)}</span>
                {hasPoDueDates ? (
                  <PoDueDatesList key={item.id} rows={item.poDueDates} />
                ) : (
                  <span className="kpi-sub">ช่อง M: {fmtN(item.poQty, 0)}</span>
                )}
              </div>
              <div className="kpi">
                <span className="kpi-label">Stock N0 (BE=Q)</span>
                <span className="kpi-value" style={{ color: "var(--accent)" }}>{fmtN(item.stockQty, 0)}</span>
                <span className="kpi-sub">ช่อง Q: {fmtN(item.stockQty, 0)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Sale Order (BF=Y)</span>
                <span className="kpi-value" style={{ color: "var(--warning)" }}>
                  {fmtN(item.backorderQty, 0)}
                </span>
                <span className="kpi-sub">ช่อง Y: {fmtN(item.backorderQty, 0)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">AVG/M (AW)</span>
                <span className="kpi-value">{fmt(item.avgMonth, 1)}</span>
                <span className="kpi-sub">Lead Time: {item.leadTimeDays ?? "—"} วัน (AX)</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Sum MIN ✦ (BC)</span>
                <span className="kpi-value" style={{ color: "var(--accent)" }}>{fmt(item.sumMin, 0)}</span>
                <span className="kpi-sub">Old MIN (BB): {fmt(item.oldMin, 0)}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">สถานะ</span>
                <span
                  className="kpi-value"
                  style={{
                    color: STATUS_DASHBOARD[item.calcStatus ?? "OK"]?.color,
                    fontSize: "0.8125rem",
                  }}
                >
                  {STATUS_DASHBOARD[item.calcStatus ?? "OK"]?.label ?? "-"}
                </span>
                <span className="kpi-sub">PR (BG): {item.prQtyCurrent ? fmt(item.prQtyCurrent, 0) : "—"}</span>
              </div>
            </div>

            <div className="detail-charts-grid">
              <section className="detail-chart-card">
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
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      labelFormatter={(v) => thaiMonthLabel(Number(v) - 12)}
                    />
                    <Area
                      type="monotone"
                      dataKey="qty"
                      stroke={CHART_ACCENT}
                      fill={CHART_ACCENT}
                      fillOpacity={0.15}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </section>

              <section className="detail-chart-card">
                <h3>พยากรณ์ BH-BL vs SUM MIN (BC)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={forecastChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="label" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      itemStyle={TOOLTIP_ITEM_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
                    />
                    <Bar dataKey="value" activeBar={false} isAnimationActive={false}>
                      {forecastChartData.map((d, i) => (
                        <Cell key={i} fill={item.sumMin != null && d.value < item.sumMin ? CHART_DANGER : CHART_ACCENT3} />
                      ))}
                    </Bar>
                    {item.sumMin != null && (
                      <ReferenceLine y={item.sumMin} stroke={CHART_DANGER} strokeDasharray="4 4" label="MIN" />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="detail-chart-card">
                <h3>ยอดขายรายปี (AC-AH)</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={item.yearlySales.map((y) => ({ year: y.year, qty: y.qty }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis dataKey="year" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                    <Bar dataKey="qty" fill={CHART_ACCENT} activeBar={false} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </section>

              <section className="detail-chart-card">
                <h3>NEXT-1→5 vs SUM MIN (BC)</h3>
                <div className="whatif-pr-row">
                  <label htmlFor="whatif-pr-input">PR qty (ทดลอง)</label>
                  <input
                    id="whatif-pr-input"
                    type="number"
                    min={0}
                    placeholder="พิมพ์จำนวน เช่น 100"
                    value={whatIfPr}
                    onChange={(e) => setWhatIfPr(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                    }}
                  />
                </div>
                <p className="whatif-pr-hint">
                  {whatIfPrQty > 0
                    ? `ถ้า PR ${fmtN(whatIfPrQty, 0)} หน่วยนี้เข้าจริง จะถึงมือประมาณ Next-${whatIfBucketMonth} (ตาม Lead Time ${item.leadTimeDays ?? "—"} วัน) — ค่า Next-1..5 จริงยังไม่เปลี่ยน จนกว่าจะมี PO ยืนยันจริง`
                    : "พิมพ์จำนวน PR เพื่อดูตัวอย่างผลกระทบต่อ Next-1..5 (ไม่บันทึกจริง)"}
                </p>
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
                        <span className={`next-bar-value tone-${tone}`}>{fmtN(val, 1)}</span>
                        {whatIfNext && (
                          <span className={`next-bar-whatif tone-${nextCellTone(whatIfNext[i], item.sumMin)}`}>
                            → {fmtN(whatIfNext[i], 1)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="next-bar-footer">
                  Sum MIN (BC): {fmt(item.sumMin, 0)} · Old MIN (BB): {fmt(item.oldMin, 0)} · New MIN (BA):{" "}
                  {fmt(item.recommendedMin, 1)}
                </p>
              </section>
            </div>

            <section className="plan-card">
              <h3 className="plan-card-title">🤖 แผนการสั่งซื้อที่แนะนำ</h3>

              {a.triggerMonth > 0 ? (
                <>
                  <div className={`plan-banner tone-${a.urgency.tone}`}>
                    <div>
                      <div className="plan-banner-label">สถานะ</div>
                      <div className={`plan-banner-value tone-${a.urgency.tone}`}>{a.urgency.label}</div>
                    </div>
                    <div className="plan-banner-due">
                      <div className="plan-banner-label">ต้องสั่งภายใน</div>
                      <div className={`plan-banner-value tone-${a.urgency.tone}`}>
                        {a.daysToOrder <= 0
                          ? "ทันที!"
                          : item.mustOrderByDate
                            ? `${thaiDateShort(new Date(item.mustOrderByDate))} (${a.daysToOrder} วัน)`
                            : "-"}
                      </div>
                    </div>
                  </div>
                  <div className="plan-kpis">
                    <div className="kpi">
                      <span className="kpi-label">จำนวนที่ควรสั่ง</span>
                      <span className={`kpi-value tone-${a.urgency.tone}`}>{fmtN(a.recommendedOrderQty, 0)}</span>
                      <span className="kpi-sub">
                        หน่วย{item.packingRule?.active ? ` (คูณของ ${item.packingRule.multipleOf})` : ""}
                      </span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">เดือนที่ Stock ต่ำกว่า MIN</span>
                      <span className="kpi-value tone-danger">
                        {a.triggerMonthLabel} ({a.triggerLetter})
                      </span>
                      <span className="kpi-sub">
                        {fmtN(a.triggerValue, 1)} &lt; {fmt(item.sumMin, 0)}
                      </span>
                    </div>
                    <div className="kpi">
                      <span className="kpi-label">มูลค่าประมาณ</span>
                      <span className="kpi-value tone-warn">
                        {(item.purchasePrice ?? 0) > 0 ? `฿${fmt(a.estimatedValue, 0)}` : "—"}
                      </span>
                      <span className="kpi-sub">
                        {(item.purchasePrice ?? 0) > 0 ? `@฿${fmt(item.purchasePrice, 2)}/หน่วย` : "ไม่มีราคา"}
                      </span>
                    </div>
                  </div>
                  <div className="plan-timeline-label">ไทม์ไลน์</div>
                  <div className="plan-timeline">
                    {([1, 2, 3, 4, 5] as const).map((n) => {
                      const isTrigger = n === a.triggerMonth;
                      const belowMin = item.sumMin != null && item.sumMin > 0 && a.next[n - 1] < item.sumMin;
                      const cls = isTrigger ? "trigger" : belowMin ? "below" : "above";
                      return (
                        <div key={n} className={`timeline-tab ${cls}`}>
                          {thaiMonthLabel(n)}
                          {isTrigger ? " ⚠" : ""}
                        </div>
                      );
                    })}
                  </div>
                  <p className="plan-summary">
                    🏁 ต้องสั่งวันที่:{" "}
                    <b className={`tone-${a.urgency.tone}`}>
                      {item.mustOrderByDate ? thaiDateShort(new Date(item.mustOrderByDate)) : "-"}
                    </b>{" "}
                    | Lead: <b>{item.leadTimeDays ?? "—"} วัน</b> | Stock ต่ำกว่า MIN:{" "}
                    <b className="tone-danger">{a.triggerMonthLabel}</b>
                  </p>
                  <div className="plan-reasons">
                    <h4>เหตุผลที่ควรสั่ง</h4>
                    {planReasons.map((runs, i) => (
                      <div className={`reason-line tone-${a.urgency.tone}`} key={i}>
                        <RichRuns runs={runs} />
                      </div>
                    ))}
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
                  {sec.blocks.map((block, i) => {
                    if (block.kind === "subheading") {
                      return (
                        <div className="narrative-subheading" key={i}>
                          {block.text}
                        </div>
                      );
                    }
                    if (block.kind === "bullets") {
                      return (
                        <div className="narrative-bullets" key={i}>
                          {block.items.map((runs, j) => (
                            <div className="narrative-bullet" key={j}>
                              <RichRuns runs={runs} />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <p key={i}>
                        <RichRuns runs={block.runs} />
                      </p>
                    );
                  })}
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
      </div>
    </aside>
  );
}
