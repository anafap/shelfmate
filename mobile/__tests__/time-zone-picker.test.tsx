import { fireEvent, render, screen } from '@testing-library/react-native';
import { TimeZonePicker } from '@/components/TimeZonePicker';
import { timeZones } from '@/lib/timeZones';

test('city search accepts spaces and case without changing the selection until chosen', async () => {
  const onChange = jest.fn();
  await render(<TimeZonePicker value="Asia/Bahrain" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: Bahrain' }));
  await fireEvent.changeText(screen.getByLabelText('Search city, country or time zone'), 'NEW YORK');
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Select New York · United States' }));
  expect(onChange).toHaveBeenCalledWith('America/New_York');
  expect(screen.queryByLabelText('Search city, country or time zone')).toBeNull();
});

test('unknown search has recovery copy and closing preserves the selected zone', async () => {
  const onChange = jest.fn();
  await render(<TimeZonePicker value="UTC" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: UTC' }));
  await fireEvent.changeText(screen.getByLabelText('Search city, country or time zone'), 'no-such-city');
  expect(screen.getByText('No matching time zones. Try a nearby major city or region.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close time-zone picker' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Household time zone: UTC' })).toBeTruthy();
});

test('device aliases remain selectable and controls are disabled during household creation', async () => {
  const onChange = jest.fn();
  const result = await render(<TimeZonePicker value="US/Eastern" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: Eastern · US' }));
  await fireEvent.changeText(screen.getByLabelText('Search city, country or time zone'), 'US/Eastern');
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

test('country and IANA search cover every supported zone without truncation', () => {
  const { searchTimeZones, timeZoneLabel } = require('@/lib/timeZones');
  const countries = require('@/lib/timeZoneCountries.json');
  for (const zone of timeZones.filter(zone => zone !== 'UTC')) expect(countries[zone]).toBeTruthy();
  expect(searchTimeZones(timeZones, 'united kingdom')).toContain('Europe/London');
  expect(searchTimeZones(timeZones, 'south korea')).toContain('Asia/Seoul');
  expect(searchTimeZones(timeZones, 'india')).toContain('Asia/Kolkata');
  expect(searchTimeZones(timeZones, 'united states')).toContain('America/New_York');
  expect(searchTimeZones(timeZones, 'Pacific/Chatham')).toEqual(['Pacific/Chatham']);
  expect(searchTimeZones(timeZones, '')).toHaveLength(timeZones.length);
  expect(timeZoneLabel('Asia/Bahrain')).toBe('Bahrain');
});

test('Android Back dismisses the selector without changing selection', async () => {
  const onChange = jest.fn();
  await render(<TimeZonePicker value="Asia/Bahrain" onChange={onChange} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: Bahrain' }));
  await fireEvent.changeText(screen.getByLabelText('Search city, country or time zone'), 'India');
  await fireEvent(screen.getByTestId('time-zone-selection'), 'requestClose');
  expect(screen.queryByLabelText('Search city, country or time zone')).toBeNull();
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Household time zone: Bahrain' }));
  expect(screen.getByLabelText('Search city, country or time zone').props.value).toBe('');
  expect(screen.getByRole('button', { name: 'Select Bahrain', selected: true })).toBeTruthy();
});
