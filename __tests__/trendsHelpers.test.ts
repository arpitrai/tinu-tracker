import { parseWeight, dotColorForPoint, niceScale } from '../components/TrendsChart';

describe('parseWeight', () => {
  it('parses numeric strings', () => {
    expect(parseWeight('72.5')).toBe(72.5);
    expect(parseWeight('100')).toBe(100);
  });

  it('parses numbers directly', () => {
    expect(parseWeight(72.5)).toBe(72.5);
    expect(parseWeight(0)).toBe(0);
  });

  it('returns null for empty/null/undefined', () => {
    expect(parseWeight(null)).toBeNull();
    expect(parseWeight(undefined)).toBeNull();
    expect(parseWeight('')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(parseWeight('abc')).toBeNull();
    expect(parseWeight('kg')).toBeNull();
  });
});

describe('dotColorForPoint', () => {
  it('returns green when exercised and no sweets', () => {
    expect(dotColorForPoint(1, 0)).toBe('#00C896');
  });

  it('returns red when no exercise and ate sweets', () => {
    expect(dotColorForPoint(0, 1)).toBe('#FF4D4D');
  });

  it('returns amber for mixed habits', () => {
    // exercised but had sweets → score = 1 + (1-1) = 1.0, which is >= 0.6 → amber
    expect(dotColorForPoint(1, 1)).toBe('#F59E0B');
    // no exercise, no sweets → score = 0 + (1-0) = 1.0 → amber
    expect(dotColorForPoint(0, 0)).toBe('#F59E0B');
  });

  it('returns grey when both habit values are null', () => {
    expect(dotColorForPoint(null, null)).toBe('#C0C4D0');
  });

  it('treats null exercise as neutral (0.5) when sweets is known', () => {
    // null ex → 0.5, sweets=0 → score = 0.5 + 1 = 1.5 → green
    expect(dotColorForPoint(null, 0)).toBe('#00C896');
    // null ex → 0.5, sweets=1 → score = 0.5 + 0 = 0.5 → red
    expect(dotColorForPoint(null, 1)).toBe('#FF4D4D');
  });
});

describe('niceScale', () => {
  it('produces a range that covers the input', () => {
    const { niceMin, niceMax } = niceScale(71.2, 74.8);
    expect(niceMin).toBeLessThanOrEqual(71.2);
    expect(niceMax).toBeGreaterThanOrEqual(74.8);
  });

  it('returns at least 1 section', () => {
    const { sections } = niceScale(72, 72);
    expect(sections).toBeGreaterThanOrEqual(1);
  });

  it('returns round step values', () => {
    const { niceMin, niceMax, sections } = niceScale(70, 80);
    const step = (niceMax - niceMin) / sections;
    // step should divide evenly into the range
    expect(Math.round(step * 100) / 100).toBe(step);
  });

  it('handles equal min/max without throwing', () => {
    const result = niceScale(75, 75);
    expect(result.sections).toBeGreaterThanOrEqual(1);
    expect(typeof result.niceMin).toBe('number');
    expect(typeof result.niceMax).toBe('number');
  });
});
