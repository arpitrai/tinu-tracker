import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import SplashScreen from '../screens/SplashScreen';

describe('SplashScreen', () => {
  it('shows the value pitch and feature pills', async () => {
    await render(<SplashScreen onDone={() => {}} />);
    expect(screen.getByText('Watch yourself get healthier.')).toBeTruthy();
    expect(screen.getByText('Exercise')).toBeTruthy();
    expect(screen.getByText('Sugar')).toBeTruthy();
    expect(screen.getByText('Weight')).toBeTruthy();
  });

  it('calls onDone when Get started is pressed', async () => {
    const onDone = jest.fn();
    await render(<SplashScreen onDone={onDone} />);
    fireEvent.press(screen.getByTestId('splash-get-started'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
