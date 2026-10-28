import { getLang } from "./i18n";

const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const months = () => (getLang() === "en" ? EN_MONTHS : THAI_MONTHS);

function monthIndex(offsetFromNow: number): number {
  const d = new Date();
  // Pin the day to 1 before shifting months — on the 29th-31st, setMonth() on a target month
  // with fewer days overflows into the month after it (e.g. Aug 31 minus 6 months lands on Mar 3,
  // not Feb, since Feb has no 31st), silently duplicating an adjacent month's label.
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetFromNow);
  return d.getMonth();
}

/** Short month name in the UI language. offset 0 = current month, -1 = last month, +1 = next. */
export function thaiMonthLabel(offsetFromNow: number): string {
  return months()[monthIndex(offsetFromNow)];
}

/** Always-Thai month name, for exported files whose format stays as it was. */
export function thaiMonthLabelTh(offsetFromNow: number): string {
  return THAI_MONTHS[monthIndex(offsetFromNow)];
}

/** "14 ต.ค." / "14 Oct" style short date, matching the original tool's must-order-by date format. */
export function thaiDateShort(date: Date): string {
  return `${date.getDate()} ${months()[date.getMonth()]}`;
}
