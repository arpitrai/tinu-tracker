import { parseWeight } from '../components/TrendsChart';

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
