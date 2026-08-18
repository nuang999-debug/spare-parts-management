import { request } from "./client";

export type CalcStatus = "OK" | "WARN" | "DANGER";
export type CalcTrend = "UP" | "DOWN" | "FLAT";

export interface ItemUsageHistoryRow {
  monthIndex: number;
  periodLabel: string;
  qty: number;
}

export interface ItemListRow {
  id: number;
  itemNoRaw: string;
  itemNoNormalized: string;
  description: string | null;
  class: string | null;
  category: string | null;
  vendor: string | null;
  purchasePrice: number | null;
  remark: string | null;
  forModel: string | null;
  /** e.g. "ยกเลิกขายCA330" — set when the model this part belongs to has been discontinued from
   *  sale. Null when not applicable. */
  discontinuedModel: string | null;
  stockQty: number;
  poQty: number;
  backorderQty: number;
  leadTimeDays: number | null;
  avgMonth: number | null;
  oldMin: number | null;
  sumMin: number | null;
  next1: number | null;
  next2: number | null;
  next3: number | null;
  next4: number | null;
  next5: number | null;
  calcStatus: CalcStatus | null;
  calcTrend: CalcTrend | null;
  suggestedOrderQty: number | null;
  mustOrderByDate: string | null;
  prQtySuggested: number | null;
  prQtyCurrent: number | null;
  prIsOverride: boolean;
  lastImportedAt: string | null;
  /** True when this item wasn't refreshed by the most recent committed Items import — it has
   *  dropped out of the latest source file but keeps serving its old forecast/stock numbers. */
  isStale: boolean;
  /** Last 6 months only (monthIndex 6-11 / M-6..M-1, excludes the current/incomplete month), for the dense table's per-month columns. */
  usageHistory: ItemUsageHistoryRow[];
}

export interface ItemYearlySalesRow {
  year: number;
  qty: number;
}

export interface ItemDetail extends Omit<ItemListRow, "usageHistory"> {
  dimension: string | null;
  unitCost: number | null;
  minUsage: number | null;
  maxUsage: number | null;
  recommendedMin: number | null;
  /** Full 13 months (M-12..M-0). */
  usageHistory: ItemUsageHistoryRow[];
  yearlySales: ItemYearlySalesRow[];
  packingRule: { multipleOf: number; active: boolean } | null;
}

export interface ItemHistoryEntry {
  id: number;
  entityType: string;
  entityId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  action: string;
  changedAt: string;
  note: string | null;
  changedBy: { displayName: string; username: string };
  /** Only present on the cross-entity /audit/edit-history feed — a human-readable
   * "<item code> — <description>" / "<display name> (<username>)" in place of the raw
   * entityId, since that feed spans multiple item/user rows the reader can't otherwise place. */
  entityLabel?: string;
}

export function listItems(): Promise<ItemListRow[]> {
  return request<ItemListRow[]>("/items");
}

export function getItem(id: number): Promise<ItemDetail> {
  return request<ItemDetail>(`/items/${id}`);
}

export function updateItemPr(id: number, newPrQty: number): Promise<ItemDetail> {
  return request<ItemDetail>(`/items/${id}/pr`, {
    method: "PATCH",
    body: JSON.stringify({ newPrQty }),
  });
}

export function getItemHistory(id: number): Promise<ItemHistoryEntry[]> {
  return request<ItemHistoryEntry[]>(`/items/${id}/history`);
}

export function clearAllPr(): Promise<{ clearedCount: number }> {
  return request<{ clearedCount: number }>("/items/clear-all-pr", { method: "POST" });
}
