// Central place for all notification logic: permissions, the on-device daily
// reminder (local, no server), and remote Expo push-token registration.
//
// Notifications need a development/production build — they do NOT work in Expo
// Go (SDK 53+ removed remote push there), and remote push needs a PHYSICAL
// device (simulators/emulators can't receive it). Local reminders do work on a
// simulator, so the reminder toggle is testable without a device.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Each scheduled reminder gets an id of the form
// `tinu-daily-reminder-YYYY-MM-DD-HH:MM`, so we can find and clear the whole set
// (any number of times) without touching unrelated notifications.
const REMINDER_PREFIX = 'tinu-daily-reminder-';
const CHANNEL_ID = 'reminders';

// How many days ahead we pre-schedule one-shot reminders. Reminders are dated
// (not a repeating trigger) so we can skip days the user has already logged;
// the trade-off is they must be re-laid periodically. We re-sync on every app
// launch / foreground and after every save, so the horizon only matters if the
// app is left unopened — 14 days of nudges before it goes quiet is plenty.
const HORIZON_DAYS = 14;

// iOS silently drops pending notifications beyond 64. Stay well under that even
// if the user adds several custom times.
const MAX_SCHEDULED = 60;

// --- Reminder-time storage (single source of truth) -----------------------
// New multi-time storage; the legacy single-time keys are migrated on first read.
export const REMINDER_TIMES_KEY = '@tinu/reminderTimes';
const LEGACY_ON_KEY = '@tinu/reminderEnabled';
const LEGACY_TIME_KEY = '@tinu/reminderTime';

// Reminders default to ON at 10pm for a brand-new install (see loadReminderTimes).
export const DEFAULT_REMINDER_TIME = '22:00';

// Snapshot of which upcoming days are already logged, written by the tracker so
// the scheduler can skip them without importing app state. Only days from today
// forward matter (past days are never scheduled, future days can't be pre-logged).
const LOGGED_DATES_KEY = '@tinu/loggedDates';

// Foreground behaviour: show the banner even while the app is open. The newer
// keys (shouldShowBanner/shouldShowList) replace the deprecated shouldShowAlert;
// we set all of them so the handler is correct across SDK minor versions.
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowAlert: true,
    }),
  });
}

// Android requires an explicit channel or notifications are silently dropped.
async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#7C3AED',
  });
}

// Ask for permission if not already decided. Returns true if we may post.
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// --- Local daily reminders (one or more times) ----------------------------

// Cancel every reminder we scheduled, leaving any other notifications intact.
export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Load the saved reminder times ("HH:MM", 24h). On a brand-new install (no new
// key and no legacy keys) we default to 10pm ON and persist it, so the default
// is sticky. Users who previously turned reminders off (empty array or legacy
// keys) keep their choice — we never silently re-enable them.
export async function loadReminderTimes(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(REMINDER_TIMES_KEY);
  if (raw != null) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  const legacyOn = await AsyncStorage.getItem(LEGACY_ON_KEY);
  const legacyTime = await AsyncStorage.getItem(LEGACY_TIME_KEY);
  const hasLegacy = legacyOn != null || legacyTime != null;
  const initial = hasLegacy
    ? (legacyOn === '1' && legacyTime ? [legacyTime] : [])
    : [DEFAULT_REMINDER_TIME];
  await AsyncStorage.setItem(REMINDER_TIMES_KEY, JSON.stringify(initial));
  return initial;
}

// Persist the reminder times (deduped + sorted). Does not schedule — call
// syncDailyReminders() afterwards.
export async function saveReminderTimes(times: string[]): Promise<string[]> {
  const sorted = Array.from(new Set(times)).sort();
  await AsyncStorage.setItem(REMINDER_TIMES_KEY, JSON.stringify(sorted));
  return sorted;
}

// Record which upcoming days (today forward, "YYYY-MM-DD") already have an entry,
// so scheduled reminders can skip them. Call this from the tracker whenever the
// logged set changes, then re-run syncDailyReminders().
export async function setLoggedDates(dates: string[]): Promise<void> {
  await AsyncStorage.setItem(LOGGED_DATES_KEY, JSON.stringify(dates));
}

async function getLoggedDates(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(LOGGED_DATES_KEY);
  if (raw == null) return new Set();
  try {
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Local YYYY-MM-DD for `base` shifted by `days` — mirrors the tracker's
// local-time date convention (never parse/format via UTC).
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Re-lay the whole reminder set from the saved times + logged-days snapshot.
//
// For each time we schedule a one-shot notification on each of the next
// HORIZON_DAYS days, skipping (a) times already past and (b) days the user has
// already logged. Because it's re-run on launch / foreground / after every save,
// a day's reminder disappears the moment that day is logged, and today's is
// never posted if today is already done. Returns false only if permission was
// needed and denied ([] just clears everything and returns true).
export async function syncDailyReminders(): Promise<boolean> {
  const times = await loadReminderTimes();
  await ensureAndroidChannel();
  if (times.length > 0) {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  }
  await cancelAllReminders();
  if (times.length === 0) return true;

  const logged = await getLoggedDates();
  const now = new Date();
  let scheduled = 0;

  // Day-major so that, if we hit MAX_SCHEDULED, we've covered the soonest days
  // across all times rather than exhausting the horizon of a single time.
  for (let offset = 0; offset < HORIZON_DAYS && scheduled < MAX_SCHEDULED; offset++) {
    for (const t of times) {
      if (scheduled >= MAX_SCHEDULED) break;
      const [hour, minute] = t.split(':').map(Number);
      const fire = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
      if (fire.getTime() <= now.getTime()) continue; // already passed
      const dateStr = localDateKey(fire);
      if (logged.has(dateStr)) continue; // already logged that day
      await Notifications.scheduleNotificationAsync({
        identifier: `${REMINDER_PREFIX}${dateStr}-${t}`,
        content: {
          title: "You haven't logged today",
          body: "You haven't tracked your exercise, sugar or weight yet today. Tap to log it.",
          ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
      });
      scheduled++;
    }
  }
  return true;
}

// --- Remote push (Expo push token) ---------------------------------------

// Register this device for remote push and persist the token in Supabase so a
// server (Edge Function) can target the signed-in user. Safe to call on every
// launch — the upsert de-dupes on the token. Returns the token or null.
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // remote push needs a real device
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) return null;

  let token: string;
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    token = res.data;
  } catch {
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return token; // signed out — nothing to persist yet

  // onConflict on the token column: one row per device, re-owned if the user changes.
  await supabase
    .from('push_tokens')
    .upsert(
      { token, user_id: user.id, platform: Platform.OS },
      { onConflict: 'token' }
    );

  return token;
}
