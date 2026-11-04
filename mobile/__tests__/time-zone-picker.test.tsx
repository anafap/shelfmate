import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimeZonePicker } from '@/components/TimeZonePicker';
import { timeZones } from '@/lib/timeZones';

test('city search accepts spaces and case without changing the selection until chosen', async () => {
  const onChange = jest.fn();
  await render(<TimeZonePicker value="Asia/Bahrain" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: Bahrain · Asia' }));
  await fireEvent.changeText(screen.getByLabelText('Search city or time zone'), 'NEW YORK');
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Select New York · America' }));
  expect(onChange).toHaveBeenCalledWith('America/New_York');
  expect(screen.queryByLabelText('Search city or time zone')).toBeNull();
});

test('unknown search has recovery copy and closing preserves the selected zone', async () => {
  const onChange = jest.fn();
  await render(<TimeZonePicker value="UTC" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: UTC' }));
  await fireEvent.changeText(screen.getByLabelText('Search city or time zone'), 'no-such-city');
  expect(screen.getByText('No matching time zones. Try a nearby major city or region.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close time-zone picker' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Household time zone: UTC' })).toBeTruthy();
});

test('device aliases remain selectable and controls are disabled during household creation', async () => {
  const onChange = jest.fn();
  const result = await render(<TimeZonePicker value="US/Eastern" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: Eastern · US' }));
  await fireEvent.changeText(screen.getByLabelText('Search city or time zone'), 'US/Eastern');
  expect(screen.getByRole('button', { name: 'Select Eastern · US', selected: true })).toBeTruthy();
  await result.rerender(<TimeZonePicker value="US/Eastern" onChange={onChange} disabled />);
  await fireEvent.press(screen.getByRole('button', { name: 'Select Eastern · US' }));
  expect(onChange).not.toHaveBeenCalled();
});

test('bundled choices include valid worldwide identifiers, UTC, and fractional-offset regions', () => {
  for (const zone of timeZones) expect(() => new Intl.DateTimeFormat('en', { timeZone: zone })).not.toThrow();
  expect(timeZones).toEqual(expect.arrayContaining(['UTC', 'Asia/Bahrain', 'Asia/Kolkata', 'Asia/Kathmandu', 'Pacific/Chatham', 'America/New_York']));
  expect(new Set(timeZones).size).toBe(timeZones.length);
});
