import type { ScanLine, Workflow } from './types';

// VITE_API_BASE_URL is baked in at build time (e.g. the Render backend's URL).
// Falls back to same-host port 4000 for local dev, where both run on one PC.
const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : `${window.location.protocol}//${window.location.hostname}:4000/api`;

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
  submitScan: (workflow: Workflow, reference: string, lines: ScanLine[]) =>
    request<{ ok: true; count: number }>('/scans', {
      method: 'POST',
      body: JSON.stringify({ workflow, reference: reference || undefined, lines }),
    }),

  exportUrl: (workflow?: Workflow, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (workflow) params.set('workflow', workflow);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return `${API_BASE}/export${query ? `?${query}` : ''}`;
  },
};
