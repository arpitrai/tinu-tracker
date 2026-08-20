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
      // Thenable, so `await` at any point in the chain resolves.
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function renderTracker() {
  await render(<TrackerScreen user={user} />);
  // Anchor on the Exercise helper text, not "Exercise" itself — the history
  // table has an "Exercise" column header that would match too.
  await screen.findByText('Any movement'); // initial load resolved
}

/**
 * Opens the weight editor if needed and types `value`. The input is re-queried
 * on every step — each state change remounts it, so a held reference goes stale.
 */
async function typeWeight(value: string) {
  if (screen.queryByTestId('weight-input') == null) {
    fireEvent.press(screen.getByText('+ Add weight'));
    await screen.findByTestId('weight-input');
  }
  fireEvent.changeText(screen.getByTestId('weight-input'), value);
  await waitFor(() =>
    expect(screen.getByTestId('weight-input').props.value).toBe(value),
  );
}

const pressSave = () => fireEvent.press(screen.getByText('Save'));

/**
 * Presses one of the tri-state toggles. `metric` is 0 for Exercise, 1 for Sugar
 * (both render a SplitToggle, so the testIDs repeat). Waits for the selection to
 * paint — pressing Save in the same tick would read pre-press state.
 */
function toggleBg(metric: 0 | 1, answer: 'yes' | 'no') {
  const style = screen.getAllByTestId(`split-${answer}`)[metric].props.style;
  const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
  return flat?.backgroundColor;
}

async function pressToggle(metric: 0 | 1, answer: 'yes' | 'no') {
  const before = toggleBg(metric, answer);
  fireEvent.press(screen.getAllByTestId(`split-${answer}`)[metric]);
  // Works in both directions: selecting tints the button, deselecting greys it.
  await waitFor(() => expect(toggleBg(metric, answer)).not.toBe(before));
}

async function toastText() {
  const node = await screen.findByTestId('toast-message');
  return String(node.props.children);
}

beforeEach(() => {
  mockRows = [];
  mockUpsert.mockClear();
  mockUpsert.mockImplementation(async () => ({ error: null }));
});

afterEach(() => {
  cleanup();
});

describe('saving a day', () => {
  it('saves with weight alone — exercise and sugar stay unset', async () => {
    await renderTracker();

    await typeWeight('68.4');
    pressSave();

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.weight).toBe('68.4');
    expect(payload.exercised).toBeNull();
    expect(payload.ate_sweets).toBeNull();
  });

  it('shows a success toast after saving', async () => {
    await renderTracker();

    await typeWeight('70');
    pressSave();

    await waitFor(async () => expect(await toastText()).toBe('Changes saved'));
  });

  it('surfaces a save failure instead of silently doing nothing', async () => {
    mockUpsert.mockImplementation(async () => ({ error: { message: 'Failed to fetch' } }));
    await renderTracker();

    await typeWeight('70');
    pressSave();

    await waitFor(async () => expect(await toastText()).toMatch(/offline/i));
    // The day must not read as saved when the write failed.
    expect(screen.queryByText('✓  Saved')).toBeNull();
  });

  it('shows a plain-language message, never raw driver text', async () => {
    mockUpsert.mockImplementation(async () => ({
      error: {
        message: 'null value in column "weight" violates not-null constraint',
        code: '23502',
      },
    }));
    await renderTracker();

    await typeWeight('70');
    pressSave();

    await waitFor(async () =>
      expect(await toastText()).not.toMatch(/constraint|null value|column/i),
    );
    expect((await toastText()).length).toBeGreaterThan(0);
  });

  it('saves with exercise alone', async () => {
    await renderTracker();

    await pressToggle(0, 'yes'); // Exercise → Yes
    pressSave();

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.exercised).toBe(true);
    expect(payload.ate_sweets).toBeNull();
    expect(payload.weight).toBeNull();
  });

  it('saves with sugar alone', async () => {
    await renderTracker();

    await pressToggle(1, 'no'); // Sugar → No
    pressSave();

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.ate_sweets).toBe(false);
    expect(payload.exercised).toBeNull();
    expect(payload.weight).toBeNull();
  });

  it('blocks an unparseable weight before it reaches the database', async () => {
    await renderTracker();

    await typeWeight('.');
    pressSave();

    await waitFor(async () => expect(await toastText()).toMatch(/weight/i));
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

describe('editing a saved day', () => {
  it('deselecting exercise still saves sugar and weight', async () => {
    mockRows = [{ date: todayStr(), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');

    await pressToggle(0, 'yes'); // Exercise was Yes → tapping it clears to null
    pressSave();

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.exercised).toBeNull();
    expect(payload.ate_sweets).toBe(false);
    expect(payload.weight).toBe('70.5');
  });

  it('refuses to save once every field has been cleared', async () => {
    mockRows = [{ date: todayStr(), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');

    await pressToggle(0, 'yes'); // Exercise → cleared
    await pressToggle(1, 'no');  // Sugar → cleared
    fireEvent.press(screen.getByText('Remove')); // Weight → cleared
    await screen.findByText('+ Add weight');

    pressSave();

    // An empty day is what "Reset day" is for, not Save.
    await waitFor(() => expect(screen.getByText('Reset day')).toBeTruthy());
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('still saves while any one field survives the edit', async () => {
    mockRows = [{ date: todayStr(), exercised: true, ate_sweets: false, weight: '70.5' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');

    await pressToggle(0, 'yes'); // Exercise → cleared
    fireEvent.press(screen.getByText('Remove')); // Weight → cleared
    await screen.findByText('+ Add weight');

    pressSave(); // sugar is still set

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    const payload = mockUpsert.mock.calls[0][0] as any;
    expect(payload.ate_sweets).toBe(false);
    expect(payload.exercised).toBeNull();
    expect(payload.weight).toBeNull();
  });

  it('does not reject a previously saved weight that is outside the typing range', async () => {
    mockRows = [{ date: todayStr(), exercised: true, ate_sweets: false, weight: '12' }];
    await renderTracker();

    fireEvent.press(screen.getByText('Edit'));
    await screen.findByText('Save');
    pressSave();

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
  });
});

describe('weight field', () => {
  it('stays open after every digit is deleted', async () => {
    await renderTracker();

    await typeWeight('');

    // Must not collapse back to the "+ Add weight" button mid-typing.
    expect(screen.getByTestId('weight-input')).toBeTruthy();
    expect(screen.queryByText('+ Add weight')).toBeNull();
  });

  it('collapses only when the user explicitly removes it', async () => {
    await renderTracker();
    await typeWeight('72');

    fireEvent.press(screen.getByText('Remove'));

    await screen.findByText('+ Add weight');
    expect(screen.queryByTestId('weight-input')).toBeNull();
  });

  it('accepts a typed value without using the steppers', async () => {
    await renderTracker();

    await typeWeight('81.25');
    pressSave();

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect((mockUpsert.mock.calls[0][0] as any).weight).toBe('81.3');
  });
});

describe('history table', () => {
  it("includes today's row so a save is visible immediately", async () => {
    // One prior entry, so the table renders at all.
    mockRows = [{ date: '2020-01-01', exercised: true, ate_sweets: null, weight: '70' }];
    await renderTracker();

    await typeWeight('66.6');
    pressSave();

    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());

    const [y, m, d] = todayStr().split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    });

    expect(await screen.findByText(label)).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText('66.6').length).toBeGreaterThan(0));
  });
});
