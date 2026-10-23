import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, screen, cleanup } from '@testing-library/react-native';

// Rows the mocked `select` returns, and whether that read fails.
let mockRows: any[] = [];
let mockLoadFails = false;
const mockUpsert = jest.fn(async () => ({ error: null as any }));
const mockSignOut = jest.fn();

jest.mock('../lib/supabase', () => {
  const makeChain = () => {
    const chain: any = {
      select: () => chain,
      delete: () => chain,
      eq: () => chain,
      order: () => chain,
      upsert: (...args: any[]) => (mockUpsert as any)(...args),
      then: (res: any, rej: any) =>
        Promise.resolve(
          mockLoadFails
            ? { data: null, error: { message: 'Network request failed' } }
            : { data: mockRows, error: null },
        ).then(res, rej),
    };
    return chain;
  };
  return { supabase: { from: () => makeChain(), auth: { signOut: (...a: any[]) => mockSignOut(...a) } } };
});

jest.mock('../lib/notifications', () => ({
  setLoggedDates: jest.fn(async () => {}),
  syncDailyReminders: jest.fn(async () => {}),
}));

import TrackerScreen from '../screens/TrackerScreen';

const user: any = { id: 'user-1', email: 'test@example.com', user_metadata: { full_name: 'Test User' } };

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function renderTracker() {
  await render(<TrackerScreen user={user} />);
  await screen.findByText('Any movement');
}

beforeEach(() => {
  mockRows = [];
  mockLoadFails = false;
  mockUpsert.mockClear();
  mockUpsert.mockImplementation(async () => ({ error: null }));
  mockSignOut.mockClear();
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('a failed load', () => {
  it('says so instead of showing an empty account', async () => {
    mockLoadFails = true;
    await render(<TrackerScreen user={user} />);
    expect(await screen.findByText("Couldn't load your entries")).toBeTruthy();
    expect(screen.queryByText('+ Add weight')).toBeNull();
  });

  it('recovers on Try again once the connection is back', async () => {
    mockLoadFails = true;
    await render(<TrackerScreen user={user} />);
    const retry = await screen.findByText('Try again');
    mockLoadFails = false;
    fireEvent.press(retry);
    expect(await screen.findByText('Any movement')).toBeTruthy();
    expect(screen.queryByTestId('load-error')).toBeNull();
  });
});

describe('the empty Save button', () => {
  it('explains what is missing instead of doing nothing', async () => {
    await renderTracker();
    expect(screen.getByText('Pick Yes or No, or add a weight, to save this day')).toBeTruthy();
    fireEvent.press(screen.getByText('Save'));
    const msg = await screen.findByTestId('toast-message');
    expect(String(msg.props.children)).toMatch(/before saving/);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('lets that hint fade so it never covers the history for long', async () => {
    await renderTracker();
    fireEvent.press(screen.getByText('Save'));
    await screen.findByTestId('toast-message');
    await waitFor(() => expect(screen.queryByTestId('toast')).toBeNull(), { timeout: 5000 });
  });
});

describe('a saved day', () => {
  it('unlocks and applies a tap on a locked toggle in one go', async () => {
    mockRows = [{ date: dateStr(), exercised: true, ate_sweets: false, weight: null }];
    await renderTracker();
    expect(screen.getByText('Edit')).toBeTruthy();

    // Sugar is saved as No; tapping its locked Yes switches it straight away.
    fireEvent.press(screen.getAllByTestId('split-yes-locked')[1]);
    await screen.findByText('Save');
    fireEvent.press(screen.getByText('Save'));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.exercised).toBe(true);
    expect(payload.ate_sweets).toBe(true);
  });

  it('opens for editing when the saved weight is tapped', async () => {
    mockRows = [{ date: dateStr(), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();
    fireEvent.press(screen.getByTestId('weight-locked'));
    expect(await screen.findByTestId('weight-input')).toBeTruthy();
  });
});

describe('getting back to today', () => {
  it('shows a Today shortcut only on past days', async () => {
    await renderTracker();
    expect(screen.queryByTestId('go-today')).toBeNull();

    fireEvent.press(screen.getByText('‹'));
    fireEvent.press(await screen.findByTestId('go-today'));
    await waitFor(() => expect(screen.queryByTestId('go-today')).toBeNull());
  });
});

describe('a failed save', () => {
  it('keeps the error up with a Retry that saves again', async () => {
    mockUpsert.mockImplementationOnce(async () => ({ error: { message: 'Network request failed' } }));
    await renderTracker();
    fireEvent.press(screen.getAllByTestId('split-yes')[0]);
    // Wait for the selection to land, or Save reads the empty form.
    await waitFor(() =>
      expect(screen.queryByText('Pick Yes or No, or add a weight, to save this day')).toBeNull(),
    );
    fireEvent.press(screen.getByText('Save'));

    fireEvent.press(await screen.findByTestId('toast-action'));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalledTimes(2));
  });
});

describe('logging out', () => {
  it('asks first, and only signs out on confirm', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderTracker();
    jest.useFakeTimers();

    fireEvent.press(screen.getByText('T')); // avatar initial opens the menu
    fireEvent.press(await screen.findByText('Log Out'));
    jest.runAllTimers();

    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as any[];
    buttons.find((b) => b.text === 'Log out').onPress();
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
