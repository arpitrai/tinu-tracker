import { validateWeight, MIN_WEIGHT, MAX_WEIGHT } from '../lib/weight';

describe('validateWeight', () => {
  it('treats an empty field as valid and optional', () => {
    expect(validateWeight('')).toEqual({ ok: true, value: null });
    expect(validateWeight('   ')).toEqual({ ok: true, value: null });
  });

  it('normalises valid input to one decimal', () => {
    expect(validateWeight('72').value).toBe('72.0');
    expect(validateWeight('72.5').value).toBe('72.5');
    expect(validateWeight('72.46').value).toBe('72.5');
    expect(validateWeight('072.5').value).toBe('72.5');
  });

  // These get past the on-screen character filter but break the Postgres cast,
  // which is what made saves fail silently.
  it('rejects partial decimals that the input filter lets through', () => {
    expect(validateWeight('.').ok).toBe(false);
    expect(validateWeight('72.').value).toBe('72.0'); // trailing dot is recoverable
  });

  it('rejects only nonsensical values', () => {
    expect(validateWeight('0').ok).toBe(false);
    expect(validateWeight(String(MAX_WEIGHT + 1)).ok).toBe(false);
  });

  // A tight range would block editing a day whose weight was saved earlier.
  it('accepts unusual but real weights', () => {
    for (const w of ['3.2', '12', '45', '150', '210']) {
      expect(validateWeight(w).ok).toBe(true);
    }
  });

  it('accepts the range boundaries', () => {
    expect(validateWeight(String(MIN_WEIGHT)).ok).toBe(true);
    expect(validateWeight(String(MAX_WEIGHT)).ok).toBe(true);
  });

  it('returns a message explaining every rejection', () => {
    for (const bad of ['.', '0', '1001', '99999']) {
      const r = validateWeight(bad);
      expect(r.ok).toBe(false);
      expect(typeof r.message).toBe('string');
      expect(r.message!.length).toBeGreaterThan(0);
    }
  });
});
