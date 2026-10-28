import { tr } from "./i18n";

/** Provision Status arrives as "Obsolete_<months>" (the only values the backend keeps). */
export function provisionMonths(status: string | null | undefined): number | null {
  const m = status?.match(/^Obsolete_(\d+)$/);
  return m ? Number(m[1]) : null;
}

export type ProvisionTone = "low" | "mid" | "high";

/** Older provision = more severe: 12 months amber, 18 orange, 24 red. */
export function provisionTone(months: number): ProvisionTone {
  return months <= 12 ? "low" : months <= 18 ? "mid" : "high";
}

export const provisionShortLabel = (months: number) => tr(`${months} เดือน`, `${months} months`);
export const provisionLongLabel = (months: number) =>
  tr(`ติด Provision ${months} เดือน`, `Under provision ${months} months`);

export interface ReplacementNote {
  head: string;
  code: string;
  tail: string;
}

/**
 * "REP BY 106404760", "Replacement By 107144410", "replace by …", "Rep.90-0499-0000", "REPLACEMENT TO
 * VF75279". The successor must contain a digit, so "no replacement" / "(replace)" never match, and
 * the keyword must end at a word boundary so "REPAIR KIT 1234" doesn't.
 */
const REPLACEMENT_RE =
  /(\bREP(?:LACE(?:MENT|D)?)?\b\.?\s*(?:(?:BY|TO)\b)?\s*[:-]?\s*)((?=[A-Za-z0-9 -]*\d)[A-Za-z0-9][A-Za-z0-9 -]*)/i;

/** Splits a Description 2 note around the successor part number. */
export function splitReplacement(description2: string | null | undefined): ReplacementNote | null {
  if (!description2) return null;
  const m = description2.match(REPLACEMENT_RE);
  if (!m || m.index === undefined) return null;
  const code = m[2].trim();
  if (!code) return null;
  const end = m.index + m[0].length;
  return { head: description2.slice(0, m.index) + m[1], code, tail: description2.slice(end) };
}
