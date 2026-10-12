import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AlertsScreen, { Preferences } from '@/features/alerts/AlertsScreen';
import { api } from '@/lib/session';
import { registerPushDevice } from '@/lib/push';
jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/lib/push', () => ({ registerPushDevice: jest.fn(async () => false) }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home' }, isPending: false, isError: false }) }));
let preferences: Preferences;
const item = { id: 'milk', name: 'Milk', quantity: 1, unit: 'bottle', expiryType: 'Printed', expiryDate: '2026-10-13', expiryStatus: 'ExpiringSoon', daysRemaining: 1, status: 'Active' };
beforeEach(() => {
  jest.clearAllMocks(); preferences = { pushEnabled: false, inAppEnabled: true, dayOffsets: [7, 3, 1, 0], mutedCategoryIds: [], localDeliveryTime: '09:00' };
  jest.mocked(api).mockImplementation(async (path, body) => {
    if (path === '/me/notification-preferences') { if (body) preferences = body as Preferences; return preferences as never; }
    if (path === '/households/current/categories') return [{ id: 'dairy', name: 'Dairy' }] as never;
    return [item] as never;
  });
});
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity, retry: false } } });
  await render(<QueryClientProvider client={client}><AlertsScreen /></QueryClientProvider>); return client;
}
test('in-app reviews remain available with push disabled and no permission prompt', async () => {
  const client = await setup(); expect(await screen.findByText('Milk')).toBeTruthy();
  expect(screen.getByText('In-app: On · Push: Off')).toBeTruthy(); expect(registerPushDevice).not.toHaveBeenCalled(); client.clear();
});
test('denied push permission saves opt-out while keeping in-app reviews', async () => {
  const client = await setup(); await screen.findByRole('button', { name: 'Edit reminder preferences' });
  await fireEvent.press(screen.getByRole('button', { name: 'Edit reminder preferences' }));
  await fireEvent(screen.getByLabelText('Push reminders'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save reminder preferences' }));
  expect(await screen.findByText('Push permission was denied. In-app reminders remain available.')).toBeTruthy();
  await waitFor(() => expect(api).toHaveBeenCalledWith('/me/notification-preferences', expect.objectContaining({ pushEnabled: false, inAppEnabled: true }), 'PUT'));
  expect(screen.getByText('Milk')).toBeTruthy(); client.clear();
});
test('muted categories and changed offsets are saved explicitly', async () => {
  const client = await setup(); await screen.findByRole('button', { name: 'Edit reminder preferences' });
  await fireEvent.press(screen.getByRole('button', { name: 'Edit reminder preferences' }));
  await fireEvent.changeText(screen.getByLabelText('Days before date (comma-separated, 0 means today)'), '3,1,0');
  await fireEvent(screen.getByLabelText('Mute Dairy'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save reminder preferences' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/me/notification-preferences', expect.objectContaining({ dayOffsets: [3, 1, 0], mutedCategoryIds: ['dairy'] }), 'PUT')); client.clear();
});
