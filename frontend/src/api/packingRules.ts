import { request } from "./client";

export interface PackingUnitRule {
  id: number;
  itemNoNormalized: string;
  multipleOf: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: { displayName: string };
}

export function listPackingRules(): Promise<PackingUnitRule[]> {
  return request<PackingUnitRule[]>("/admin/packing-rules");
}

export function createPackingRule(itemNo: string, multipleOf: number): Promise<PackingUnitRule> {
  return request<PackingUnitRule>("/admin/packing-rules", {
    method: "POST",
    body: JSON.stringify({ itemNo, multipleOf }),
  });
}

export function updatePackingRule(
  id: number,
  data: { multipleOf?: number; active?: boolean }
): Promise<PackingUnitRule> {
  return request<PackingUnitRule>(`/admin/packing-rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deactivatePackingRule(id: number): Promise<PackingUnitRule> {
  return request<PackingUnitRule>(`/admin/packing-rules/${id}`, { method: "DELETE" });
}

export function recalculatePackingRules(): Promise<{ changedCount: number }> {
  return request<{ changedCount: number }>("/admin/packing-rules/recalculate", { method: "POST" });
}
