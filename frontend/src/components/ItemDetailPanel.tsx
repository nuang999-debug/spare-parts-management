import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getItem, getItemHistory } from "../api/items";
import { StatusBadge, TrendIndicator } from "./StatusBadge";

const CHART_MUTED = "#94a3b8";
const CHART_GRID = "#263044";
const CHART_ACCENT = "#00d4aa";
const CHART_ACCENT2 = "#4f9eff";
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

      {item && (
        <div className="detail-panel-body">
          <p className="detail-description">{item.description}</p>
          <div className="detail-badges">
            <StatusBadge status={item.calcStatus} />
            <TrendIndicator trend={item.calcTrend} />
          </div>

          <div className="detail-kpis">
            <div className="kpi">
              <span className="kpi-label">Stock</span>
              <span className="kpi-value">{item.stockQty}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">On order</span>
              <span className="kpi-value">{item.poQty}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Sum MIN</span>
              <span className="kpi-value">{item.sumMin ?? "-"}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Avg/month</span>
              <span className="kpi-value">{item.avgMonth?.toFixed(1) ?? "-"}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Lead time</span>
              <span className="kpi-value">{item.leadTimeDays ?? "-"} d</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Recommended MIN</span>
              <span className="kpi-value">{item.recommendedMin ?? "-"}</span>
            </div>
          </div>

          <section>
            <h3>13-month usage history</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={item.usageHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="periodLabel" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="qty" fill={CHART_ACCENT2} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section>
            <h3>Forecast (Next 1-5) vs Sum MIN</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart
                data={[1, 2, 3, 4, 5].map((m) => ({
                  month: `Next-${m}`,
                  value: item[`next${m}` as "next1" | "next2" | "next3" | "next4" | "next5"],
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="month" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: CHART_MUTED }} />
                <Line type="monotone" dataKey="value" name="Forecasted stock" stroke={CHART_ACCENT} />
                {item.sumMin != null && (
                  <ReferenceLine y={item.sumMin} stroke={CHART_DANGER} strokeDasharray="4 4" label="Sum MIN" />
                )}
              </LineChart>
            </ResponsiveContainer>
          </section>

          <section>
            <h3>Yearly sales</h3>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={item.yearlySales}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                <XAxis dataKey="year" tick={AXIS_TICK} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="qty" fill={CHART_ACCENT3} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section className="detail-fields">
            <h3>All fields</h3>
            <dl>
              <dt>Class</dt>
              <dd>{item.class ?? "-"}</dd>
              <dt>Category</dt>
              <dd>{item.category ?? "-"}</dd>
              <dt>Dimension</dt>
              <dd>{item.dimension ?? "-"}</dd>
              <dt>Vendor</dt>
              <dd>{item.vendor ?? "-"}</dd>
              <dt>Purchase price</dt>
              <dd>{item.purchasePrice ?? "-"}</dd>
              <dt>Unit cost</dt>
              <dd>{item.unitCost ?? "-"}</dd>
              <dt>Backorder qty</dt>
              <dd>{item.backorderQty}</dd>
              <dt>Old MIN</dt>
              <dd>{item.oldMin ?? "-"}</dd>
              <dt>Suggested order qty</dt>
              <dd>{item.suggestedOrderQty ?? "-"}</dd>
              <dt>Must order by</dt>
              <dd>{item.mustOrderByDate ? new Date(item.mustOrderByDate).toLocaleDateString() : "-"}</dd>
              <dt>PR (suggested)</dt>
              <dd>{item.prQtySuggested ?? "-"}</dd>
              <dt>PR (current)</dt>
              <dd>{item.prQtyCurrent ?? "-"}</dd>
              <dt>For model</dt>
              <dd>{item.forModel ?? "-"}</dd>
              <dt>Remark</dt>
              <dd>{item.remark ?? "-"}</dd>
            </dl>
          </section>

          <section>
            <h3>Recent edits</h3>
            {history && history.length === 0 && <p>No edits recorded yet.</p>}
            {history && history.length > 0 && (
              <ul className="history-list">
                {history.slice(0, 10).map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.changedBy.displayName}</strong> changed {entry.fieldName} from{" "}
                    {entry.oldValue ?? "-"} to {entry.newValue ?? "-"} —{" "}
                    {new Date(entry.changedAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}
