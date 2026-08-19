import React from 'react';
import { BackHandler } from 'react-native';
import { render, fireEvent, waitFor, screen, cleanup, act } from '@testing-library/react-native';

let mockRows: any[] = [];

jest.mock('../lib/supabase', () => {
  const makeChain = () => {
    const chain: any = {
      select: () => chain,
      delete: () => chain,
      eq: () => chain,
      order: () => chain,
      upsert: async () => ({ error: null }),
      then: (res: any, rej: any) =>
        Promise.resolve({ data: mockRows, error: null }).then(res, rej),
    };
    return chain;
  };
  return { supabase: { from: () => makeChain(), auth: { signOut: jest.fn() } } };
});

jest.mock('../lib/notifications', () => ({
  setLoggedDates: jest.fn(async () => {}),
  syncDailyReminders: jest.fn(async () => {}),
}));

import TrackerScreen from '../screens/TrackerScreen';

const user: any = {
  id: 'user-1',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User' },
};

function dateStr(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prettyDate(offset = 0): string {
  const [y, m, d] = dateStr(offset).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${dt.toLocaleDateString('en-US', { weekday: 'short' })}, ${d} ${dt.toLocaleDateString('en-US', { month: 'short' })}`;
}

// CalendarModal's header, e.g. "August 2026".
function monthTitle(): string {
  const d = new Date();
  return `${d.toLocaleDateString('en-US', { month: 'long' })} ${d.getFullYear()}`;
}

// The screen re-registers its handler whenever its state changes, so always
// invoke the most recently registered one.
let handlers: Array<() => boolean> = [];
let addSpy: jest.SpyInstance;

// The act must be async: under React 19 a sync one leaves the re-render
// unflushed, so the screen still shows the previous tab when asserted.
const pressBack = async () => {
  const onBack = handlers[handlers.length - 1];
  let handled = false;
  await act(async () => { handled = onBack(); });
  return handled; // false = the OS takes over and the app exits
};

beforeEach(() => {
  mockRows = [];
  handlers = [];
  addSpy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((
    _event: string,
    handler: () => boolean,
  ) => {
    handlers.push(handler);
    return { remove: () => {} };
  }) as any);
});

afterEach(() => {
  addSpy.mockRestore();
  cleanup();
});

async function renderTracker() {
  await render(<TrackerScreen user={user} />);
  await screen.findByText('Any movement');
}

describe('back / edge-swipe hierarchy', () => {
  it('returns to the Daily Log from the Trend tab instead of exiting', async () => {
    await renderTracker();
    fireEvent.press(screen.getByText('Trend'));
    await waitFor(() => expect(screen.queryByText('Any movement')).toBeNull());

    expect(await pressBack()).toBe(true); // handled, so the app stays open

    await screen.findByText('Any movement');
  });

  it('returns to today from a past day', async () => {
    await renderTracker();
    fireEvent.press(screen.getByText('‹'));
    await screen.findByText(prettyDate(-1));

    expect(await pressBack()).toBe(true);

    await screen.findByText(prettyDate(0));
  });

  it('closes the calendar before anything else', async () => {
    await renderTracker();
    fireEvent.press(screen.getByText(prettyDate(0)));
    await screen.findByText(monthTitle()); // the open calendar's month header

    expect(await pressBack()).toBe(true);

    // Still on today, calendar dismissed.
    await screen.findByText('Any movement');
  });

  it('lets the OS exit from the Daily Log on today with nothing open', async () => {
    await renderTracker();

    expect(await pressBack()).toBe(false);
  });

  it('asks about unsaved entries rather than exiting', async () => {
    await renderTracker();
    fireEvent.press(screen.getAllByTestId('split-yes')[0]); // Exercise → Yes
    await waitFor(() => expect(screen.getByText('Save')).toBeTruthy());

    expect(await pressBack()).toBe(true);

    expect(await screen.findByTestId('unsaved-discard')).toBeTruthy();
  });

  it('unwinds the Trend tab before offering to exit', async () => {
    await renderTracker();
    fireEvent.press(screen.getByText('Trend'));
    await waitFor(() => expect(screen.queryByText('Any movement')).toBeNull());

    expect(await pressBack()).toBe(true);  // Trend -> Daily Log
    await screen.findByText('Any movement');
    expect(await pressBack()).toBe(false); // only now may the app close
  });
});
