import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DashboardScreen, { Dashboard } from '@/features/dashboard/DashboardScreen';
import { api } from '@/lib/session';
import { InventoryItem } from '@/features/inventory/types';

jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home', name: 'Our home' }, isPending: false, isError: false }) }));
const item = { id: 'one', name: 'Estimated fruit', quantity: 2, unit: 'piece', status: 'Active', expiryType: 'Estimated', expiryDate: '2026-10-12', expiryStatus: 'ExpiringSoon', daysRemaining: 0, storageLocation: 'Fridge' } as InventoryItem;
const data: Dashboard = { householdId: 'home', householdName: 'Our home', householdLocalDate: '2026-10-12', activeCount: 5, expiringSoonCount: 1, expiryTodayOrPastCount: 2, shoppingListCount: null, useFirst: [item] };
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><DashboardScreen /></QueryClientProvider>);
  return client;
}
beforeEach(() => { jest.clearAllMocks(); jest.mocked(api).mockResolvedValue(data); });
test('dashboard displays authoritative counts and estimated dates without a made-up shopping count', async () => {
  const client = await setup();
  await screen.findByText('Active products');
  expect(screen.getByText('5')).toBeTruthy(); expect(screen.getByText('1')).toBeTruthy(); expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('Coming next')).toBeTruthy();
  expect(screen.getByText('Estimated date today · review item')).toBeTruthy();
  expect(screen.getByText('An estimated date is an editable guide, not a verified safety deadline.')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/households/current/dashboard'); client.clear();
});
test('empty household gives a useful first-product state', async () => {
  jest.mocked(api).mockResolvedValue({ ...data, activeCount: 0, expiringSoonCount: 0, expiryTodayOrPastCount: 0, useFirst: [] });
  const client = await setup();
  expect(await screen.findByText('Your shelves are ready')).toBeTruthy();
  expect(screen.getByText('Manage products in Inventory')).toBeTruthy(); client.clear();
});
test('unknown-only inventory is distinct from an empty household', async () => {
  jest.mocked(api).mockResolvedValue({ ...data, activeCount: 3, useFirst: [] });
  const client = await setup();
  expect(await screen.findByText('No dates to prioritize')).toBeTruthy();
  expect(screen.queryByText('Your shelves are ready')).toBeNull(); client.clear();
});
test('failed initial request offers retry without showing invented counts', async () => {
  jest.mocked(api).mockRejectedValueOnce(new Error('Unable to connect.'));
  const client = await setup();
  expect(await screen.findByText('Unable to connect.')).toBeTruthy();
  expect(screen.queryByText('Active products')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry dashboard' }));
  expect(await screen.findByText('Active products')).toBeTruthy(); client.clear();
});
test('failed refresh clearly marks retained summary as stale', async () => {
  const client = await setup(); await screen.findByText('Active products');
  jest.mocked(api).mockRejectedValueOnce(new Error('Offline.'));
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh dashboard' }));
  expect(await screen.findByText('Showing the previously loaded summary. It may be out of date.')).toBeTruthy();
  expect(screen.getByText('5')).toBeTruthy(); client.clear();
});
