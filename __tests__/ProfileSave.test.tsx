import React from 'react';
import { render, fireEvent, waitFor, screen, cleanup } from '@testing-library/react-native';

const mockUpdateUser = jest.fn(async () => ({ error: null as any }));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { updateUser: (...a: any[]) => (mockUpdateUser as any)(...a) },
    rpc: jest.fn(async () => ({ error: null })),
  },
}));

const mockSync = jest.fn(async () => true);
jest.mock('../lib/notifications', () => ({
  loadReminderTimes: jest.fn(async () => ['22:00']),
  saveReminderTimes: jest.fn(async (t: string[]) => [...t].sort()),
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
});

afterEach(() => cleanup());

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

  it('confirms a reminder change too, since those persist immediately', async () => {
    await renderProfile();

    fireEvent.press(screen.getByText('9:00 AM')); // toggle a preset time

    expect(await toastText()).toBe('Changes saved');
    expect(onClose).not.toHaveBeenCalled();
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

    fireEvent.press(screen.getByText('9:00 AM'));

    await waitFor(() => expect(mockSync).toHaveBeenCalled());
    expect(screen.queryByTestId('toast-message')).toBeNull();
  });
});
