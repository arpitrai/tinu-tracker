import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import TriToggle from '../components/TriToggle';

const GREEN = '#00C896';
const RED   = '#FF4D4D';

describe('TriToggle', () => {
  it('renders Yes and No buttons', async () => {
    await render(<TriToggle value={null} onChange={() => {}} yesColor={GREEN} noColor={RED} />);
    expect(screen.getByTestId('toggle-yes')).toBeTruthy();
    expect(screen.getByTestId('toggle-no')).toBeTruthy();
  });

  it('calls onChange(true) when Yes is pressed from null', async () => {
    const onChange = jest.fn();
    await render(<TriToggle value={null} onChange={onChange} yesColor={GREEN} noColor={RED} />);
    fireEvent.press(screen.getByTestId('toggle-yes'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange(false) when No is pressed from null', async () => {
    const onChange = jest.fn();
    await render(<TriToggle value={null} onChange={onChange} yesColor={GREEN} noColor={RED} />);
    fireEvent.press(screen.getByTestId('toggle-no'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('deselects (calls onChange(null)) when the active option is pressed again', async () => {
    const onChange = jest.fn();
    await render(<TriToggle value={true} onChange={onChange} yesColor={GREEN} noColor={RED} />);
    fireEvent.press(screen.getByTestId('toggle-yes'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('switches from Yes to No', async () => {
    const onChange = jest.fn();
    await render(<TriToggle value={true} onChange={onChange} yesColor={GREEN} noColor={RED} />);
    fireEvent.press(screen.getByTestId('toggle-no'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('No button has red active style when noColor is red and selected', async () => {
    await render(<TriToggle value={false} onChange={() => {}} yesColor={GREEN} noColor={RED} />);
    const noBtn = screen.getByTestId('toggle-no');
    const flatStyle = Object.assign({}, ...[noBtn.props.style].flat().filter(Boolean));
    expect(flatStyle.backgroundColor).toBe(RED);
  });

  it('No button has no color when noColor is null', async () => {
    await render(<TriToggle value={false} onChange={() => {}} yesColor={GREEN} noColor={null} />);
    const noBtn = screen.getByTestId('toggle-no');
    const flatStyle = Object.assign({}, ...[noBtn.props.style].flat().filter(Boolean));
    expect(flatStyle.backgroundColor).not.toBe(RED);
  });

  it('Yes button has green active style when selected', async () => {
    await render(<TriToggle value={true} onChange={() => {}} yesColor={GREEN} noColor={RED} />);
    const yesBtn = screen.getByTestId('toggle-yes');
    const flatStyle = Object.assign({}, ...[yesBtn.props.style].flat().filter(Boolean));
    expect(flatStyle.backgroundColor).toBe(GREEN);
  });
});
