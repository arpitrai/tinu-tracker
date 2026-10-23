import { weightDomain } from '../components/TrendsChart';
import { needsYear } from '../lib/dates';

describe('weightDomain', () => {
  it('pads by a share of the range so a real change is visible', () => {
    // 75-78 kg: 3 kg range, 1.2 kg each side would be under the 2 kg floor.
    expect(weightDomain([75, 78])).toEqual([73, 80]);
    // 70-80 kg: 10 kg range pads 4 kg each side.
    expect(weightDomain([70, 80])).toEqual([66, 84]);
  });

  it('keeps a 2 kg floor so a single reading is not a spike', () => {
    expect(weightDomain([72])).toEqual([70, 74]);
  });
});

describe('needsYear', () => {
  const today = '2026-10-23';
  it('leaves dates within the last year alone', () => {
    expect(needsYear('2026-10-22', today)).toBe(false);
    expect(needsYear('2025-10-24', today)).toBe(false);
  });

  it('flags dates a year or more back', () => {
    expect(needsYear('2025-10-23', today)).toBe(true);
    expect(needsYear('2024-01-01', today)).toBe(true);
  });
});
