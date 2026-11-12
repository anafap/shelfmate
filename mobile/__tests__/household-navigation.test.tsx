import { renderRouter, screen } from 'expo-router/testing-library';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import RootLayout from '@/app/_layout';
import { api } from '@/lib/session';

jest.mock('@/lib/session', () => ({ api: jest.fn(), flushPendingRevocations: jest.fn(async () => {}), ApiError: class extends Error {} }));
jest.mock('@/lib/push', () => ({ syncExistingPushDevice: jest.fn(async () => {}) }));
jest.mock('@/features/sync/useLiveUpdates', () => ({ useLiveUpdates: () => '' }));
jest.mock('@/features/auth/SessionProvider', () => ({ SessionProvider: ({ children }: { children: React.ReactNode }) => children, useSession: () => ({ session: { user: { id: 'setup-owner' } } }) }));

test('deep links stay in focused setup, then creation opens Home with the saved selection', async () => {
  let created = false;
  jest.mocked(api).mockImplementation(async (path, _body, method) => {
    if (path === '/households' && method === 'POST') { created = true; return {} as never; }
    if (path === '/households/current') return (created ? { id: 'home', name: 'Our home', timeZone: 'Asia/Kolkata', ownerUserId: 'setup-owner' } : null) as never;
    return [] as never;
  });
  const home = () => <Text>Household dashboard</Text>;
  const dependent = () => <Text>Private household screen</Text>;
  const routing = renderRouter({ _layout: RootLayout, index: home, inventory: dependent, shopping: dependent, alerts: dependent, settings: dependent, 'add-inventory': dependent, 'edit-inventory': dependent, 'reminder-preferences': dependent }, { initialUrl: '/inventory' });
  await routing;
  await screen.findByRole('button', { name: 'Create a household' });
  expect(screen.queryByText('Private household screen')).toBeNull();
  expect(screen.queryByRole('button', { name: /^Home, tab/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Refresh home' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Create a household' }));
  await fireEvent.changeText(screen.getByLabelText('Household name'), ' Our home ');
  await fireEvent.press(screen.getByRole('button', { name: /^Household time zone:/ }));
  await fireEvent.changeText(screen.getByLabelText('Search city, country or time zone'), 'India');
  await fireEvent.press(screen.getByRole('button', { name: 'Select Kolkata · India' }));
  expect(screen.getByRole('button', { name: 'Household time zone: Kolkata · India' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Create household' }));
  await screen.findByText('Household dashboard');
  await waitFor(() => expect(routing.getPathname()).toBe('/'));
  expect(api).toHaveBeenCalledWith('/households', { name: 'Our home', timeZone: 'Asia/Kolkata' }, 'POST');
  expect(screen.getByRole('button', { name: /^Home, tab/ })).toBeTruthy();
});
