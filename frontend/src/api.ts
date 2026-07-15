import type { DocumentLine, Item, ScanSubmission, StockCountLine } from './types';

// Backend runs on the same PC, port 4000. Deriving the host from the current
// page (rather than hardcoding localhost) means it also works when a phone
// opens this app via the PC's warehouse-WiFi IP address.
const API_BASE = `${window.location.protocol}//${window.location.hostname}:4000/api`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  lookupItem: (barcode: string) => request<Item>(`/item/${encodeURIComponent(barcode)}`),

  getReceivingLines: (poNo: string) => request<DocumentLine[]>(`/receiving/${encodeURIComponent(poNo)}`),
  postReceiving: (poNo: string, lines: ScanSubmission[]) =>
    request<{ ok: true }>(`/receiving/${encodeURIComponent(poNo)}`, {
      method: 'POST',
      body: JSON.stringify({ lines }),
    }),

  getPickingLines: (soNo: string) => request<DocumentLine[]>(`/picking/${encodeURIComponent(soNo)}`),
  postPicking: (soNo: string, lines: ScanSubmission[]) =>
    request<{ ok: true }>(`/picking/${encodeURIComponent(soNo)}`, {
      method: 'POST',
      body: JSON.stringify({ lines }),
    }),

  getStockCount: (location: string) => request<StockCountLine[]>(`/stockcount/${encodeURIComponent(location)}`),
  postStockCount: (location: string, lines: ScanSubmission[]) =>
    request<{ ok: true }>(`/stockcount/${encodeURIComponent(location)}`, {
      method: 'POST',
      body: JSON.stringify({ lines }),
    }),
};
