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

export interface HistoryPage<T> {
  rows: T[];
  /** True when the server-side row cap (500) actually cut off older entries. */
  truncated: boolean;
}

export function listLoginHistory(): Promise<HistoryPage<LoginHistoryEntry>> {
  return request<HistoryPage<LoginHistoryEntry>>("/audit/login-history");
}

export function listEditHistory(): Promise<HistoryPage<ItemHistoryEntry>> {
  return request<HistoryPage<ItemHistoryEntry>>("/audit/edit-history");
}
