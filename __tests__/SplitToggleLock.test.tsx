import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SplitToggle from '../components/SplitToggle';

// The polarity differs per metric: Exercise is Yes=green/No=red, Sugar is the
// other way round. A Galaxy once drew the saved-state lock on Exercise but not
// on Sugar in the same screenshot, so both directions are asserted here.
const GREEN = '#10B981';
const RED = '#EF4444';

describe('SplitToggle locked state', () => {
  it('shows the lock when Exercise is saved as No (red)', async () => {
    await render(
      <SplitToggle value={false} onChange={() => {}} yesColor={GREEN} noColor={RED} locked />
    );
    expect(screen.getByText('No')).toBeTruthy();
    expect(screen.getAllByTestId('lock-icon')).toHaveLength(1);
  });

  it('shows the lock when Sugar is saved as Yes (red)', async () => {
    await render(
      <SplitToggle value={true} onChange={() => {}} yesColor={RED} noColor={GREEN} locked />
    );
    expect(screen.getByText('Yes')).toBeTruthy();
    expect(screen.getAllByTestId('lock-icon')).toHaveLength(1);
  });

  it('shows the lock when Exercise is saved as Yes (green)', async () => {
    await render(
      <SplitToggle value={true} onChange={() => {}} yesColor={GREEN} noColor={RED} locked />
    );
    expect(screen.getAllByTestId('lock-icon')).toHaveLength(1);
  });

  it('marks only the saved option, never both', async () => {
    await render(
      <SplitToggle value={false} onChange={() => {}} yesColor={GREEN} noColor={RED} locked />
    );
    expect(screen.queryAllByTestId('lock-icon')).toHaveLength(1);
  });

  it('shows no lock while the day is still editable', async () => {
    await render(
      <SplitToggle value={true} onChange={() => {}} yesColor={GREEN} noColor={RED} />
    );
    expect(screen.queryAllByTestId('lock-icon')).toHaveLength(0);
  });

  it('still shows no lock when nothing is logged yet', async () => {
    await render(
      <SplitToggle value={null} onChange={() => {}} yesColor={GREEN} noColor={RED} locked />
    );
    expect(screen.queryAllByTestId('lock-icon')).toHaveLength(0);
  });
});
