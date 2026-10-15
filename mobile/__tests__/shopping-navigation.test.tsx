import { renderRouter, screen } from 'expo-router/testing-library';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';
import RootLayout from '@/app/_layout';
import Home from '@/app/index';
import Shopping from '@/app/shopping';
import { api } from '@/lib/session';

jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/lib/push', () => ({ syncExistingPushDevice: jest.fn(async () => {}) }));
jest.mock('@/features/sync/useLiveUpdates', () => ({ useLiveUpdates: () => 'Shared updates connected' }));
jest.mock('@/features/auth/SessionProvider', () => ({ SessionProvider: ({ children }: { children: React.ReactNode }) => children, useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home', name: 'Our home' } }) }));

test('Shopping tab opens the real screen and Home navigation remains available after adding', async () => {
  jest.mocked(api).mockImplementation(async url => {
    if (url.endsWith('/dashboard')) return { activeCount: 0, shoppingListCount: 0, useFirst: [] } as never;
    return [] as never;
  });
  const placeholder = () => <View />;
  const routing = renderRouter({ _layout: RootLayout, index: Home, shopping: Shopping, inventory: placeholder, alerts: placeholder, settings: placeholder, 'add-inventory': placeholder, 'edit-inventory': placeholder });
  await routing;
  await fireEvent.press(screen.getByRole('button', { name: /^Shopping, tab/ }));
  await screen.findByText('Your list is clear');
  expect(routing.getPathname()).toBe('/shopping');
  await fireEvent.press(screen.getByRole('button', { name: 'Add shopping item' }));
  await fireEvent.changeText(screen.getByLabelText('Item name'), 'Apples');
  await fireEvent.press(screen.getByRole('button', { name: 'Add to shopping' }));
  await waitFor(() => expect(screen.queryByLabelText('Item name')).toBeNull());
  await fireEvent.press(screen.getByRole('button', { name: /^Home, tab/ }));
  await waitFor(() => expect(routing.getPathname()).toBe('/'));
});

afterEach(() => { jest.useRealTimers(); });
