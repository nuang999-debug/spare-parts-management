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
  // Pin the day to 1 before shifting months — on the 29th-31st, setMonth() on a target month
  // with fewer days overflows into the month after it (e.g. Aug 31 minus 6 months lands on Mar 3,
  // not Feb, since Feb has no 31st), silently duplicating an adjacent month's label.
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetFromNow);
  return THAI_MONTHS[d.getMonth()];
}

/** "14 ต.ค." style short date, matching the original tool's must-order-by date format. */
export function thaiDateShort(date: Date): string {
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]}`;
}
