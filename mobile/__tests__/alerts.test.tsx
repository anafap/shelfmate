import ReminderPreferencesScreen from '@/features/alerts/ReminderPreferencesScreen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AlertsScreen, { Preferences } from '@/features/alerts/AlertsScreen';
import { api } from '@/lib/session';
import { registerPushDevice } from '@/lib/push';
jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/lib/push', () => ({ registerPushDevice: jest.fn(async () => false) }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
let mockHousehold = { data: { id: 'home' } as { id: string } | undefined, isPending: false, isError: false, error: new Error('Household unavailable') };
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => mockHousehold }));
let preferences: Preferences;
const item = { id: 'milk', name: 'Milk', quantity: 1, unit: 'bottle', expiryType: 'Printed', expiryDate: '2026-10-13', expiryStatus: 'ExpiringSoon', daysRemaining: 1, status: 'Active' };
beforeEach(() => {
  mockHousehold = { data: { id: 'home' }, isPending: false, isError: false, error: new Error('Household unavailable') };
  jest.clearAllMocks(); preferences = { pushEnabled: false, inAppEnabled: true, dayOffsets: [7, 3, 1, 0], mutedCategoryIds: [], localDeliveryTime: '09:00' };
  jest.mocked(api).mockImplementation(async (path, body) => {
    if (path === '/me/notification-preferences') { if (body) preferences = body as Preferences; return preferences as never; }
    if (path === '/households/current/categories') return [{ id: 'dairy', name: 'Dairy' }] as never;
    return { items: [item], total: 1, page: 1, pageSize: 50 } as never;
  });
});
async function setup(editor = false) {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity, retry: false } } });
  await render(<QueryClientProvider client={client}>{editor ? <ReminderPreferencesScreen /> : <AlertsScreen />}</QueryClientProvider>); return client;
}
test('in-app reviews remain available with push disabled and no permission prompt', async () => {
  const client = await setup(); expect(await screen.findByText('Milk')).toBeTruthy();
  expect(screen.getByText('In-app: On · Push: Off')).toBeTruthy(); expect(registerPushDevice).not.toHaveBeenCalled(); client.clear();
});
test('denied push permission saves opt-out while keeping in-app reviews', async () => {
  const client = await setup(true); await screen.findByLabelText('Push reminders');
  await fireEvent(screen.getByLabelText('Push reminders'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save reminder preferences' }));
  expect(await screen.findByText('Push permission was denied. In-app reminders remain available.')).toBeTruthy();
  await waitFor(() => expect(api).toHaveBeenCalledWith('/me/notification-preferences', expect.objectContaining({ pushEnabled: false, inAppEnabled: true }), 'PUT'));
  client.clear();
});
test('muted categories and changed offsets are saved explicitly', async () => {
  const client = await setup(true); await screen.findByLabelText('Push reminders');
  await fireEvent(screen.getByLabelText('7 days before'), 'valueChange', false);
  await fireEvent.press(screen.getByRole('button', { name: 'Mute categories' }));
  await fireEvent(screen.getByLabelText('Mute Dairy'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save reminder preferences' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/me/notification-preferences', expect.objectContaining({ dayOffsets: [3, 1, 0], mutedCategoryIds: ['dairy'] }), 'PUT')); client.clear();
});
test('a custom day can be saved without comma-separated input', async () => {
  const client = await setup(true); await screen.findByLabelText('Push reminders');
  await fireEvent.changeText(screen.getByLabelText('Add another day before (0–365)'), '5');
  await fireEvent.press(screen.getByRole('button', { name: 'Save reminder preferences' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/me/notification-preferences', expect.objectContaining({ dayOffsets: [7, 5, 3, 1, 0] }), 'PUT')); client.clear();
});
test('reminder time selection saves a household local clock time', async () => {
  const client = await setup(true); await screen.findByLabelText('Push reminders');
  await fireEvent.press(screen.getByRole('button', { name: 'Household reminder time' }));
  const selected = new Date(); selected.setHours(18, 30, 0, 0);
  await fireEvent(screen.getByTestId('reminder-time-picker'), 'onValueChange', {}, selected);
  await fireEvent.press(screen.getByRole('button', { name: 'Save reminder preferences' }));
  await waitFor(() => expect(api).toHaveBeenCalledWith('/me/notification-preferences', expect.objectContaining({ localDeliveryTime: '18:30' }), 'PUT')); client.clear();
});
test('a failed save keeps the reminder draft available for retry', async () => {
  const client = await setup(true); await screen.findByLabelText('Push reminders');
  await fireEvent.changeText(screen.getByLabelText('Add another day before (0–365)'), '5');
  jest.mocked(api).mockImplementation(async (path, body) => {
    if (path === '/me/notification-preferences' && body) throw new Error('Connection lost. Try again.');
    return preferences as never;
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Save reminder preferences' }));
  expect(await screen.findByText('Connection lost. Try again.')).toBeTruthy();
  expect(screen.getByLabelText('Add another day before (0–365)').props.value).toBe('5');
  expect(screen.getByRole('button', { name: 'Save reminder preferences' })).toBeTruthy();
  client.clear();
});
test('empty Alerts offers preferences without requesting push permission', async () => {
  jest.mocked(api).mockImplementation(async path => path.includes('/alerts/page') ? { items: [], total: 0, page: 1, pageSize: 50 } as never : preferences as never);
  const client = await setup();
  expect(await screen.findByText('Nothing to review right now')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Edit reminder preferences' })).toBeTruthy();
  expect(registerPushDevice).not.toHaveBeenCalled(); client.clear();
});

test('alerts show the server total and reach later eligible items on scroll', async () => {
  jest.mocked(api).mockImplementation(async path => {
    if (path.includes('/alerts/page')) return { items: path.includes('page=2') ? [{ ...item, id: 'rice', name: 'Rice' }] : [item], total: 2, page: path.includes('page=2') ? 2 : 1, pageSize: 1 } as never;
    return preferences as never;
  });
  const client = await setup();
  expect(await screen.findByText('2 to review')).toBeTruthy();
  await screen.findByText('Milk');
  await fireEvent(screen.getByTestId('alerts-list'), 'endReached');
  expect(await screen.findByText('Rice')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Refresh alerts' })).toBeTruthy();
  client.clear();
});

test('household loading retains its existing loading state without a premature refresh action', async () => {
  mockHousehold = { data: undefined, isPending: true, isError: false, error: new Error('Household unavailable') };
  const client = await setup();
  expect(await screen.findByLabelText('Loading household')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Refresh alerts' })).toBeNull();
  expect(screen.queryByText('Milk')).toBeNull();
  client.clear();
});
