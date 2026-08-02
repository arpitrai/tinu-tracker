import { friendlyWriteError } from '../lib/errors';

describe('friendlyWriteError', () => {
  it('never leaks raw driver text', () => {
    const raw = 'duplicate key value violates unique constraint "entries_pkey"';
    const msg = friendlyWriteError({ message: raw, code: '23505' }, 'save');
    expect(msg).not.toContain('constraint');
    expect(msg).not.toContain('duplicate key');
  });

  it('explains an offline failure', () => {
    for (const m of ['Failed to fetch', 'Network request failed', 'Load failed']) {
      expect(friendlyWriteError({ message: m }, 'save')).toMatch(/offline/i);
    }
  });

  it('explains an expired session', () => {
    expect(friendlyWriteError({ code: 'PGRST301' }, 'save')).toMatch(/session/i);
    expect(friendlyWriteError({ message: 'JWT expired' }, 'save')).toMatch(/session/i);
  });

  it('explains a permission failure', () => {
    expect(friendlyWriteError({ code: '42501' }, 'save')).toMatch(/permission/i);
  });

  it('points at the weight for a bad-number failure', () => {
    expect(friendlyWriteError({ code: '22P02' }, 'save')).toMatch(/weight/i);
    expect(friendlyWriteError({ code: '22003' }, 'save')).toMatch(/weight/i);
  });

  it('distinguishes save from reset in the fallback', () => {
    expect(friendlyWriteError({ code: 'weird' }, 'save')).toMatch(/save/i);
    expect(friendlyWriteError({ code: 'weird' }, 'reset')).toMatch(/reset/i);
  });

  it('handles a null error without throwing', () => {
    expect(typeof friendlyWriteError(null, 'save')).toBe('string');
    expect(friendlyWriteError(undefined, 'save').length).toBeGreaterThan(0);
  });

  it('always ends up as a readable sentence', () => {
    const cases = [null, {}, { code: '42501' }, { message: 'Failed to fetch' }];
    for (const c of cases) {
      const msg = friendlyWriteError(c as any, 'save');
      expect(msg[0]).toBe(msg[0].toUpperCase());
      expect(msg.endsWith('.')).toBe(true);
    }
  });
});
