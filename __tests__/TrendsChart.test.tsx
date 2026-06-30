import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import TrendsChart, { ChartEntry } from '../components/TrendsChart';

const TODAY = '2026-06-26';

// A handful of entries inside the last 30 days.
const entries: ChartEntry[] = [
  { date: '2026-06-26', exercised: true, ate_sweets: false, weight: '70.0' },
  { date: '2026-06-25', exercised: true, ate_sweets: true, weight: '70.5' },
  { date: '2026-06-24', exercised: false, ate_sweets: true, weight: '71.0' },
  // Older than 30 days — must be excluded from the default window.
  { date: '2026-01-01', exercised: true, ate_sweets: true, weight: '99.0' },
];

describe('TrendsChart', () => {
  it('renders the period pills and defaults to Last 30 days', async () => {
    await render(<TrendsChart entries={entries} today={TODAY} onJumpToDate={() => {}} />);
    expect(screen.getByText('30D')).toBeTruthy();
    expect(screen.getByText('60D')).toBeTruthy();
    expect(screen.getByText('90D')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(screen.getByText(/Last 30 days/)).toBeTruthy();
  });

  it('switches the window when a different preset is tapped', async () => {
    await render(<TrendsChart entries={entries} today={TODAY} onJumpToDate={() => {}} />);
    fireEvent.press(screen.getByText('60D'));
    expect(await screen.findByText(/Last 60 days/)).toBeTruthy();
  });

  it('computes exercise/sugar percentages against total days in the window', async () => {
    await render(<TrendsChart entries={entries} today={TODAY} onJumpToDate={() => {}} />);
    // 2 of 30 exercised => 7%, 2 of 30 sugar => 7%; the Jan entry is out of window.
    // Both the exercise and sugar cards read "2 of 30 days".
    expect(screen.getAllByText('2 of 30 days').length).toBe(2);
    expect(screen.getAllByText('7%').length).toBeGreaterThanOrEqual(2);
  });

  it('shows average weight from in-window readings only', async () => {
    await render(<TrendsChart entries={entries} today={TODAY} onJumpToDate={() => {}} />);
    // (70.0 + 70.5 + 71.0) / 3 = 70.5  (99.0 excluded)
    expect(screen.getByText('70.5')).toBeTruthy();
    expect(screen.getByText('3 readings')).toBeTruthy();
  });

  it('renders the granularity toggle', async () => {
    await render(<TrendsChart entries={entries} today={TODAY} onJumpToDate={() => {}} />);
    expect(screen.getByText('Daily')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
  });

  it('shows an empty-state message but keeps the card shell when nothing is in the window', async () => {
    // Only an out-of-window entry -> nothing logged in the last 30 days.
    const outOfWindow: ChartEntry[] = [
      { date: '2026-01-01', exercised: true, ate_sweets: true, weight: '99.0' },
    ];
    await render(<TrendsChart entries={outOfWindow} today={TODAY} onJumpToDate={() => {}} />);
    // Message shown
    expect(screen.getByText('No entries in the last 30 days')).toBeTruthy();
    // Shell still present: period pills + average cards
    expect(screen.getByText('30D')).toBeTruthy();
    expect(screen.getByText('Avg weight')).toBeTruthy();
    expect(screen.getByText('0 readings')).toBeTruthy();
  });
});
