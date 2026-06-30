// Tests the weight-seeding rule: prefer the most recent reading on or before
// the day; otherwise the closest reading after it; otherwise 70.0 (new user).
// Mirrors pickSeedWeight in screens/TrackerScreen.tsx.

interface DayEntry {
  date: string;
  weight: string | number | null;
}

function pickSeedWeight(entries: Iterable<DayEntry>, forDate: string): string {
  let before: DayEntry | null = null;
  let after: DayEntry | null = null;
  for (const e of entries) {
    if (e.weight == null || e.weight === '') continue;
    if (e.date <= forDate) {
      if (!before || e.date > before.date) before = e;
    } else if (!after || e.date < after.date) {
      after = e;
    }
  }
  const pick = before ?? after;
  return pick ? String(pick.weight) : '70.0';
}

describe('pickSeedWeight', () => {
  it('defaults to 70.0 for a brand-new user with no readings', () => {
    expect(pickSeedWeight([], '2025-01-26')).toBe('70.0');
  });

  it('uses the previous day when only an earlier reading exists', () => {
    // Logged 25th, opening 26th -> show 25th
    const entries: DayEntry[] = [{ date: '2025-01-25', weight: '75.0' }];
    expect(pickSeedWeight(entries, '2025-01-26')).toBe('75.0');
  });

  it('prefers the most recent reading on or before the day', () => {
    // Have 25th and 27th, opening 26th -> show 25th (the one before)
    const entries: DayEntry[] = [
      { date: '2025-01-25', weight: '75.0' },
      { date: '2025-01-27', weight: '76.0' },
    ];
    expect(pickSeedWeight(entries, '2025-01-26')).toBe('75.0');
  });

  it('falls back to the closest reading after the day when none before', () => {
    // Only 27th exists, opening 26th -> show 27th
    const entries: DayEntry[] = [{ date: '2025-01-27', weight: '76.0' }];
    expect(pickSeedWeight(entries, '2025-01-26')).toBe('76.0');
  });

  it('picks the earliest future reading when several are after the day', () => {
    const entries: DayEntry[] = [
      { date: '2025-01-29', weight: '78.0' },
      { date: '2025-01-27', weight: '76.0' },
    ];
    expect(pickSeedWeight(entries, '2025-01-26')).toBe('76.0');
  });

  it('ignores entries with no weight when seeding', () => {
    const entries: DayEntry[] = [
      { date: '2025-01-25', weight: null },
      { date: '2025-01-20', weight: '74.0' },
    ];
    expect(pickSeedWeight(entries, '2025-01-26')).toBe('74.0');
  });

  it('uses the same day reading if present', () => {
    const entries: DayEntry[] = [{ date: '2025-01-26', weight: '75.5' }];
    expect(pickSeedWeight(entries, '2025-01-26')).toBe('75.5');
  });
});
