import { AlertOctagon, AlertTriangle, Coins, FileText, Layers, type LucideIcon } from "lucide-react";
import type { ItemListRow } from "../api/items";

export type KpiFilter = "DANGER" | "WARN" | "PR" | null;

function Card({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  active,
  onClick,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  tone: "accent" | "danger" | "warning" | "accent2";
  active?: boolean;
  onClick?: () => void;
  hint?: string;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": !!active } : {})}
      className={`kc kc-${tone}${onClick ? " kc-click" : ""}${active ? " on" : ""}`}
      title={hint}
    >
      <div className="klbl">
        <span className="kicon" aria-hidden>
          <Icon size={14} strokeWidth={2} />
        </span>
        {label}
      </div>
      <div className="kval">{value}</div>
      {sub && <div className="ksub">{sub}</div>}
    </Tag>
  );
}

/** Mirrors the original app's renderKPI() — always computed over the full unfiltered dataset.
 *  The status/PR cards double as one-click filters for the table below. */
export default function KpiBar({
  items,
  active,
  onSelect,
}: {
  items: ItemListRow[];
  active?: KpiFilter;
  onSelect?: (f: KpiFilter) => void;
}) {
  const total = items.length;
  const withMin = items.filter((d) => (d.sumMin ?? 0) > 0).length;
  const danger = items.filter((d) => d.calcStatus === "DANGER").length;
  const warn = items.filter((d) => d.calcStatus === "WARN").length;
  const withPr = items.filter((d) => (d.prQtyCurrent ?? 0) > 0).length;
  const prValue = items.reduce((s, d) => s + (d.prQtyCurrent ?? 0) * (d.purchasePrice ?? 0), 0);
  const toggle = (f: KpiFilter) => onSelect?.(active === f ? null : f);

  return (
    <div className="kpi-bar">
      <Card icon={Layers} tone="accent" label="รายการทั้งหมด" value={total.toLocaleString()} sub={`${withMin.toLocaleString()} รายการมี Sum MIN`} />
      <Card
        icon={AlertOctagon}
        tone="danger"
        label="Next-0 < Sum MIN"
        value={danger.toLocaleString()}
        sub="วิกฤต · ต้องสั่งทันที"
        active={active === "DANGER"}
        onClick={onSelect ? () => toggle("DANGER") : undefined}
        hint="คลิกเพื่อกรองเฉพาะรายการวิกฤต"
      />
      <Card
        icon={AlertTriangle}
        tone="warning"
        label="Next-1 < Sum MIN"
        value={warn.toLocaleString()}
        sub="ระวัง · วางแผนสั่ง"
        active={active === "WARN"}
        onClick={onSelect ? () => toggle("WARN") : undefined}
        hint="คลิกเพื่อกรองเฉพาะรายการระวัง"
      />
      <Card
        icon={FileText}
        tone="accent2"
        label="มี PR qty"
        value={withPr.toLocaleString()}
        sub="รายการที่ใส่ PR แล้ว"
        active={active === "PR"}
        onClick={onSelect ? () => toggle("PR") : undefined}
        hint="คลิกเพื่อกรองเฉพาะรายการที่มี PR"
      />
      <Card icon={Coins} tone="warning" label="มูลค่า PR รวม" value={`฿${(prValue / 1e6).toFixed(2)}M`} sub="ตามราคาซื้อ" />
    </div>
  );
}
