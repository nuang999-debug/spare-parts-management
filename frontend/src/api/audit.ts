import { request } from "./client";
import type { ItemHistoryEntry } from "./items";

export interface LoginHistoryEntry {
  id: number;
  usernameAttempted: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { displayName: string; username: string } | null;
}

export function listLoginHistory(): Promise<LoginHistoryEntry[]> {
  return request<LoginHistoryEntry[]>("/audit/login-history");
}

export function listEditHistory(): Promise<ItemHistoryEntry[]> {
  return request<ItemHistoryEntry[]>("/audit/edit-history");
}
