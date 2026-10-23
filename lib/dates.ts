// Date strings are always local-time `YYYY-MM-DD`; this never parses with
// `new Date(dateStr)`, which would read them as UTC.

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * True when `dateStr` is more than 12 months before `today`. Dates are shown
 * without a year to keep them short, which is fine until the user pages back
 * far enough that "Thu, 25 Jun" could be this June or last June.
 */
export function needsYear(dateStr: string, today: string = localToday()): boolean {
  const [y, m, d] = today.split('-');
  return dateStr <= `${Number(y) - 1}-${m}-${d}`;
}
