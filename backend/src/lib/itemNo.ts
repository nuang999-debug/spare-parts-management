export function normalizeItemNo(raw: string | number): string {
  return String(raw).trim().replace(/\s+/g, "");
}
