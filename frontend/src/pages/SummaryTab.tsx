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
import { ArtDanger, ArtForklift, ArtMoneyBag, ArtPr, ArtProvision, ArtStock } from "../components/KpiArt";
import {
  buildCategoryMinBreakdown,
  buildProvisionSummary,
  buildSummaryData,
  calcMonthsToNormal,
  type ChangeRow,
} from "../lib/summary";
import { provisionShortLabel, provisionTone } from "../lib/provision";
import { tr, useLang } from "../lib/i18n";
import { exportSumMinChangeExcel, exportSumMinSheet, exportUsageContinuitySheet } from "../lib/summaryExport";

// Theme variables, not hex: charts and colored text follow whichever theme is active.
const CHART_MUTED = "var(--text-muted2)";
const CHART_GRID = "var(--border)";
const GREEN = "var(--success)";
const RED = "var(--danger)";
const BLUE = "var(--accent2)";
const GRAY = "var(--flat)";
const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--text)",
};
// Recharts sets each tooltip row's own inline color (defaulting to black, meant to match a
// multi-series legend) regardless of `contentStyle`'s color above — on a dark tooltip
// background that left every number invisible. `itemStyle`/`labelStyle` are the props that
// actually reach those inner elements.
const TOOLTIP_ITEM_STYLE = { color: TOOLTIP_STYLE.color };
const TOOLTIP_LABEL_STYLE = { color: TOOLTIP_STYLE.color };
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
          {row.oldMin > 0 ? `Old MIN ${fmt(row.oldMin)} → ` : "NEW → "}
          <b style={{ color }}>Sum MIN {fmt(row.sumMin)}</b>
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
          {item.itemNoRaw} · {tr(`ใช้ ${nz}/6 เดือน`, `used ${nz}/6 months`)}
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

  const lang = useLang();

  const summary = useMemo(() => buildSummaryData(items ?? []), [items]);
  // "(no group)" label is built inside, so re-run on a language switch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catMinBreakdown = useMemo(() => buildCategoryMinBreakdown(items ?? []), [items, lang]);
  const provision = useMemo(() => buildProvisionSummary(items ?? []), [items]);

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

  const catMinTotal = catMinBreakdown.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      withMin: acc.withMin + r.withMin,
      withoutMin: acc.withoutMin + r.withoutMin,
      stockWithMin: acc.stockWithMin + r.stockWithMin,
      stockWithoutMin: acc.stockWithoutMin + r.stockWithoutMin,
      withoutMinStockGt0: acc.withoutMinStockGt0 + r.withoutMinStockGt0,
    }),
    { total: 0, withMin: 0, withoutMin: 0, stockWithMin: 0, stockWithoutMin: 0, withoutMinStockGt0: 0 },
  );
  const catMinNoMinGroups = catMinBreakdown.filter((r) => r.total > 0 && r.withMin === 0);

  // Single source of truth for "increased + brand-new SUM MIN" rows — used by the on-screen
  // list, its overflow count, and both export buttons, so all three can never disagree about
  // which rows are actually included (a mismatch here was the exact bug already found twice:
  // once between the screen and the export, once between the screen and its own overflow count).
  const increasedWithNew = increased.concat(newItems);

  const trendTotal = upTrend + downTrend + flatTrend;
  const donutData = [
    { name: tr("ขาขึ้น", "Rising"), value: upTrend, color: GREEN },
    { name: tr("ทรงตัว", "Flat"), value: flatTrend, color: GRAY },
    { name: tr("ขาลง", "Falling"), value: downTrend, color: RED },
  ];

  const stockVsNext = [
    { label: tr("ปัจจุบัน", "Now"), value: totalStock, isCurrent: true },
    { label: "Next-0", value: totalNext[0], isCurrent: false },
    { label: "Next-1", value: totalNext[1], isCurrent: false },
    { label: "Next-2", value: totalNext[2], isCurrent: false },
    { label: "Next-3", value: totalNext[3], isCurrent: false },
    { label: "Next-4", value: totalNext[4], isCurrent: false },
    { label: "Next-5", value: totalNext[5], isCurrent: false },
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
          <div className="sum-kl">{tr("รายการใน SUM MIN", "Items in SUM MIN")}</div>
          <div className="sum-kv" style={{ color: "var(--accent)" }}>
            {fmt(totalItems)}
          </div>
          <div className="sum-ks">{tr("รายการที่มี Sum MIN", "Items with a Sum MIN")}</div>
          <span className="kart-slot"><ArtStock /></span>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">{tr("Stock N0 รวม", "Total N0 stock")}</div>
          <div className="sum-kv" style={{ color: "var(--accent2)" }}>
            {fmt(totalStock)} {tr("ชิ้น", "pcs")}
          </div>
          <span className="kart-slot"><ArtForklift /></span>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">{tr("มูลค่า Stock รวม", "Total stock value")}</div>
          <div className="sum-kv" style={{ color: "var(--warning)" }}>
            ฿{(totalValue / 1e6).toFixed(2)}M
          </div>
          <div className="sum-ks">Stock×Pur.Price</div>
          <span className="kart-slot"><ArtMoneyBag /></span>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">{tr("🔴 วิกฤต / 🟡 ระวัง", "🔴 Critical / 🟡 Warning")}</div>
          <div className="sum-kv" style={{ color: "var(--danger)" }}>
            {dangerCnt} / {warnCnt}
          </div>
          <div className="sum-ks">Next&lt;SUM MIN</div>
          <span className="kart-slot"><ArtDanger /></span>
        </div>
        <div className="sum-kc">
          <div className="sum-kl">{tr("PR qty รอเปิด", "Pending PR qty")}</div>
          <div className="sum-kv" style={{ color: "var(--accent3)" }}>
            {fmt(prItems)} {tr("รายการ", "items")}
          </div>
          <div className="sum-ks">{tr("มูลค่า", "Value")} ฿{(prValue / 1e6).toFixed(2)}M</div>
          <span className="kart-slot"><ArtPr /></span>
        </div>
      </div>

      <div className="sum-sec">
        <div className="sum-sec-hd">
          <span>{tr("🗂 SKU ตามกลุ่ม MACHINE / PART × MIN.ST", "🗂 SKUs by group MACHINE / PART × MIN.ST")}</span>
        </div>
        <div className="sum-sec-bd">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem", minWidth: 640 }}>
              <thead>
                <tr style={{ color: "var(--text-muted)", fontSize: "0.66rem", textTransform: "uppercase" }}>
                  <td style={{ padding: "0.3rem 0.4rem 0.3rem 0" }} rowSpan={2}>
                    {tr("กลุ่ม", "Group")}
                  </td>
                  <td style={{ padding: "0.3rem 0.4rem 0.3rem" }} rowSpan={2}>
                    {tr("SKU รวม", "Total SKUs")}
                  </td>
                  <td style={{ padding: "0.3rem 0.4rem 0.3rem" }} rowSpan={2}>
                    {tr("Stock รวม (ชิ้น)", "Total stock (pcs)")}
                  </td>
                  <td
                    style={{ padding: "0.3rem 0.4rem 0.15rem", textAlign: "center", borderBottom: "1px solid var(--border-strong)", color: GREEN }}
                    colSpan={2}
                  >
                    {tr("มี MIN.ST", "With MIN.ST")}
                  </td>
                  <td style={{ padding: "0.3rem 0.4rem 0.15rem", textAlign: "center", borderBottom: "1px solid var(--border-strong)" }} colSpan={3}>
                    {tr("ไม่มี MIN.ST", "Without MIN.ST")}
                  </td>
                  <td style={{ padding: "0.3rem 0 0.3rem 0.4rem", textAlign: "right" }} rowSpan={2}>
                    {tr("%SKU มี MIN.ST", "%SKU with MIN.ST")}
                  </td>
                </tr>
                <tr style={{ color: "var(--text-muted)", fontSize: "0.64rem" }}>
                  <td style={{ padding: "0.15rem 0.4rem 0.4rem", textAlign: "right" }}>SKU</td>
                  <td style={{ padding: "0.15rem 0.4rem 0.4rem", textAlign: "right" }}>{tr("Stock (ชิ้น)", "Stock (pcs)")}</td>
                  <td style={{ padding: "0.15rem 0.4rem 0.4rem", textAlign: "right" }}>SKU</td>
                  <td style={{ padding: "0.15rem 0.4rem 0.4rem", textAlign: "right" }}>{tr("Stock (ชิ้น)", "Stock (pcs)")}</td>
                  <td style={{ padding: "0.15rem 0.4rem 0.4rem", textAlign: "right", color: BLUE }}>SKU (Stock&gt;0)</td>
                </tr>
              </thead>
              <tbody style={{ fontFamily: "var(--font-mono)" }}>
                {catMinBreakdown.map((r) => (
                  <tr key={r.label} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "0.45rem 0.4rem 0.45rem 0", fontFamily: "inherit", fontWeight: 600 }}>
                      {r.category === "MACHINE" ? "🔧 MACHINE" : r.category === "PART" ? "📦 PART" : r.label}
                    </td>
                    <td style={{ padding: "0.45rem 0.4rem", textAlign: "right" }}>{fmt(r.total)}</td>
                    <td style={{ padding: "0.45rem 0.4rem", textAlign: "right" }}>{fmt(r.stockWithMin + r.stockWithoutMin)}</td>
                    <td style={{ padding: "0.45rem 0.4rem", textAlign: "right", color: r.withMin > 0 ? GREEN : RED }}>{fmt(r.withMin)}</td>
                    <td style={{ padding: "0.45rem 0.4rem", textAlign: "right", color: r.withMin > 0 ? GREEN : RED }}>
                      {fmt(r.stockWithMin)}
                    </td>
                    <td style={{ padding: "0.45rem 0.4rem", textAlign: "right" }}>{fmt(r.withoutMin)}</td>
                    <td style={{ padding: "0.45rem 0.4rem", textAlign: "right" }}>{fmt(r.stockWithoutMin)}</td>
                    <td style={{ padding: "0.45rem 0.4rem", textAlign: "right", color: BLUE, fontWeight: 700 }}>
                      {fmt(r.withoutMinStockGt0)}
                    </td>
                    <td style={{ padding: "0.45rem 0 0.45rem 0.4rem", textAlign: "right", color: r.withMin > 0 ? GREEN : RED }}>
                      {r.total > 0 ? ((r.withMin / r.total) * 100).toFixed(1) : "0.0"}%
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "1px solid var(--border-strong)", fontWeight: 700 }}>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem 0", fontFamily: "inherit" }}>{tr("รวมทั้งหมด", "Grand total")}</td>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem", textAlign: "right" }}>{fmt(catMinTotal.total)}</td>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem", textAlign: "right" }}>
                    {fmt(catMinTotal.stockWithMin + catMinTotal.stockWithoutMin)}
                  </td>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem", textAlign: "right", color: "var(--accent)" }}>{fmt(catMinTotal.withMin)}</td>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem", textAlign: "right", color: "var(--accent)" }}>
                    {fmt(catMinTotal.stockWithMin)}
                  </td>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem", textAlign: "right" }}>{fmt(catMinTotal.withoutMin)}</td>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem", textAlign: "right" }}>{fmt(catMinTotal.stockWithoutMin)}</td>
                  <td style={{ padding: "0.5rem 0.4rem 0.2rem", textAlign: "right", color: BLUE }}>
                    {fmt(catMinTotal.withoutMinStockGt0)}
                  </td>
                  <td style={{ padding: "0.5rem 0 0.2rem 0.4rem", textAlign: "right", color: "var(--accent)" }}>
                    {catMinTotal.total > 0 ? ((catMinTotal.withMin / catMinTotal.total) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {catMinNoMinGroups.length > 0 && catMinTotal.withMin > 0 && (
            <div
              style={{
                marginTop: "0.75rem",
                padding: "0.55rem 0.7rem",
                background: "color-mix(in srgb, var(--danger) 9%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 27%, transparent)",
                borderRadius: 6,
                fontSize: "0.72rem",
                lineHeight: 1.5,
              }}
            >
              {tr("⚠️ ข้อสังเกต: กลุ่ม", "⚠️ Note: group")}{" "}
              <b>
                {tr(
                  `${catMinNoMinGroups.map((g) => g.label).join(", ")} ทั้งหมด ${fmt(catMinNoMinGroups.reduce((s, g) => s + g.total, 0))} รายการ ไม่มี MIN.ST ตั้งค่าไว้เลยแม้แต่รายการเดียว`,
                  `${catMinNoMinGroups.map((g) => g.label).join(", ")} (${fmt(catMinNoMinGroups.reduce((s, g) => s + g.total, 0))} items) has no MIN.ST set on a single item`,
                )}
              </b>{" "}
              {tr(
                `— SKU ที่มี MIN.ST (${fmt(catMinTotal.withMin)} รายการ) กระจุกอยู่ในกลุ่มอื่นทั้งหมด`,
                `— all SKUs with a MIN.ST (${fmt(catMinTotal.withMin)} items) are in the other groups`,
              )}
            </div>
          )}
        </div>
      </div>

      {provision.tiers.length > 0 && (
        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span>{tr("🏷️ สต็อกที่ติด Provision", "🏷️ Stock under provision")}</span>
            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 400 }}>
              {tr("เฉพาะรายการที่มีสต็อก N0", "Only items with N0 stock")}
            </span>
          </div>
          <div className="sum-sec-bd">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
              {provision.tiers.map((t) => (
                <div className="sum-kc" key={t.months}>
                  <div className="sum-kl">
                    <span className={`prov-badge tone-${provisionTone(t.months)}`}>{provisionShortLabel(t.months)}</span>
                  </div>
                  <div className="sum-kv">
                    {fmt(t.items)} <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "var(--text-muted)" }}>{tr("รายการ", "items")}</span>
                  </div>
                  <div className="sum-ks">{fmt(t.pieces)} {tr("ชิ้น", "pcs")}</div>
                  <span className="kart-slot">
                    <ArtProvision tone={provisionTone(t.months)} />
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem", fontSize: "0.78rem" }}>
              <span style={{ color: "var(--text-muted)" }}>{tr("รวม", "Total")} </span>
              <b style={{ fontFamily: "var(--font-mono)" }}>{fmt(provision.items)}</b> {tr("รายการ", "items")} ·{" "}
              <b style={{ fontFamily: "var(--font-mono)" }}>{fmt(provision.pieces)}</b> {tr("ชิ้น · มูลค่าตามราคาซื้อ", "pcs · value at purchase price")}{" "}
              <b style={{ fontFamily: "var(--font-mono)" }}>฿{fmt(provision.value)}</b>
            </div>
            {provision.pricedItems < provision.items && (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.5rem 0.7rem",
                  background: "color-mix(in srgb, var(--warning) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
                  borderRadius: 6,
                  fontSize: "0.72rem",
                  lineHeight: 1.5,
                  color: "var(--warning)",
                }}
              >
                {tr(
                  `มูลค่านี้นับได้ ${fmt(provision.pricedItems)} จาก ${fmt(provision.items)} รายการ เพราะอีก ${fmt(provision.items - provision.pricedItems)} รายการไม่มีราคาซื้อในไฟล์ ตัวเลขจริงจะสูงกว่านี้`,
                  `This value covers ${fmt(provision.pricedItems)} of ${fmt(provision.items)} items; the other ${fmt(provision.items - provision.pricedItems)} have no purchase price in the file, so the real figure is higher`,
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="sum-two">
        <div className="sum-sec">
          <div className="sum-sec-hd">{tr("📦 สัดส่วนแนวโน้มการใช้ (6 เดือน)", "📦 Usage trend mix (6 months)")}</div>
          <div className="sum-sec-bd">
            {trendTotal === 0 ? (
              <p>{tr("ไม่มีข้อมูล", "No data")}</p>
            ) : (
              <div className="donut-row">
                <ResponsiveContainer width="55%" height={200}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-legend">
                  <div className="donut-total">
                    {fmt(trendTotal)}
                    <span>{tr("รายการ", "items")}</span>
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
          <div className="sum-sec-hd">
            {tr("📐 Stock ปัจจุบัน vs คาดการณ์ Next-0..5 (รวมทั้งหมด)", "📐 Current stock vs forecast Next-0..5 (all items)")}
          </div>
          <div className="sum-sec-bd">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stockVsNext} margin={{ top: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="label" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={TOOLTIP_ITEM_STYLE}
                  labelStyle={TOOLTIP_LABEL_STYLE}
                  formatter={(v) => (typeof v === "number" ? v.toFixed(2) : v)}
                />
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
                    {curPct.toFixed(1)}% ({curPct >= 0 ? tr("สูงกว่า", "above") : tr("ต่ำกว่า", "below")} SUM MIN) — {fmt(totalStock)} /{" "}
                    {fmt(sumMinTotal)}
                  </>
                ) : (
                  "-"
                )}
              </p>
              {totalStock >= sumMinTotal ? (
                <p style={{ color: GREEN }}>{tr("✅ อยู่ในระดับปกติแล้ว", "✅ Already at a normal level")}</p>
              ) : eta?.found ? (
                <p style={{ color: "var(--warning)" }}>
                  📅 {eta.label} (~{eta.monthIdx} {tr("เดือน", "months")})
                </p>
              ) : (
                <p style={{ color: RED }}>{tr("⚠️ เกิน 5 เดือนข้างหน้า", "⚠️ More than 5 months ahead")}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="sum-three">
        <div className="sum-sec">
          <div className="sum-sec-hd">
            {tr("แนวโน้ม Inventory (6 เดือนย้อนหลัง + Next-0..5)", "Inventory trend (last 6 months + Next-0..5)")}
          </div>
          <div className="sum-sec-bd">
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
              {tr("แนวโน้ม 6 เดือน", "6-month trend")}
            </div>
            <div className="sum-three" style={{ marginBottom: "0.75rem" }}>
              <div className="mini-kc">
                <div className="sum-kl">↑ {tr("ขาขึ้น", "Rising")}</div>
                <div className="sum-kv" style={{ color: GREEN, fontSize: "1rem" }}>
                  {fmt(upTrend)}
                </div>
              </div>
              <div className="mini-kc">
                <div className="sum-kl">→ {tr("ทรงตัว", "Flat")}</div>
                <div className="sum-kv" style={{ color: GRAY, fontSize: "1rem" }}>
                  {fmt(flatTrend)}
                </div>
              </div>
              <div className="mini-kc">
                <div className="sum-kl">↓ {tr("ขาลง", "Falling")}</div>
                <div className="sum-kv" style={{ color: RED, fontSize: "1rem" }}>
                  {fmt(downTrend)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
              {tr("คาดการณ์ Stock (Next-0)", "Stock forecast (Next-0)")}
            </div>
            <p style={{ fontSize: "0.85rem", marginBottom: "0.5rem" }}>
              {invTrend === "up" ? "📈 " : invTrend === "down" ? "📉 " : "➡️ "}
              Inventory{" "}
              <strong style={{ color: invTrend === "up" ? GREEN : invTrend === "down" ? RED : GRAY }}>
                {invTrend === "up" ? tr("เพิ่มขึ้น", "rising") : invTrend === "down" ? tr("ลดลง", "falling") : tr("ทรงตัว", "flat")}
              </strong>{" "}
              <span style={{ color: "var(--text-muted)" }}>
                {invPct >= 0 ? "+" : ""}
                {invPct.toFixed(1)}% {tr("จาก Stock ปัจจุบัน", "vs current stock")}
              </span>
            </p>
            <div className="fcrow">
              <span className="fcl">{tr("Stock N0 รวมปัจจุบัน", "Current total N0 stock")}</span>
              <span className="fcv">{fmt(totalStock)}</span>
            </div>
            <div className="fcrow">
              <span className="fcl">{tr("คาด Next-1 รวม", "Forecast Next-1 total")}</span>
              <span className="fcv" style={{ color: totalInvNext > totalStock ? GREEN : RED }}>
                {fmt(totalInvNext)}
              </span>
            </div>
            <div className="fcrow">
              <span className="fcl">{tr("มูลค่า Stock รวม", "Total stock value")}</span>
              <span className="fcv">฿{fmt(totalValue)}</span>
            </div>
          </div>
        </div>

        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>{tr("✅ ใช้ต่อเนื่อง (≥3/6 เดือน)", "✅ Used regularly (≥3/6 months)")}</span>
              <span style={{ color: GREEN, fontFamily: "var(--font-mono)" }}>{fmt(contItems.length)} {tr("รายการ", "items")}</span>
            </span>
            <button
              type="button"
              className="sum-export-btn"
              onClick={() => exportUsageContinuitySheet("cont", contItems)}
            >
              ⬇ Excel
            </button>
          </div>
          <div className="sum-sec-bd item-list" style={{ maxHeight: 260 }}>
            {contItems.slice(0, 100).map((d) => (
              <UsageItemRow item={d} onGoToItem={onGoToItem} key={d.id} />
            ))}
            {contItems.length > 100 && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", padding: "0.3rem 0" }}>
                ...+{contItems.length - 100} {tr("รายการ", "items")}
              </div>
            )}
          </div>
        </div>
        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>{tr("⚠️ ใช้ไม่ต่อเนื่อง (<3/6 เดือน)", "⚠️ Used irregularly (<3/6 months)")}</span>
              <span style={{ color: "var(--warning)", fontFamily: "var(--font-mono)" }}>{fmt(discItems.length)} {tr("รายการ", "items")}</span>
            </span>
            <button
              type="button"
              className="sum-export-btn"
              onClick={() => exportUsageContinuitySheet("disc", discItems)}
            >
              ⬇ Excel
            </button>
          </div>
          <div className="sum-sec-bd item-list" style={{ maxHeight: 260 }}>
            {discItems.slice(0, 100).map((d) => (
              <UsageItemRow item={d} onGoToItem={onGoToItem} key={d.id} />
            ))}
            {discItems.length > 100 && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", padding: "0.3rem 0" }}>
                ...+{discItems.length - 100} {tr("รายการ", "items")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="sum-sec">
        <div className="sum-sec-hd">
          <span>{tr("📋 ส่งออกรายการ SUM MIN ที่เปลี่ยนแปลง", "📋 Export SUM MIN changes")}</span>
          <button
            type="button"
            className="sum-export-btn"
            onClick={() => exportSumMinChangeExcel(increasedWithNew, decreased)}
          >
            {tr("⬇ Export Excel ทั้งหมด (2 sheets)", "⬇ Export all to Excel (2 sheets)")}
          </button>
        </div>
      </div>

      <div className="sum-two">
        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span>
              {tr(
                `📈 SUM MIN เพิ่มขึ้น (Sum MIN > Old MIN) —${fmt(increased.length)} รายการ (ใหม่ ${fmt(newItems.length)})`,
                `📈 SUM MIN increased (Sum MIN > Old MIN) — ${fmt(increased.length)} items (new ${fmt(newItems.length)})`,
              )}
            </span>
            <button
              type="button"
              className="sum-export-btn"
              onClick={() => exportSumMinSheet("up", increasedWithNew)}
            >
              ⬇ Excel
            </button>
          </div>
          <div className="sum-sec-bd item-list" style={{ maxHeight: 280 }}>
            {newItems.length > 0 && (
              <div style={{ fontSize: "0.65rem", color: "var(--accent)", marginBottom: "0.3rem", fontWeight: 700 }}>
                {tr(
                  `NEW (Old MIN = 0 → มี Sum MIN):${fmt(newItems.length)} รายการ`,
                  `NEW (Old MIN = 0 → has Sum MIN): ${fmt(newItems.length)} items`,
                )}
              </div>
            )}
            {increasedWithNew.slice(0, 120).map((d, i) => (
              <ChangeRowLine row={d} isUp onGoToItem={onGoToItem} key={i} />
            ))}
            {increasedWithNew.length > 120 && (
              <div style={{ fontSize: "0.625rem", color: "var(--text-muted)", padding: "0.3rem 0" }}>
                ...+{increasedWithNew.length - 120} {tr("รายการ", "items")}
              </div>
            )}
          </div>
        </div>
        <div className="sum-sec">
          <div className="sum-sec-hd">
            <span>
              {tr(
                `📉 SUM MIN ลดลง (Sum MIN < Old MIN) —${fmt(decreased.length)} รายการ`,
                `📉 SUM MIN decreased (Sum MIN < Old MIN) — ${fmt(decreased.length)} items`,
              )}
            </span>
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
                ...+{decreased.length - 120} {tr("รายการ", "items")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
