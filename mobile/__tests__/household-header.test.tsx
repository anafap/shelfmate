import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { HouseholdHeader } from '@/features/auth/HouseholdHeader';
import { SyncStatusContext } from '@/features/sync/SyncStatusContext';
import { api } from '@/lib/session';

jest.mock('@/lib/session', () => ({ api: jest.fn() }));
jest.mock('@/features/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'owner' } } }) }));
jest.mock('@/features/auth/HouseholdScreen', () => ({ useHousehold: () => ({ data: { id: 'home', name: 'Our home' } }) }));
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  usePathname: () => '/',
}));

async function setup(syncStatus: string) {
  jest.mocked(api).mockResolvedValue([{ userId: 'owner' }] as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(<QueryClientProvider client={client}><SyncStatusContext.Provider value={syncStatus}><HouseholdHeader /></SyncStatusContext.Provider></QueryClientProvider>);
  return client;
}

afterEach(() => { jest.clearAllMocks(); });

test('shows one shared brand, household, member count, and settings action', async () => {
  const client = await setup('Shared updates connected');
  expect(screen.getByRole('header', { name: 'ShelfMate' })).toBeTruthy();
  expect(screen.getByText('Our home')).toBeTruthy();
  expect(await screen.findByText('1 member')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
  expect(screen.getByText('Live')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Refresh home' })).toBeTruthy();
  await waitFor(() => expect(client.getQueryState(['members', 'home'])?.fetchStatus).toBe('idle'));
});

test.each([
  ['Connecting shared updates…', 'Syncing'],
  ['Shared updates disconnected · refresh is available', 'Offline'],
])('keeps synchronization context compact on every page (%s)', async (status, label) => {
  const client = await setup(status);
  expect(await screen.findByText(label)).toBeTruthy();
  expect(screen.getByLabelText(status)).toBeTruthy();
  await waitFor(() => expect(client.getQueryState(['members', 'home'])?.fetchStatus).toBe('idle'));
});
