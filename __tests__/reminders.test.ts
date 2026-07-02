// Tests the conditional daily-reminder scheduler in lib/notifications.ts.
//
// Reminders are one-shot DATE notifications re-laid on every launch / save, so
// the scheduler must: default to 10pm on a fresh install, skip days already
// logged, skip times already past, cover a 14-day horizon, and stay under the
// iOS 64-pending cap. We pin "now" with fake timers and capture every
// scheduleNotificationAsync call to assert on what would fire.
//
// Reference: 2026-07-02 is the pinned "today" in these tests.
//
// NB: jest hoists jest.mock() above imports and only lets the factory reference
// variables prefixed with `mock`, hence the naming below.

// notifications.ts imports the supabase client and native Expo modules at load
// time; none are exercised by the scheduling paths, so stub them out.
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-constants', () => ({ default: { expoConfig: {} } }));

let mockScheduled: { identifier: string; trigger: any }[] = [];
let mockPermission = 'granted';
const mockCancel = jest.fn(async () => {});

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => {}),
  getPermissionsAsync: jest.fn(async () => ({ status: mockPermission })),
  requestPermissionsAsync: jest.fn(async () => ({ status: mockPermission })),
  getAllScheduledNotificationsAsync: jest.fn(async () =>
    mockScheduled.map((s) => ({ identifier: s.identifier })),
  ),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  scheduleNotificationAsync: async (input: any) => {
    mockScheduled.push({ identifier: input.identifier, trigger: input.trigger });
    return 'id';
  },
}));

// In-memory AsyncStorage so loadReminderTimes / setLoggedDates round-trip.
const mockStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => (k in mockStore ? mockStore[k] : null)),
  setItem: jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
  removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
}));

import {
  loadReminderTimes,
  saveReminderTimes,
  setLoggedDates,
  syncDailyReminders,
  DEFAULT_REMINDER_TIME,
} from '../lib/notifications';

const REMINDER_TIMES_KEY = '@tinu/reminderTimes';

// Date strings from the scheduled reminders (identifier: `...-YYYY-MM-DD-HH:MM`).
function scheduledDates(): string[] {
  return mockScheduled.map((s) => s.identifier.match(/(\d{4}-\d{2}-\d{2})/)![1]);
}

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockScheduled = [];
  mockCancel.mockClear();
  mockPermission = 'granted';
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 6, 2, 8, 0, 0)); // 2026-07-02 08:00 local
});

afterEach(() => {
  jest.useRealTimers();
});

describe('loadReminderTimes', () => {
  it('defaults to 10pm ON and persists it on a fresh install', async () => {
    const times = await loadReminderTimes();
    expect(times).toEqual([DEFAULT_REMINDER_TIME]);
    expect(mockStore[REMINDER_TIMES_KEY]).toBe(JSON.stringify(['22:00']));
  });

  it('respects a previously-saved empty array (user turned reminders off)', async () => {
    await saveReminderTimes([]);
    expect(await loadReminderTimes()).toEqual([]);
  });

  it('migrates the legacy single-time keys, without re-enabling an off user', async () => {
    mockStore['@tinu/reminderEnabled'] = '0';
    mockStore['@tinu/reminderTime'] = '09:00';
    expect(await loadReminderTimes()).toEqual([]);
  });
});

describe('syncDailyReminders', () => {
  it('clears everything and schedules nothing when no times are set', async () => {
    await saveReminderTimes([]);
    const ok = await syncDailyReminders();
    expect(ok).toBe(true);
    expect(mockScheduled).toHaveLength(0);
  });

  it('returns false and schedules nothing when permission is denied', async () => {
    await saveReminderTimes(['22:00']);
    mockPermission = 'denied';
    const ok = await syncDailyReminders();
    expect(ok).toBe(false);
    expect(mockScheduled).toHaveLength(0);
  });

  it('schedules a one-shot DATE reminder for each of the next 14 days', async () => {
    await saveReminderTimes(['22:00']);
    await syncDailyReminders();
    expect(mockScheduled).toHaveLength(14);
    // All DATE triggers, first one today (22:00 is still ahead of 08:00).
    expect(mockScheduled[0].trigger.type).toBe('date');
    expect(scheduledDates()[0]).toBe('2026-07-02');
    expect(scheduledDates()[13]).toBe('2026-07-15');
  });

  it('skips today when today is already logged', async () => {
    await saveReminderTimes(['22:00']);
    await setLoggedDates(['2026-07-02']);
    await syncDailyReminders();
    expect(mockScheduled).toHaveLength(13);
    expect(scheduledDates()).not.toContain('2026-07-02');
    expect(scheduledDates()[0]).toBe('2026-07-03');
  });

  it('skips a reminder time that has already passed today', async () => {
    jest.setSystemTime(new Date(2026, 6, 2, 23, 0, 0)); // 11pm, past 10pm
    await saveReminderTimes(['22:00']);
    await syncDailyReminders();
    expect(mockScheduled).toHaveLength(13);
    expect(scheduledDates()[0]).toBe('2026-07-03');
  });

  it('cancels the previously-scheduled reminders before re-laying', async () => {
    await saveReminderTimes(['22:00']);
    await syncDailyReminders(); // lays 14
    await syncDailyReminders(); // should cancel those 14, then re-lay
    expect(mockCancel).toHaveBeenCalledTimes(14);
  });

  it('caps total scheduled at 60 to stay under the iOS 64 limit', async () => {
    await saveReminderTimes(['06:00', '09:00', '12:00', '18:00', '22:00']); // up to 5 × 14
    await syncDailyReminders();
    expect(mockScheduled).toHaveLength(60);
  });
});
