import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import DashboardScreen, { Dashboard, naturalExpiry } from '@/features/dashboard/DashboardScreen';
import { api } from '@/lib/session';
import { InventoryItem } from '@/features/inventory/types';

jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home', name: 'Our home' }, isPending: false, isError: false }) }));
const item = { id: 'one', householdId: 'home', name: 'Estimated fruit', categoryId: 'fruit', quantity: 2, unit: 'piece', status: 'Active', expiryType: 'Estimated', expiryDate: '2026-10-12', expiryStatus: 'ExpiringSoon', daysRemaining: 0, storageLocation: 'Fridge' } as InventoryItem;
const data: Dashboard = { householdId: 'home', householdName: 'Our home', householdLocalDate: '2026-10-12', activeCount: 5, expiringSoonCount: 1, expiryTodayOrPastCount: 2, shoppingListCount: null, expiringSoonThreshold: 3, useFirst: [item] };
const categories = [{ id: 'fruit', name: 'Fruits', key: 'fruit', isSystemDefined: true }];
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><DashboardScreen /></QueryClientProvider>);
  return client;
}
function mockHomeApi(value: Dashboard = data) {
  jest.mocked(api).mockImplementation(async path => {
    if (path === '/households/current/dashboard') return value as never;
    if (path === '/households/current/members') return [{ userId: 'owner' }] as never;
    if (path === '/households/current/categories') return categories as never;
    throw new Error(`Unexpected API request: ${path}`);
  });
}
beforeEach(() => { jest.clearAllMocks(); mockHomeApi(); });

test('home displays authoritative counts, household context, and estimated dates', async () => {
  const client = await setup();
  await screen.findByText('Use these first');
  expect(screen.getByText('ShelfMate')).toBeTruthy();
  expect(screen.getByText('1 member · Manage household')).toBeTruthy();
  expect(screen.getByText('5')).toBeTruthy(); expect(screen.getByText('1')).toBeTruthy(); expect(screen.getByText('2')).toBeTruthy();
  expect(screen.getByText('List unavailable')).toBeTruthy();
  expect(screen.getByText('Estimated · Expires today')).toBeTruthy();
  expect(screen.getByText('2 piece  ·  Fruits  ·  Fridge')).toBeTruthy();
  expect(api).toHaveBeenCalledWith('/households/current/dashboard'); client.clear();
});

test('home provides direct actions for adding, using, and shopping', async () => {
  const client = await setup();
  await screen.findByText('Use these first');
  expect(screen.getByRole('link', { name: 'Add Item' })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Mark as Used/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Shopping List/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Our home, household settings' })).toBeTruthy();
  client.clear();
});

test('empty household gives a useful first-product state and shopping overview', async () => {
  mockHomeApi({ ...data, activeCount: 0, expiringSoonCount: 0, expiryTodayOrPastCount: 0, shoppingListCount: 0, useFirst: [] });
  const client = await setup();
  expect(await screen.findByText('Your shelves are ready')).toBeTruthy();
  expect(screen.getByText('Nothing to buy right now')).toBeTruthy();
  expect(screen.getByText('Expired')).toBeTruthy();
  client.clear();
});

test('unknown-only inventory is distinct from an empty household', async () => {
  mockHomeApi({ ...data, activeCount: 3, useFirst: [] });
  const client = await setup();
  expect(await screen.findByText('Nothing needs prioritizing')).toBeTruthy();
  expect(screen.queryByText('Your shelves are ready')).toBeNull(); client.clear();
});

test('failed initial dashboard request offers retry without invented counts', async () => {
  let fails = true;
  jest.mocked(api).mockImplementation(async path => {
    if (path === '/households/current/dashboard') {
      if (fails) { fails = false; throw new Error('Unable to connect.'); }
      return data as never;
    }
    if (path === '/households/current/members') return [{ userId: 'owner' }] as never;
    if (path === '/households/current/categories') return categories as never;
    throw new Error(`Unexpected API request: ${path}`);
  });
  const client = await setup();
  expect(await screen.findByText('Unable to connect.')).toBeTruthy();
  expect(screen.queryByText('5')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry home' }));
  expect(await screen.findByText('Use these first')).toBeTruthy(); client.clear();
});

test('failed refresh keeps counts and labels them stale', async () => {
  let failNextDashboard = false;
  jest.mocked(api).mockImplementation(async path => {
    if (path === '/households/current/dashboard') {
      if (failNextDashboard) { failNextDashboard = false; throw new Error('Offline.'); }
      return data as never;
    }
    if (path === '/households/current/members') return [{ userId: 'owner' }] as never;
    if (path === '/households/current/categories') return categories as never;
    throw new Error(`Unexpected API request: ${path}`);
  });
  const client = await setup(); await screen.findByText('Use these first');
  failNextDashboard = true;
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh home' }));
  expect(await screen.findByText('Showing the last loaded summary. It may be out of date.')).toBeTruthy();
  expect(screen.getByText('5')).toBeTruthy(); client.clear();
});

test.each([
  [-2, 'Expired 2 days ago'], [-1, 'Expired yesterday'], [0, 'Expires today'], [1, 'Expires tomorrow'], [2, 'Expires in 2 days'],
])('formats household-calculated day offset %i naturally', (daysRemaining, expected) => {
  expect(naturalExpiry({ ...item, daysRemaining, expiryStatus: daysRemaining < 0 ? 'Expired' : 'ExpiringSoon' } as InventoryItem)).toBe(expected);
});

test('unknown and non-active items remain clearly labeled', () => {
  expect(naturalExpiry({ ...item, expiryStatus: 'Unknown', daysRemaining: null } as InventoryItem)).toBe('Expiry date unknown');
  expect(naturalExpiry({ ...item, status: 'Consumed', expiryStatus: null } as InventoryItem)).toBe('Consumed');
});
