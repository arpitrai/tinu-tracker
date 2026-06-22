// Tests the weight input filter: digits + at most one decimal point

function filterWeight(text: string): string {
  let v = text.replace(/[^0-9.]/g, '');
  const dot = v.indexOf('.');
  if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
  return v;
}

describe('weight input filter', () => {
  it('allows plain integers', () => {
    expect(filterWeight('72')).toBe('72');
    expect(filterWeight('100')).toBe('100');
  });

  it('allows a single decimal point', () => {
    expect(filterWeight('72.5')).toBe('72.5');
    expect(filterWeight('72.45')).toBe('72.45');
  });

  it('strips letters', () => {
    expect(filterWeight('72kg')).toBe('72');
    expect(filterWeight('abc')).toBe('');
    expect(filterWeight('7a2')).toBe('72');
  });

  it('strips special characters', () => {
    expect(filterWeight('72,5')).toBe('725');
    expect(filterWeight('72-5')).toBe('725');
    expect(filterWeight('72 5')).toBe('725');
  });

  it('keeps only the first decimal point', () => {
    expect(filterWeight('7.2.5')).toBe('7.25');
    expect(filterWeight('7..2')).toBe('7.2');
    expect(filterWeight('...')).toBe('.');
  });

  it('handles empty input', () => {
    expect(filterWeight('')).toBe('');
  });

  it('preserves leading decimal', () => {
    expect(filterWeight('.5')).toBe('.5');
  });
});
