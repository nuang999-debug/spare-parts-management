import { request } from "./client";

export type CalcStatus = "OK" | "WARN" | "DANGER";
export type CalcTrend = "UP" | "DOWN" | "FLAT";

export interface ItemListRow {
  id: number;
  itemNoRaw: string;
  itemNoNormalized: string;
  description: string | null;
  class: string | null;
  category: string | null;
  vendor: string | null;
  stockQty: number;
  poQty: number;
  backorderQty: number;
  leadTimeDays: number | null;
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
}

export interface ItemUsageHistoryRow {
  monthIndex: number;
  periodLabel: string;
  qty: number;
}

export interface ItemYearlySalesRow {
  year: number;
  qty: number;
}

export interface ItemDetail extends ItemListRow {
  dimension: string | null;
  purchasePrice: number | null;
  unitCost: number | null;
  avgMonth: number | null;
  minUsage: number | null;
  maxUsage: number | null;
  oldMin: number | null;
  recommendedMin: number | null;
  remark: string | null;
  forModel: string | null;
  usageHistory: ItemUsageHistoryRow[];
  yearlySales: ItemYearlySalesRow[];
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
