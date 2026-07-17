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

/** offset 0 = current month, -1 = last month, +1 = next month, etc. */
export function thaiMonthLabel(offsetFromNow: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetFromNow);
  return THAI_MONTHS[d.getMonth()];
}
