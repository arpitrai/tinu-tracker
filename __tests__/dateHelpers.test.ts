// Tests the local-time date math used for day navigation and trend windows.
// These mirror the helpers in screens/TrackerScreen.tsx (offsetDateStr) and
// components/TrendsChart.tsx (addDays / dayCount / mondayOfWeek). They are kept
// in sync by duplication, the same pattern as weightInput.test.ts.
//
// Reference: in 2026, Jun 26 = Fri, 27 = Sat, 28 = Sun, 29 = Mon, 30 = Tue.

function offsetDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function dayCount(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const a = new Date(ys, ms - 1, ds).getTime();
  const b = new Date(ye, me - 1, de).getTime();
  return Math.round((b - a) / 86_400_000) + 1;
}

function mondayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day));
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

describe('offsetDateStr', () => {
  it('moves forward and backward within a month', () => {
    expect(offsetDateStr('2026-06-15', 1)).toBe('2026-06-16');
    expect(offsetDateStr('2026-06-15', -1)).toBe('2026-06-14');
    expect(offsetDateStr('2026-06-15', 0)).toBe('2026-06-15');
  });

  it('crosses month and year boundaries', () => {
    expect(offsetDateStr('2026-01-01', -1)).toBe('2025-12-31');
    expect(offsetDateStr('2026-12-31', 1)).toBe('2027-01-01');
    expect(offsetDateStr('2026-06-30', 1)).toBe('2026-07-01');
  });

  it('handles non-leap and leap February', () => {
    // 2026 is not a leap year
    expect(offsetDateStr('2026-03-01', -1)).toBe('2026-02-28');
    // 2024 is a leap year
    expect(offsetDateStr('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('zero-pads single-digit months and days', () => {
    expect(offsetDateStr('2026-06-09', -1)).toBe('2026-06-08');
    expect(offsetDateStr('2026-09-30', 1)).toBe('2026-10-01');
  });
});

describe('addDays', () => {
  it('matches offsetDateStr for in-month and boundary moves', () => {
    expect(addDays('2026-06-15', 1)).toBe('2026-06-16');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('computes a 30-day preset start (inclusive of today)', () => {
    // Used as addDays(today, -(30 - 1)) for the "Last 30 days" window.
    expect(addDays('2026-06-30', -29)).toBe('2026-06-01');
  });
});

describe('dayCount', () => {
  it('is inclusive of both endpoints', () => {
    expect(dayCount('2026-06-15', '2026-06-15')).toBe(1);
    expect(dayCount('2026-06-01', '2026-06-30')).toBe(30);
    expect(dayCount('2026-01-01', '2026-01-31')).toBe(31);
  });

  it('counts across month and year boundaries', () => {
    expect(dayCount('2025-12-31', '2026-01-01')).toBe(2);
    expect(dayCount('2026-06-01', '2026-08-29')).toBe(90);
  });
});

describe('mondayOfWeek', () => {
  it('returns the same day for a Monday', () => {
    expect(mondayOfWeek('2026-06-29')).toBe('2026-06-29'); // Mon
  });

  it('snaps a midweek day back to its Monday', () => {
    expect(mondayOfWeek('2026-06-30')).toBe('2026-06-29'); // Tue -> Mon
    expect(mondayOfWeek('2026-06-26')).toBe('2026-06-22'); // Fri -> Mon
  });

  it('treats Sunday as the end of the week, not the start', () => {
    // The day === 0 branch: Sunday belongs to the week that started the prior Monday.
    expect(mondayOfWeek('2026-06-28')).toBe('2026-06-22'); // Sun -> previous Mon
  });

  it('crosses a month boundary when the Monday is in the prior month', () => {
    expect(mondayOfWeek('2026-07-01')).toBe('2026-06-29'); // Wed -> Mon (June)
  });
});
