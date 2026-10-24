import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, screen, cleanup, act } from '@testing-library/react-native';

const mockUpdateUser = jest.fn(async () => ({ error: null as any }));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { updateUser: (...a: any[]) => (mockUpdateUser as any)(...a) },
    rpc: jest.fn(async () => ({ error: null })),
  },
}));

const mockSync = jest.fn(async () => true);
const mockSaveTimes = jest.fn(async (t: string[]) => [...t].sort());
// What the OS reports; tests flip these to simulate a refused or blocked prompt.
let mockPermission = { granted: true, canAskAgain: true };
const mockRequest = jest.fn(async () => false);
jest.mock('../lib/notifications', () => ({
  getNotificationPermission: jest.fn(async () => mockPermission),
  requestNotificationPermission: (...a: any[]) => (mockRequest as any)(...a),
  loadReminderTimes: jest.fn(async () => ['22:00']),
  saveReminderTimes: (...a: any[]) => (mockSaveTimes as any)(...a),
  syncDailyReminders: (...a: any[]) => (mockSync as any)(...a),
}));

import ProfileModal from '../components/ProfileModal';

const user: any = {
  id: 'user-1',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
};

const onClose = jest.fn();

async function renderProfile() {
  await render(<ProfileModal visible onClose={onClose} user={user} />);
  await screen.findByText('Daily reminder');
}

const toastText = async () =>
  String((await screen.findByTestId('toast-message')).props.children);

beforeEach(() => {
  onClose.mockClear();
  mockUpdateUser.mockClear();
  mockUpdateUser.mockImplementation(async () => ({ error: null }));
  mockSync.mockClear();
  mockSync.mockImplementation(async () => true);
  mockSaveTimes.mockClear();
  mockSaveTimes.mockImplementation(async (t: string[]) => [...t].sort());
  mockPermission = { granted: true, canAskAgain: true };
  mockRequest.mockClear();
  mockRequest.mockImplementation(async () => false);
});

// Must be awaited: cleanup is async here, and an un-awaited one leaves the
// previous tree mounted — its toast dismiss timer then fires during the next
// test and tears the environment down mid-run.
afterEach(async () => {
  await cleanup();
  // Flush anything the unmounted tree left in flight before the next render.
  await act(async () => {});
});

describe('reminders without notification permission', () => {
  it('shows reminders as off instead of promising a 10pm nudge', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    await renderProfile();
    expect(await screen.findByText(/Notifications are off for Tinu Tracker/)).toBeTruthy();
    expect(screen.getByTestId('reminder-switch').props.value).toBe(false);
    expect(screen.queryByText('10:00 PM')).toBeNull();
  });

  it('keeps the saved times when the name is saved', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    await renderProfile();
    await screen.findByText(/Notifications are off/);
    fireEvent.press(screen.getByText('Save changes'));
    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());
    expect(mockSaveTimes).not.toHaveBeenCalled();
  });

  it('offers Settings when the switch is turned on and the prompt is blocked', async () => {
    mockPermission = { granted: false, canAskAgain: false };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderProfile();
    await screen.findByText(/Turn this on to open Settings/);
    await act(async () => { fireEvent(screen.getByTestId('reminder-switch'), 'valueChange', true); });
    expect(alert).toHaveBeenCalledTimes(1);
    const buttons = alert.mock.calls[0][2] as any[];
    expect(buttons.map((b) => b.text)).toContain('Open Settings');
    expect(mockRequest).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('asks for permission, then brings the saved times back', async () => {
    mockPermission = { granted: false, canAskAgain: true };
    mockRequest.mockImplementation(async () => {
      mockPermission = { granted: true, canAskAgain: true };
      return true;
    });
    await renderProfile();
    await screen.findByText(/Turn this on to allow them/);
    await act(async () => { fireEvent(screen.getByTestId('reminder-switch'), 'valueChange', true); });
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('10:00 PM')).toBeTruthy();
  });
});

describe('saving on the profile screen', () => {
  it('confirms with a toast and stays on the screen', async () => {
    await renderProfile();

    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(mockUpdateUser).toHaveBeenCalled());
    expect(await toastText()).toBe('Changes saved');
    // The whole point: saving must not dismiss the screen.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Daily reminder')).toBeTruthy();
  });

  it('treats a reminder change as a draft until Save is pressed', async () => {
    await renderProfile();

    fireEvent.press(screen.getByText('9:00 AM')); // toggle a preset time

    // Nothing written, nothing rescheduled, nothing claimed.
    await waitFor(() => expect(screen.getByText('9:00 AM')).toBeTruthy());
    expect(mockSaveTimes).not.toHaveBeenCalled();
    expect(mockSync).not.toHaveBeenCalled();
    expect(screen.queryByTestId('toast-message')).toBeNull();
  });

  it('shows the failure instead of a false confirmation', async () => {
    mockUpdateUser.mockImplementation(async () => ({ error: { message: 'Network request failed' } }));
    await renderProfile();

    fireEvent.press(screen.getByText('Save changes'));

    expect(await screen.findByText('Network request failed')).toBeTruthy();
    expect(screen.queryByTestId('toast-message')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not claim success when reminders are blocked by permission', async () => {
    mockSync.mockImplementation(async () => false); // permission denied
    await renderProfile();

    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(mockSync).toHaveBeenCalled());
    expect(screen.queryByTestId('toast-message')).toBeNull();
    // The spinner must end: this path returns early, and it once left the
    // button spinning forever.
    expect(await screen.findByText('Save changes')).toBeTruthy();
  });

  // Runs last on purpose. Under this renderer, a test that presses a chip and
  // then Saves leaves the next render returning an empty tree — every test here
  // passes alone, and the app path is identical, so this is a harness artifact
  // rather than app behaviour. Ordering avoids it without hiding a real bug.
  it('writes the reminder times when Save is pressed', async () => {
    await renderProfile();

    fireEvent.press(screen.getByText('9:00 AM'));
    // Let the draft state settle, or Save reads the pre-press value.
    await act(async () => {});
    fireEvent.press(screen.getByText('Save changes'));

    await waitFor(() => expect(mockSaveTimes).toHaveBeenCalled());
    // 22:00 came from storage, 09:00 was just added.
    expect(mockSaveTimes.mock.calls[0][0]).toEqual(['09:00', '22:00']);
    expect(await toastText()).toBe('Changes saved');
  });
});
