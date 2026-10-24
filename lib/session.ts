import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// The session supabase-js persisted, read straight from storage. It is the same
// AsyncStorage entry the client itself uses (its storageKey is protected in the
// types, hence the cast), so nothing about where sessions live changes.
export async function readStoredSession(): Promise<Session | null> {
  const key: string = (supabase.auth as any).storageKey;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.user && parsed?.refresh_token ? (parsed as Session) : null;
  } catch {
    return null;
  }
}

/**
 * The session to start the app with.
 *
 * Opened offline with an access token past its 1-hour life, getSession() can't
 * renew it and reports no session, even though the library keeps the session
 * stored precisely because the failure was a network one. Treating that as
 * signed out dropped people on the sign-in screen with no way through until they
 * were back online. Instead, carry on with the stored session: the tracker then
 * shows its "couldn't load" state, and the next request made online renews the
 * token and emits a fresh session.
 */
export async function launchSession(waitMs = LAUNCH_WAIT_MS): Promise<Session | null> {
  const result = supabase.auth.getSession().then(async ({ data: { session }, error }) => {
    if (session) return session;
    if (error && isAuthRetryableFetchError(error)) return readStoredSession();
    return null;
  });
  // Offline, the library retries the renewal for about 25 seconds before giving
  // up, all of it on the loading screen. Past a short wait, start with the stored
  // session instead; the renewal carries on in the background either way.
  const timedOut = Symbol('timedOut');
  const first = await Promise.race([
    result,
    new Promise<typeof timedOut>((r) => setTimeout(() => r(timedOut), waitMs)),
  ]);
  if (first !== timedOut) return first;
  return (await readStoredSession()) ?? result;
}

// A valid token resolves instantly; only a renewal can take this long.
const LAUNCH_WAIT_MS = 4000;
