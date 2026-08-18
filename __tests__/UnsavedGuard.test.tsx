import React from 'react';
import { render, fireEvent, waitFor, screen, cleanup } from '@testing-library/react-native';

// Rows the mocked `select` returns; individual tests reseed this.
let mockRows: any[] = [];
const mockUpsert = jest.fn(async () => ({ error: null as any }));

jest.mock('../lib/supabase', () => {
  const makeChain = () => {
    const chain: any = {
      select: () => chain,
      delete: () => chain,
      eq: () => chain,
      order: () => chain,
      upsert: (...args: any[]) => (mockUpsert as any)(...args),
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

function dateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Mirrors formatDatePretty in TrackerScreen: "Thu, 25 Jun".
function prettyDate(offsetDays = 0): string {
  const [y, m, d] = dateStr(offsetDays).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const wd = dt.toLocaleDateString('en-US', { weekday: 'short' });
  const mon = dt.toLocaleDateString('en-US', { month: 'short' });
  return `${wd}, ${d} ${mon}`;
}

// The history table labels rows differently from the date header: "Fri, Aug 15".
function historyRowLabel(offsetDays: number): string {
  const [y, m, d] = dateStr(offsetDays).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

async function renderTracker() {
  await render(<TrackerScreen user={user} />);
  await screen.findByText('Any movement'); // initial load resolved
}

function toggleBg(metric: 0 | 1, answer: 'yes' | 'no') {
  const style = screen.getAllByTestId(`split-${answer}`)[metric].props.style;
  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  return flat?.backgroundColor;
}

async function pressToggle(metric: 0 | 1, answer: 'yes' | 'no') {
  const before = toggleBg(metric, answer);
  fireEvent.press(screen.getAllByTestId(`split-${answer}`)[metric]);
  await waitFor(() => expect(toggleBg(metric, answer)).not.toBe(before));
}

const goPrevDay = () => fireEvent.press(screen.getByText('‹'));

beforeEach(() => {
  mockRows = [];
  mockUpsert.mockClear();
  mockUpsert.mockImplementation(async () => ({ error: null }));
});

afterEach(() => {
  cleanup();
});

describe('leaving a day with unsaved entries', () => {
  it('asks before the date arrows change the day', async () => {
    await renderTracker();
    await pressToggle(1, 'yes'); // Sugar → Yes, not saved

    goPrevDay();

    expect(await screen.findByTestId('unsaved-save')).toBeTruthy();
    // Still on today until the prompt is answered.
    expect(screen.getByText(prettyDate(0))).toBeTruthy();
  });

  it('asks before switching to the Trend tab', async () => {
    await renderTracker();
    await pressToggle(0, 'yes');

    fireEvent.press(screen.getByText('Trend'));

    expect(await screen.findByTestId('unsaved-save')).toBeTruthy();
    expect(screen.getByText('Any movement')).toBeTruthy(); // never left the log
  });

  it('asks before a history row jumps to another day', async () => {
    mockRows = [{ date: dateStr(-3), exercised: true, ate_sweets: null, weight: '70' }];
    await renderTracker();
    await pressToggle(0, 'no');

    fireEvent.press(screen.getByText(historyRowLabel(-3)));

    expect(await screen.findByTestId('unsaved-save')).toBeTruthy();
  });

  it('does not ask when nothing was changed', async () => {
    await renderTracker();

    goPrevDay();

    await screen.findByText(prettyDate(-1));
    expect(screen.queryByTestId('unsaved-save')).toBeNull();
  });

  it('"Keep editing" stays on the day with the entries intact', async () => {
    await renderTracker();
    await pressToggle(0, 'yes');
    const selected = toggleBg(0, 'yes');

    goPrevDay();
    fireEvent.press(await screen.findByTestId('unsaved-cancel'));

    await waitFor(() => expect(screen.queryByTestId('unsaved-cancel')).toBeNull());
    expect(screen.getByText(prettyDate(0))).toBeTruthy();
    expect(toggleBg(0, 'yes')).toBe(selected);
  });

  it('"Save" writes the day and then navigates', async () => {
    await renderTracker();
    await pressToggle(0, 'yes');

    goPrevDay();
    fireEvent.press(await screen.findByTestId('unsaved-save'));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.date).toBe(dateStr(0));
    expect(payload.exercised).toBe(true);
    await screen.findByText(prettyDate(-1));
  });

  it('a failed save keeps the user on the day so the error is visible', async () => {
    mockUpsert.mockImplementation(async () => ({ error: { message: 'Failed to fetch' } }));
    await renderTracker();
    await pressToggle(0, 'yes');

    goPrevDay();
    fireEvent.press(await screen.findByTestId('unsaved-save'));

    await waitFor(() => expect(screen.queryByTestId('unsaved-save')).toBeNull());
    expect(screen.getByText(prettyDate(0))).toBeTruthy();
    expect(String((await screen.findByTestId('toast-message')).props.children)).toMatch(/offline/i);
  });

  it('"Discard changes" drops the entries and navigates', async () => {
    await renderTracker();
    await pressToggle(0, 'yes');
    const unselected = toggleBg(0, 'no'); // an untouched button, for comparison

    goPrevDay();
    fireEvent.press(await screen.findByTestId('unsaved-discard'));

    await screen.findByText(prettyDate(-1));
    expect(mockUpsert).not.toHaveBeenCalled();
    // Exercise came back unset on the new day.
    expect(toggleBg(0, 'yes')).toBe(unselected);
  });

  it('offers no Save when the edit leaves the day empty', async () => {
    mockRows = [{ date: dateStr(0), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');
    await pressToggle(0, 'yes'); // Exercise → cleared
    await pressToggle(1, 'no');  // Sugar → cleared
    fireEvent.press(screen.getByText('Remove'));
    await screen.findByText('+ Add weight');

    goPrevDay();

    // Nothing left to save — discard is the only way out.
    expect(await screen.findByTestId('unsaved-discard')).toBeTruthy();
    expect(screen.queryByTestId('unsaved-save')).toBeNull();
  });

  it('asks when an edit to a saved day is navigated away from', async () => {
    mockRows = [{ date: dateStr(0), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');
    await pressToggle(1, 'yes'); // Sugar: No → Yes

    goPrevDay();

    expect(await screen.findByTestId('unsaved-save')).toBeTruthy();
    expect(screen.getByText(prettyDate(0))).toBeTruthy();
  });

  it('saves an edited day from the prompt and then navigates', async () => {
    mockRows = [{ date: dateStr(0), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');
    await pressToggle(1, 'yes'); // Sugar: No → Yes

    goPrevDay();
    fireEvent.press(await screen.findByTestId('unsaved-save'));

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.date).toBe(dateStr(0));
    expect(payload.ate_sweets).toBe(true);
    expect(payload.weight).toBe('70.5');
    await screen.findByText(prettyDate(-1));
  });

  it('still asks when the editor is open but nothing was changed yet', async () => {
    mockRows = [{ date: dateStr(0), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');

    goPrevDay();

    expect(await screen.findByText('Finish editing?')).toBeTruthy();
    expect(screen.getByText(prettyDate(0))).toBeTruthy();
  });

  it('does not ask on a saved day that is only being viewed', async () => {
    mockRows = [{ date: dateStr(0), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    goPrevDay(); // read-only, editor never opened

    await screen.findByText(prettyDate(-1));
    expect(screen.queryByTestId('unsaved-discard')).toBeNull();
  });
});
