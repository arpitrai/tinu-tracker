// Deliberately wide. This is a typo guard, not a plausibility judgement — a
// tighter range would reject a previously saved value and block the user from
// editing that day at all, which is worse than accepting an odd number.
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 1000;

export interface WeightValidation {
  ok: boolean;
  /** Normalised to one decimal, or null when the field is left empty. */
  value: string | null;
  message?: string;
}

/**
 * Validates what the user typed into the weight field and normalises it to the
 * one-decimal form the stepper produces.
 *
 * The on-screen input filter permits partial values while typing — "." and
 * "72." both pass it — which Postgres rejects on cast. Saving used to send
 * those straight through and swallow the resulting error, so the check happens
 * here instead of assuming the field is well-formed at save time.
 *
 * An empty field is valid: weight is optional, like exercise and sugar.
 */
export function validateWeight(raw: string): WeightValidation {
  const t = raw.trim();
  if (t === '') return { ok: true, value: null };

  const n = parseFloat(t);
  if (!/^\d*\.?\d*$/.test(t) || !Number.isFinite(n)) {
    return { ok: false, value: null, message: 'Enter a weight like 68.5' };
  }
  if (n < MIN_WEIGHT || n > MAX_WEIGHT) {
    return {
      ok: false,
      value: null,
      message: `Weight must be between ${MIN_WEIGHT} and ${MAX_WEIGHT} kg`,
    };
  }
  return { ok: true, value: n.toFixed(1) };
}
