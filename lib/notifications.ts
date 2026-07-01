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
import { supabase } from './supabase';

// Each scheduled reminder gets an id of the form `tinu-daily-reminder-HH:MM`,
// so we can find and clear the whole set (any number of times) without touching
// unrelated notifications.
const REMINDER_PREFIX = 'tinu-daily-reminder-';
const CHANNEL_ID = 'reminders';

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

// Replace the whole reminder set with one repeating daily notification per time.
// `times` is an array of "HH:MM" (24h) strings. Returns false if permission is
// denied; passing [] just clears all reminders and returns true.
export async function scheduleDailyReminders(times: string[]): Promise<boolean> {
  if (times.length > 0) {
    const granted = await requestNotificationPermission();
    if (!granted) return false;
  }
  await cancelAllReminders();
  for (const t of times) {
    const [hour, minute] = t.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      identifier: `${REMINDER_PREFIX}${t}`,
      content: {
        title: 'Log your day',
        body: 'Take a few seconds to track your exercise, sugar and weight.',
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
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
