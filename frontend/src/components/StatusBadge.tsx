import type { CalcStatus, CalcTrend } from "../api/items";
import { tr } from "../lib/i18n";

const STATUS_LABEL: Record<CalcStatus, [string, string]> = {
  OK: ["ปกติ", "OK"],
  WARN: ["ระวัง", "Warning"],
  DANGER: ["วิกฤต", "Critical"],
};
const STATUS_CLASS: Record<CalcStatus, string> = {
  OK: "badge badge-ok",
  WARN: "badge badge-warn",
  DANGER: "badge badge-danger",
};

export function StatusBadge({ status }: { status: CalcStatus | null }) {
  if (!status) return <span className="badge badge-muted">-</span>;
  return <span className={STATUS_CLASS[status]}>{tr(...STATUS_LABEL[status])}</span>;
}

const TREND_ARROW: Record<CalcTrend, string> = { UP: "▲", DOWN: "▼", FLAT: "▬" };
const TREND_CLASS: Record<CalcTrend, string> = {
  UP: "trend trend-up",
  DOWN: "trend trend-down",
  FLAT: "trend trend-flat",
};

export function TrendIndicator({ trend }: { trend: CalcTrend | null }) {
  if (!trend) return <span className="trend trend-muted">-</span>;
  return <span className={TREND_CLASS[trend]}>{TREND_ARROW[trend]}</span>;
}
