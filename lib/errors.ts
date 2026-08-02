/**
 * Turns a Supabase/Postgrest failure into something a person can act on.
 *
 * Raw driver text ("duplicate key value violates unique constraint ...") must
 * never reach the UI — it means nothing to the user and looks broken. Anything
 * unrecognised falls back to a plain retry message.
 */

export interface WriteError {
  message?: string;
  code?: string;
  details?: string;
}

export type WriteAction = 'save' | 'reset';

const OFFLINE = /failed to fetch|network request failed|networkerror|load failed|fetch failed/i;
const AUTH = /jwt|token|not authenticated|unauthorized/i;

export function friendlyWriteError(error: WriteError | null | undefined, action: WriteAction): string {
  const noun = action === 'save' ? "Couldn't save your entry." : "Couldn't reset this day.";
  const message = error?.message ?? '';
  const code = error?.code ?? '';

  // No connection — by far the most common real-world failure.
  if (OFFLINE.test(message) || code === 'ECONNABORTED') {
    return `${noun} You appear to be offline — check your connection and try again.`;
  }

  // Session died out from under us.
  if (code === 'PGRST301' || code === '401' || AUTH.test(message)) {
    return 'Your session has expired. Sign out and sign in again, then try once more.';
  }

  switch (code) {
    // Row-level security refused the write.
    case '42501':
      return `${noun} You don't have permission to change this day.`;
    // Bad number / out of range — in this app that can only be the weight.
    case '22P02':
    case '22003':
      return 'That weight doesn\'t look right. Enter a number like 68.5.';
    // A required column came through empty. Retrying never helps, so say what
    // the user can actually do instead.
    case '23502':
      return `${noun} This day can't be saved with a field left blank — try filling in all three.`;
    // Server is unhappy in a way we can't explain usefully.
    case '500':
    case '503':
      return `${noun} The server is having trouble — please try again in a moment.`;
    default:
      return `${noun} Please try again.`;
  }
}
